// Remote firmware updates (OTA) for the ESP32 inside each purifier.
//
// A release is a signed app image (.bin) plus the manifest the signing tool
// on the release PC writes next to it:
//   { version, size, sha256, signature, createdAt, keyFingerprint }
//   signature = base64(DER(ECDSA P-256 over SHA-256 of the exact .bin bytes))
// The server checks the image against keys/firmware-signing-public.pem before
// storing it; the chip checks the same signature again before booting it.
//
// Shared by the admin routes (modules/firmware.ts), the device routes
// (modules/device.ts) and the ops CLI (scripts/firmware.ts), so every way in
// applies the same rules.

import { createHash, createPublicKey, randomUUID, verify as verifySignature, type KeyObject } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma, type FirmwareRelease } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './prisma';
import { BadRequest, Conflict, HttpError, NotFound } from './errors';
import { UPLOAD_ROOT } from '../modules/upload';

/** The ESP32 app partition (ota_0 / ota_1) is 0x1E0000 bytes. */
export const MAX_IMAGE_BYTES = 1966080;
/** Anything this small is not a real SmartRO build. */
export const MIN_IMAGE_BYTES = 64 * 1024;
/** First byte of every ESP32 app image (esp_image_header_t.magic). */
export const ESP_IMAGE_MAGIC = 0xe9;
/** Offers stop once a unit has reported FAILED or ROLLED_BACK this many times for a release. */
export const MAX_FAILED_ATTEMPTS = 3;

export const FIRMWARE_VERSION_RE = /^[A-Za-z0-9._+-]{1,40}$/;
export const ROLLOUTS = ['OFF', 'TEST', 'ALL'] as const;
export type Rollout = (typeof ROLLOUTS)[number];
export const OTA_REPORT_STATUSES = ['DOWNLOADING', 'FAILED', 'INSTALLED', 'ROLLED_BACK'] as const;
export type OtaReportStatus = (typeof OTA_REPORT_STATUSES)[number];

/** Folder under UPLOAD_ROOT that holds release images. Never served by /uploads. */
export const FIRMWARE_SUBDIR = 'firmware';
export const FIRMWARE_ROOT = path.join(UPLOAD_ROOT, FIRMWARE_SUBDIR);

// src/core and dist/core sit at the same depth, so this resolves to
// <project>/keys in dev (tsx) and /app/keys in the Docker image.
export const DEFAULT_PUBKEY_PATH = path.resolve(__dirname, '..', '..', 'keys', 'firmware-signing-public.pem');

export function firmwarePubkeyPath(): string {
  return process.env.FIRMWARE_PUBKEY_PATH || DEFAULT_PUBKEY_PATH;
}

let cachedKey: { path: string; key: KeyObject } | null = null;

function signingKey(): KeyObject {
  const keyPath = firmwarePubkeyPath();
  if (cachedKey?.path === keyPath) return cachedKey.key;
  let pem: string;
  try {
    pem = fs.readFileSync(keyPath, 'utf8');
  } catch {
    throw new HttpError(500, 'FIRMWARE_KEY_MISSING', `Firmware signing public key not found at ${keyPath}`);
  }
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new HttpError(500, 'FIRMWARE_KEY_INVALID', `Firmware signing key at ${keyPath} is not an ECDSA P-256 key`);
  }
  cachedKey = { path: keyPath, key };
  return key;
}

const manifestSchema = z.object({
  version: z.string().regex(FIRMWARE_VERSION_RE, 'version must be 1-40 characters of A-Z a-z 0-9 . _ + -'),
  size: z.number().int().positive(),
  sha256: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'sha256 must be 64 hex characters')
    .transform((s) => s.toLowerCase()),
  signature: z
    .string()
    .min(8)
    .max(200)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'signature must be standard base64'),
  createdAt: z.string().max(64).optional(),
  keyFingerprint: z.string().max(64).optional(),
});
export type FirmwareManifest = z.infer<typeof manifestSchema>;

export function parseManifest(text: string): FirmwareManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw BadRequest('manifest is not valid JSON');
  }
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw BadRequest('manifest is missing fields or has bad values', parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

/**
 * Every check the server makes on an image before it can be offered. Throws a
 * 400 naming the first one that fails.
 */
export function validateFirmwareImage(bin: Buffer, manifestText: string): FirmwareManifest {
  const manifest = parseManifest(manifestText);
  if (bin.length !== manifest.size) {
    throw BadRequest(`File is ${bin.length} bytes but the manifest says ${manifest.size}`);
  }
  if (bin.length > MAX_IMAGE_BYTES) {
    throw BadRequest(`Image is ${bin.length} bytes; the ESP32 app slot holds at most ${MAX_IMAGE_BYTES}`);
  }
  if (bin.length <= MIN_IMAGE_BYTES) {
    throw BadRequest(`Image is only ${bin.length} bytes; a real build is larger than ${MIN_IMAGE_BYTES}`);
  }
  if (bin[0] !== ESP_IMAGE_MAGIC) {
    throw BadRequest('Not an ESP32 app image (first byte is not 0xE9). Upload firmware.bin, not a merged/factory image.');
  }
  const sha256 = createHash('sha256').update(bin).digest('hex');
  if (sha256 !== manifest.sha256) {
    throw BadRequest('sha256 of the file does not match the manifest (wrong or corrupted file)');
  }
  let ok = false;
  try {
    ok = verifySignature(
      'sha256',
      bin,
      { key: signingKey(), dsaEncoding: 'der' },
      Buffer.from(manifest.signature, 'base64')
    );
  } catch (e) {
    if (e instanceof HttpError) throw e;
    ok = false;
  }
  if (!ok) {
    throw BadRequest('Signature does not verify with the server firmware key; sign the image with the release key');
  }
  return manifest;
}

/** Validate, store the image under UPLOAD_ROOT/firmware/<id>.bin and create the release (rollout OFF). */
export async function registerFirmwareRelease(args: {
  bin: Buffer;
  manifestText: string;
  notes?: string | null;
  actorUserId: string | null;
}): Promise<FirmwareRelease> {
  const manifest = validateFirmwareImage(args.bin, args.manifestText);
  const notes = args.notes?.trim() ? args.notes.trim().slice(0, 2000) : null;
  const existing = await prisma.firmwareRelease.findUnique({ where: { version: manifest.version } });
  if (existing) throw Conflict(`Version ${manifest.version} is already uploaded`);

  const id = randomUUID();
  const filePath = `${FIRMWARE_SUBDIR}/${id}.bin`;
  const absPath = path.join(UPLOAD_ROOT, filePath);
  await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
  const partPath = `${absPath}.part`;
  await fs.promises.writeFile(partPath, args.bin);
  await fs.promises.rename(partPath, absPath);

  try {
    return await prisma.$transaction(async (tx) => {
      const release = await tx.firmwareRelease.create({
        data: {
          id,
          version: manifest.version,
          sizeBytes: args.bin.length,
          sha256: manifest.sha256,
          signature: manifest.signature,
          notes,
          filePath,
          createdById: args.actorUserId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: args.actorUserId,
          action: 'FIRMWARE_RELEASE_CREATE',
          entity: 'FirmwareRelease',
          entityId: release.id,
          after: JSON.stringify({
            version: release.version,
            sizeBytes: release.sizeBytes,
            sha256: release.sha256,
            keyFingerprint: manifest.keyFingerprint ?? null,
          }),
        },
      });
      return release;
    });
  } catch (e) {
    await fs.promises.rm(absPath, { force: true });
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw Conflict(`Version ${manifest.version} is already uploaded`);
    }
    throw e;
  }
}

export interface ReleasePatch {
  rollout?: Rollout;
  testSerials?: string[];
  installNow?: boolean;
  notes?: string | null;
}

/** Trim, drop blanks, de-duplicate (first one wins). */
export function normalizeSerials(serials: string[]): string[] {
  return Array.from(new Set(serials.map((s) => s.trim()).filter(Boolean)));
}

/** Change who is offered a release. Every test serial must be a known device. */
export async function updateFirmwareRelease(
  id: string,
  patch: ReleasePatch,
  actorUserId: string | null
): Promise<FirmwareRelease> {
  const release = await prisma.firmwareRelease.findUnique({ where: { id } });
  if (!release) throw NotFound('Firmware release not found');

  const data: Prisma.FirmwareReleaseUpdateInput = {};
  if (patch.rollout !== undefined) data.rollout = patch.rollout;
  if (patch.installNow !== undefined) data.installNow = patch.installNow;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() ? patch.notes.trim() : null;
  if (patch.testSerials !== undefined) {
    const serials = normalizeSerials(patch.testSerials);
    const found = serials.length
      ? await prisma.device.findMany({ where: { serial: { in: serials } }, select: { serial: true } })
      : [];
    const known = new Set(found.map((d) => d.serial));
    const unknown = serials.filter((s) => !known.has(s));
    if (unknown.length) {
      throw BadRequest(`Unknown device serial(s): ${unknown.join(', ')}`, { testSerials: unknown });
    }
    data.testSerials = serials;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.firmwareRelease.update({ where: { id }, data });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: 'FIRMWARE_ROLLOUT',
        entity: 'FirmwareRelease',
        entityId: id,
        before: JSON.stringify({
          version: release.version,
          rollout: release.rollout,
          testSerials: release.testSerials,
          installNow: release.installNow,
        }),
        after: JSON.stringify({
          version: updated.version,
          rollout: updated.rollout,
          testSerials: updated.testSerials,
          installNow: updated.installNow,
        }),
      },
    });
    return updated;
  });
}

export type ReleaseCounts = {
  onThisVersion: number;
  offered: number;
  downloading: number;
  installed: number;
  /** FAILED plus ROLLED_BACK. */
  failed: number;
  rolledBack: number;
};

/** How many units run each release, and where the rest are in the update. */
export async function releaseCounts(releases: FirmwareRelease[]): Promise<Map<string, ReleaseCounts>> {
  const out = new Map<string, ReleaseCounts>();
  for (const r of releases) {
    out.set(r.id, { onThisVersion: 0, offered: 0, downloading: 0, installed: 0, failed: 0, rolledBack: 0 });
  }
  if (!releases.length) return out;

  const [byStatus, byVersion] = await Promise.all([
    prisma.device.groupBy({
      by: ['otaReleaseId', 'otaStatus'],
      where: { otaReleaseId: { in: releases.map((r) => r.id) } },
      _count: { _all: true },
    }),
    prisma.device.groupBy({
      by: ['firmwareVersion'],
      where: { firmwareVersion: { in: releases.map((r) => r.version) } },
      _count: { _all: true },
    }),
  ]);
  for (const row of byStatus) {
    const c = row.otaReleaseId ? out.get(row.otaReleaseId) : undefined;
    if (!c) continue;
    const n = row._count._all;
    if (row.otaStatus === 'OFFERED') c.offered += n;
    else if (row.otaStatus === 'DOWNLOADING') c.downloading += n;
    else if (row.otaStatus === 'INSTALLED') c.installed += n;
    else if (row.otaStatus === 'FAILED') c.failed += n;
    else if (row.otaStatus === 'ROLLED_BACK') {
      c.failed += n;
      c.rolledBack += n;
    }
  }
  const versionCount = new Map(byVersion.map((row) => [row.firmwareVersion, row._count._all]));
  for (const r of releases) out.get(r.id)!.onThisVersion = versionCount.get(r.version) ?? 0;
  return out;
}

// ─────────────────────────── What a purifier is offered ───────────────────────────

export type FirmwareOffer = {
  id: string;
  version: string;
  size: number;
  sha256: string;
  signature: string;
  installNow: boolean;
  /** Bumped by each admin Retry. The chip keeps its own try count and resets it when this changes. */
  retryGen: number;
};

type OtaDevice = {
  id: string;
  serial: string;
  firmwareVersion: string | null;
  otaReleaseId: string | null;
  otaStatus: string | null;
  otaAttempts: number;
  otaRetryGen: number;
};

/** The newest release rolled out to this unit: rollout ALL, or TEST with the serial listed. */
export function newestReleaseFor(serial: string) {
  return prisma.firmwareRelease.findFirst({
    where: { OR: [{ rollout: 'ALL' }, { rollout: 'TEST', testSerials: { has: serial } }] },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

/** Whether a unit may fetch the image: rolled out to it, or the release it was offered. */
export function mayDownload(release: Pick<FirmwareRelease, 'id' | 'rollout' | 'testSerials'>, device: OtaDevice): boolean {
  if (release.rollout === 'ALL') return true;
  if (release.rollout !== 'TEST') return false;
  return release.testSerials.includes(device.serial) || device.otaReleaseId === release.id;
}

/**
 * Runs on every /state poll. Records the version the chip says it is running
 * (X-Firmware-Version), marks the offered release INSTALLED once the chip
 * runs it, and returns the release to offer, if any.
 */
export async function syncDeviceFirmware(device: OtaDevice, reportedVersion?: string): Promise<FirmwareOffer | null> {
  const now = new Date();
  const data: Prisma.DeviceUpdateInput = {};
  let otaStatus = device.otaStatus;

  if (reportedVersion) {
    if (reportedVersion !== device.firmwareVersion) data.firmwareVersion = reportedVersion;
    if (device.otaReleaseId && device.otaStatus !== 'INSTALLED') {
      const offered = await prisma.firmwareRelease.findUnique({
        where: { id: device.otaReleaseId },
        select: { version: true },
      });
      if (offered?.version === reportedVersion) {
        otaStatus = 'INSTALLED';
        Object.assign(data, { otaStatus, otaError: null, otaUpdatedAt: now });
      }
    }
  }

  const currentVersion = reportedVersion ?? device.firmwareVersion;
  let offer: FirmwareOffer | null = null;
  const release = await newestReleaseFor(device.serial);
  // otaAttempts only grows on FAILED or ROLLED_BACK reports, and resets when
  // a different release is offered or an admin presses Retry. So 3 bad tries
  // of the same release stop the offers, whether it failed or rolled back.
  const gaveUp =
    release &&
    device.otaReleaseId === release.id &&
    otaStatus !== 'INSTALLED' &&
    device.otaAttempts >= MAX_FAILED_ATTEMPTS;
  if (release && release.version !== currentVersion && !gaveUp) {
    offer = {
      id: release.id,
      version: release.version,
      size: release.sizeBytes,
      sha256: release.sha256,
      signature: release.signature,
      installNow: release.installNow,
      retryGen: device.otaRetryGen,
    };
    if (device.otaReleaseId !== release.id) {
      Object.assign(data, {
        otaRelease: { connect: { id: release.id } },
        otaStatus: 'OFFERED',
        otaAttempts: 0,
        otaError: null,
        otaUpdatedAt: now,
      });
    } else if (otaStatus !== 'OFFERED' && otaStatus !== 'DOWNLOADING') {
      Object.assign(data, { otaStatus: 'OFFERED', otaUpdatedAt: now });
    }
  }

  if (Object.keys(data).length) await prisma.device.update({ where: { id: device.id }, data });
  return offer;
}

/** A purifier's progress report on a release (POST /devices/:serial/ota-report). */
export async function recordOtaReport(
  device: OtaDevice & { otaError: string | null },
  report: { releaseId: string; status: OtaReportStatus; error?: string; version?: string }
): Promise<void> {
  const release = await prisma.firmwareRelease.findUnique({ where: { id: report.releaseId } });
  if (!release) throw NotFound('Firmware release not found');

  const sameRelease = device.otaReleaseId === release.id;
  const failed = report.status === 'FAILED' || report.status === 'ROLLED_BACK';
  const attempts = (sameRelease ? device.otaAttempts : 0) + (failed ? 1 : 0);
  let otaError: string | null;
  if (report.status === 'INSTALLED') otaError = null;
  else if (failed) otaError = report.error ?? null;
  else otaError = report.error ?? (sameRelease ? device.otaError : null);

  await prisma.$transaction(async (tx) => {
    await tx.device.update({
      where: { id: device.id },
      data: {
        otaRelease: { connect: { id: release.id } },
        otaStatus: report.status,
        otaAttempts: attempts,
        otaError,
        otaUpdatedAt: new Date(),
        ...(report.version && report.version !== device.firmwareVersion ? { firmwareVersion: report.version } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: null,
        action: `DEVICE_OTA_${report.status}`,
        entity: 'Device',
        entityId: device.id,
        before: JSON.stringify({
          otaReleaseId: device.otaReleaseId,
          otaStatus: device.otaStatus,
          otaAttempts: device.otaAttempts,
        }),
        after: JSON.stringify({
          serial: device.serial,
          releaseId: release.id,
          releaseVersion: release.version,
          reportedVersion: report.version ?? null,
          otaAttempts: attempts,
          error: report.error ?? null,
        }),
      },
    });
  });
}
