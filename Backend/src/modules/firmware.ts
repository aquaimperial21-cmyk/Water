// Admin side of remote firmware updates (OTA), mounted at /api/v1/firmware.
//
//   POST  /admin/releases                 upload a signed .bin + its manifest (rollout starts OFF)
//   GET   /admin/releases                 every release, newest first, with fleet counts
//   PATCH /admin/releases/:id             rollout OFF | TEST | ALL, test serials, installNow, notes
//   GET   /admin/devices                  each purifier's firmware and update progress
//   POST  /admin/devices/:serial/retry    clear a unit's failed attempts so it is offered again
//
// The purifier side (offer in /state, image download, progress reports) lives
// in modules/device.ts. Checks and storage are shared with the ops CLI
// through core/firmware.ts.

import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import type { FirmwareRelease } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { asyncHandler, BadRequest, NotFound } from '../core/errors';
import { validateBody } from '../core/validate';
import {
  FIRMWARE_ROOT,
  MAX_IMAGE_BYTES,
  ROLLOUTS,
  registerFirmwareRelease,
  releaseCounts,
  updateFirmwareRelease,
} from '../core/firmware';
import { presenceOf } from '../core/device-online';
import { UPLOAD_ROOT } from './upload';

const router = Router();

// Kept in memory: the image is hashed and signature-checked before it is
// written anywhere, and it is at most one app slot (under 2 MB).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 2, fields: 10, fieldSize: 64 * 1024 },
});

// `manifest` may arrive as a text field or as a file part; accept both.
const receiveRelease = (req: Request, res: Response, next: NextFunction) => {
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'manifest', maxCount: 1 },
  ])(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(BadRequest(`Image is larger than the ESP32 app slot (${MAX_IMAGE_BYTES} bytes)`));
      }
      return next(BadRequest(`Upload rejected: ${err.message}`));
    }
    next(err);
  });
};

async function withCounts(releases: FirmwareRelease[]) {
  const counts = await releaseCounts(releases);
  return releases.map((r) => ({ ...r, counts: counts.get(r.id)! }));
}

router.post(
  '/admin/releases',
  authRequired(['ADMIN']),
  receiveRelease,
  asyncHandler(async (req, res) => {
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
    const bin = files.file?.[0];
    if (!bin) throw BadRequest('No firmware file uploaded (field "file")');
    const manifestText =
      typeof req.body?.manifest === 'string' ? req.body.manifest : files.manifest?.[0]?.buffer.toString('utf8');
    if (!manifestText) throw BadRequest('No manifest (field "manifest")');
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : null;

    const release = await registerFirmwareRelease({
      bin: bin.buffer,
      manifestText,
      notes,
      actorUserId: req.auth!.sub,
    });
    const [withCount] = await withCounts([release]);
    res.status(201).json({ data: withCount });
  })
);

router.get(
  '/admin/releases',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const releases = await prisma.firmwareRelease.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    res.json({ data: await withCounts(releases) });
  })
);

const patchReleaseSchema = z.object({
  rollout: z.enum(ROLLOUTS).optional(),
  testSerials: z.array(z.string().max(64)).max(1000).optional(),
  installNow: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

router.patch(
  '/admin/releases/:id',
  authRequired(['ADMIN']),
  validateBody(patchReleaseSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof patchReleaseSchema>;
    const release = await updateFirmwareRelease(req.params.id, body, req.auth!.sub);
    const [withCount] = await withCounts([release]);
    res.json({ data: withCount });
  })
);

const deviceSelect = {
  serial: true,
  firmwareVersion: true,
  otaReleaseId: true,
  otaStatus: true,
  otaError: true,
  otaAttempts: true,
  otaUpdatedAt: true,
  lastHeartbeatAt: true,
  lastSeenAt: true,
  otaRelease: { select: { version: true } },
} as const;

type DeviceRow = {
  serial: string;
  firmwareVersion: string | null;
  otaReleaseId: string | null;
  otaStatus: string | null;
  otaError: string | null;
  otaAttempts: number;
  otaUpdatedAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastSeenAt: Date | null;
  otaRelease: { version: string } | null;
};

function deviceView(d: DeviceRow) {
  const { otaRelease, ...rest } = d;
  return {
    ...rest,
    otaReleaseVersion: otaRelease?.version ?? null,
    ...presenceOf(d), // lastSeenAt = latest contact, isOnline = within 25 h
  };
}

router.get(
  '/admin/devices',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const devices = await prisma.device.findMany({ select: deviceSelect, orderBy: { serial: 'asc' } });
    res.json({ data: devices.map(deviceView) });
  })
);

router.post(
  '/admin/devices/:serial/retry',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const device = await prisma.device.findUnique({ where: { serial: req.params.serial } });
    if (!device) throw NotFound('Device not found');
    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.device.update({
        where: { id: device.id },
        // otaRetryGen tells the chip to reset its own try count too.
        data: { otaAttempts: 0, otaStatus: null, otaError: null, otaUpdatedAt: new Date(), otaRetryGen: { increment: 1 } },
        select: deviceSelect,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.sub,
          action: 'DEVICE_OTA_RETRY',
          entity: 'Device',
          entityId: device.id,
          before: JSON.stringify({
            otaReleaseId: device.otaReleaseId,
            otaStatus: device.otaStatus,
            otaAttempts: device.otaAttempts,
            otaError: device.otaError,
          }),
          after: JSON.stringify({ serial: device.serial }),
        },
      });
      return d;
    });
    res.json({ data: deviceView(updated) });
  })
);

// Release images must only leave through the device-token route. Mounted in
// front of the public /uploads static handler; works on the decoded,
// normalised path so `%66irmware`, `//firmware` or `x/../firmware` are
// refused too.
export function blockPublicFirmware(req: Request, res: Response, next: NextFunction) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(req.path);
  } catch {
    decoded = '';
  }
  const target = path.join(UPLOAD_ROOT, decoded.replace(/\\/g, '/'));
  const rel = path.relative(FIRMWARE_ROOT, target);
  const insideFirmware = rel === '' || !(rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel));
  if (!decoded || insideFirmware) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
  next();
}

export default router;
