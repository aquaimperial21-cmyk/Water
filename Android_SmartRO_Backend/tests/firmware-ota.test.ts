// Remote firmware updates: upload checks, who is offered what in /state, the
// token-only image download, progress reports and the 3-failure stop, and
// that images never leak through the public /uploads handler.
//
// Signs with a throwaway P-256 key generated here (FIRMWARE_PUBKEY_PATH);
// the real release key is never needed. Images are stored in a temp
// UPLOAD_DIR so the repo's uploads/ folder is untouched.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

const tmp = await vi.hoisted(async () => {
  const os = await import('node:os');
  const fsMod = await import('node:fs');
  const pathMod = await import('node:path');
  const dir = fsMod.mkdtempSync(pathMod.join(os.tmpdir(), 'smartro-ota-'));
  process.env.UPLOAD_DIR = pathMod.join(dir, 'uploads');
  process.env.FIRMWARE_PUBKEY_PATH = pathMod.join(dir, 'test-signing-public.pem');
  return { dir };
});

import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';
import { UPLOAD_ROOT } from '../src/modules/upload';
import { MAX_IMAGE_BYTES, MIN_IMAGE_BYTES } from '../src/core/firmware';

const app = buildApp();
const tag = crypto.randomBytes(4).toString('hex').toUpperCase();
const V1 = `9.0.1-t${tag}`;
const V2 = `9.0.2-t${tag}`;
const IMAGE_SIZE = 200 * 1024;

const signer = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const stranger = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

let adminId = '';
let adminToken = '';
const customerToken = signAccessToken({ sub: 'not-an-admin', kind: 'CUSTOMER' });
let productId = '';
const devices: Record<'A' | 'B', { id: string; serial: string; token: string }> = {
  A: { id: '', serial: '', token: '' },
  B: { id: '', serial: '', token: '' },
};
const releaseIds: string[] = [];
let rel1 = { id: '', bin: Buffer.alloc(0), filePath: '' };
let rel2 = { id: '', bin: Buffer.alloc(0) };

const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

function makeImage(size = IMAGE_SIZE, magic = 0xe9) {
  const b = crypto.randomBytes(size);
  b[0] = magic;
  return b;
}

function manifestFor(bin: Buffer, version: string, over: Record<string, unknown> = {}, key = signer.privateKey) {
  return {
    version,
    size: bin.length,
    sha256: sha(bin),
    signature: crypto.sign('sha256', bin, { key, dsaEncoding: 'der' }).toString('base64'),
    createdAt: new Date().toISOString(),
    keyFingerprint: '0123456789abcdef',
    ...over,
  };
}

function uploadRelease(bin: Buffer, manifest: object | string, notes?: string, token = adminToken) {
  const r = request(app)
    .post('/api/v1/firmware/admin/releases')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', bin, { filename: 'firmware.bin', contentType: 'application/octet-stream' })
    .field('manifest', typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
  return notes ? r.field('notes', notes) : r;
}

const patchRelease = (id: string, body: object) =>
  request(app).patch(`/api/v1/firmware/admin/releases/${id}`).set('Authorization', `Bearer ${adminToken}`).send(body);

function poll(which: 'A' | 'B', fwVersion?: string) {
  const r = request(app).get(`/api/v1/devices/${devices[which].serial}/state`).set('X-Device-Token', devices[which].token);
  return fwVersion ? r.set('X-Firmware-Version', fwVersion) : r;
}

function report(which: 'A' | 'B', body: object) {
  return request(app)
    .post(`/api/v1/devices/${devices[which].serial}/ota-report`)
    .set('X-Device-Token', devices[which].token)
    .send(body);
}

const binaryParser = (res: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

function download(which: 'A' | 'B', releaseId: string, token = devices[which].token) {
  return request(app)
    .get(`/api/v1/devices/${devices[which].serial}/firmware/${releaseId}`)
    .set('X-Device-Token', token)
    .buffer(true)
    .parse(binaryParser);
}

const otaOf = (which: 'A' | 'B') =>
  prisma.device.findUniqueOrThrow({
    where: { id: devices[which].id },
    select: { firmwareVersion: true, otaReleaseId: true, otaStatus: true, otaError: true, otaAttempts: true, otaUpdatedAt: true },
  });

const firmwareFiles = () => {
  const dir = path.join(UPLOAD_ROOT, 'firmware');
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

beforeAll(async () => {
  fs.writeFileSync(process.env.FIRMWARE_PUBKEY_PATH!, signer.publicKey.export({ type: 'spki', format: 'pem' }));
  const admin = await prisma.user.findFirstOrThrow({ where: { kind: 'ADMIN' } });
  adminId = admin.id;
  adminToken = signAccessToken({ sub: admin.id, kind: 'ADMIN' });
  productId = (await prisma.product.findFirstOrThrow()).id;
  for (const which of ['A', 'B'] as const) {
    const serial = `SR-OTA-${tag}-${which}`;
    const token = crypto.randomBytes(24).toString('base64url');
    const d = await prisma.device.create({
      data: { serial, qr: `QR-OTA-${tag}-${which}`, productId, status: 'INSTALLED', deviceToken: token, firmwareVersion: '1.0.0' },
    });
    devices[which] = { id: d.id, serial, token };
  }
});

afterAll(async () => {
  const deviceIds = [devices.A.id, devices.B.id].filter(Boolean);
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entity: 'Device', entityId: { in: deviceIds } },
        { entity: 'FirmwareRelease', entityId: { in: releaseIds } },
      ],
    },
  });
  await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
  await prisma.firmwareRelease.deleteMany({ where: { id: { in: releaseIds } } });
  await prisma.$disconnect();
  fs.rmSync(tmp.dir, { recursive: true, force: true });
});

describe('POST /firmware/admin/releases', () => {
  it('stores images in the test upload folder', () => {
    expect(UPLOAD_ROOT).toBe(path.resolve(tmp.dir, 'uploads'));
  });

  it('accepts a signed image and starts it with rollout OFF', async () => {
    const bin = makeImage();
    const r = await uploadRelease(bin, manifestFor(bin, V1), 'First test build');
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const rel = r.body.data;
    releaseIds.push(rel.id);
    expect(rel).toMatchObject({
      version: V1,
      sizeBytes: bin.length,
      sha256: sha(bin),
      notes: 'First test build',
      rollout: 'OFF',
      testSerials: [],
      installNow: false,
      createdById: adminId,
      filePath: `firmware/${rel.id}.bin`,
      counts: { onThisVersion: 0, offered: 0, downloading: 0, installed: 0, failed: 0 },
    });
    expect(fs.readFileSync(path.join(UPLOAD_ROOT, rel.filePath)).equals(bin)).toBe(true);
    const audit = await prisma.auditLog.findFirst({ where: { action: 'FIRMWARE_RELEASE_CREATE', entityId: rel.id } });
    expect(audit).toMatchObject({ actorUserId: adminId, entity: 'FirmwareRelease' });
    rel1 = { id: rel.id, bin, filePath: rel.filePath };
  });

  it('is admin only', async () => {
    const bin = makeImage();
    expect((await uploadRelease(bin, manifestFor(bin, `${V1}-x`), undefined, customerToken)).status).toBe(403);
    const anon = await request(app).post('/api/v1/firmware/admin/releases');
    expect(anon.status).toBe(401);
  });

  it('rejects a signature from another key', async () => {
    const bin = makeImage();
    const r = await uploadRelease(bin, manifestFor(bin, `${V1}-badsig`, {}, stranger.privateKey));
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/Signature/);
  });

  it('rejects a signature over different bytes', async () => {
    const bin = makeImage();
    const other = makeImage();
    const sig = crypto.sign('sha256', other, { key: signer.privateKey, dsaEncoding: 'der' }).toString('base64');
    const r = await uploadRelease(bin, manifestFor(bin, `${V1}-badsig2`, { signature: sig }));
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/Signature/);
  });

  it('rejects a sha256 that does not match the file', async () => {
    const bin = makeImage();
    const r = await uploadRelease(bin, manifestFor(bin, `${V1}-sha`, { sha256: sha(makeImage()) }));
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/sha256/);
  });

  it('rejects a size that does not match the file', async () => {
    const bin = makeImage();
    const r = await uploadRelease(bin, manifestFor(bin, `${V1}-size`, { size: bin.length - 1 }));
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/manifest says/);
  });

  it('rejects an image bigger than the app slot', async () => {
    const bin = makeImage(MAX_IMAGE_BYTES + 1);
    const r = await uploadRelease(bin, manifestFor(bin, `${V1}-big`));
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/app slot/);
  });

  it('rejects an image of 64 KB or less', async () => {
    const bin = makeImage(MIN_IMAGE_BYTES);
    const r = await uploadRelease(bin, manifestFor(bin, `${V1}-small`));
    expect(r.status).toBe(400);
  });

  it('rejects a file that is not an ESP32 app image', async () => {
    const bin = makeImage(IMAGE_SIZE, 0x00);
    const r = await uploadRelease(bin, manifestFor(bin, `${V1}-magic`));
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/0xE9/);
  });

  it('rejects a broken manifest or a bad version', async () => {
    const bin = makeImage();
    expect((await uploadRelease(bin, 'not json')).status).toBe(400);
    expect((await uploadRelease(bin, { version: V1 })).status).toBe(400);
    expect((await uploadRelease(bin, manifestFor(bin, 'has space'))).status).toBe(400);
    const noManifest = await request(app)
      .post('/api/v1/firmware/admin/releases')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', bin, 'firmware.bin');
    expect(noManifest.status).toBe(400);
  });

  it('rejects a version that is already uploaded', async () => {
    const bin = makeImage();
    const r = await uploadRelease(bin, manifestFor(bin, V1));
    expect(r.status).toBe(409);
  });

  it('keeps no file from a rejected upload', () => {
    expect(firmwareFiles()).toEqual([`${rel1.id}.bin`]);
  });
});

describe('Offer in GET /devices/:serial/state', () => {
  it('has no firmware key while the rollout is OFF', async () => {
    for (const which of ['A', 'B'] as const) {
      const r = await poll(which);
      expect(r.status).toBe(200);
      expect(r.body.data).not.toHaveProperty('firmware');
      expect(r.body.data).toMatchObject({ allowFlow: false, status: 'NO_SUBSCRIPTION', pollIntervalSec: 3600 });
      expect(r.body.data).toHaveProperty('serverTime');
    }
    expect((await otaOf('A')).otaStatus).toBeNull();
  });

  it('PATCH refuses unknown test serials and lists them', async () => {
    const r = await patchRelease(rel1.id, { rollout: 'TEST', testSerials: [devices.A.serial, 'SR-NO-SUCH-1', 'SR-NO-SUCH-2'] });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toContain('SR-NO-SUCH-1');
    expect(r.body.error.fields).toEqual({ testSerials: ['SR-NO-SUCH-1', 'SR-NO-SUCH-2'] });
    expect((await prisma.firmwareRelease.findUniqueOrThrow({ where: { id: rel1.id } })).rollout).toBe('OFF');
  });

  it('PATCH 404s for an unknown release and is admin only', async () => {
    expect((await patchRelease(crypto.randomUUID(), { rollout: 'ALL' })).status).toBe(404);
    const r = await request(app)
      .patch(`/api/v1/firmware/admin/releases/${rel1.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rollout: 'ALL' });
    expect(r.status).toBe(403);
  });

  it('TEST offers the release only to listed serials', async () => {
    const p = await patchRelease(rel1.id, { rollout: 'TEST', testSerials: [` ${devices.A.serial} `, devices.A.serial, ''] });
    expect(p.status).toBe(200);
    expect(p.body.data).toMatchObject({ rollout: 'TEST', testSerials: [devices.A.serial] });
    expect(await prisma.auditLog.count({ where: { action: 'FIRMWARE_ROLLOUT', entityId: rel1.id } })).toBe(1);

    const a = await poll('A');
    expect(a.body.data.firmware).toEqual({
      id: rel1.id,
      version: V1,
      size: rel1.bin.length,
      sha256: sha(rel1.bin),
      signature: expect.any(String), // ECDSA is randomised; compared with the stored one below
      installNow: false,
      retryGen: 0,
    });
    expect(a.body.data).toMatchObject({ allowFlow: false, status: 'NO_SUBSCRIPTION' });
    const b = await poll('B');
    expect(b.body.data).not.toHaveProperty('firmware');

    expect(await otaOf('A')).toMatchObject({ otaReleaseId: rel1.id, otaStatus: 'OFFERED', otaAttempts: 0 });
    expect((await otaOf('B')).otaReleaseId).toBeNull();
  });

  it('offers the signature from the manifest and installNow from the release', async () => {
    const stored = await prisma.firmwareRelease.findUniqueOrThrow({ where: { id: rel1.id } });
    await patchRelease(rel1.id, { installNow: true });
    const a = await poll('A');
    expect(a.body.data.firmware).toMatchObject({ signature: stored.signature, installNow: true });
    await patchRelease(rel1.id, { installNow: false });
  });
});

describe('GET /devices/:serial/firmware/:releaseId', () => {
  it('returns the exact image to a unit it is rolled out to', async () => {
    const r = await download('A', rel1.id);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/octet-stream');
    expect(Number(r.headers['content-length'])).toBe(rel1.bin.length);
    expect(Buffer.isBuffer(r.body)).toBe(true);
    expect((r.body as Buffer).equals(rel1.bin)).toBe(true);
  });

  it('404s for a unit outside the TEST list, an unknown release, and 401s without the token', async () => {
    const b = await download('B', rel1.id);
    expect(b.status).toBe(404);
    expect(JSON.parse((b.body as Buffer).toString('utf8'))).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect((await download('A', crypto.randomUUID())).status).toBe(404);
    expect((await download('A', rel1.id, 'wrong-token')).status).toBe(401);
  });
});

describe('X-Firmware-Version on /state', () => {
  it('ignores a malformed header', async () => {
    const r = await poll('A', 'bad version!!');
    expect(r.status).toBe(200);
    expect(r.body.data.firmware.id).toBe(rel1.id);
    expect((await otaOf('A')).firmwareVersion).toBe('1.0.0');
  });

  it('stores the running version', async () => {
    const r = await poll('A', '1.0.1');
    expect(r.body.data.firmware.id).toBe(rel1.id);
    expect(await otaOf('A')).toMatchObject({ firmwareVersion: '1.0.1', otaStatus: 'OFFERED' });
  });

  it('marks the offered release INSTALLED once the chip runs it, and stops offering it', async () => {
    const r = await poll('A', V1);
    expect(r.body.data).not.toHaveProperty('firmware');
    expect(await otaOf('A')).toMatchObject({ firmwareVersion: V1, otaReleaseId: rel1.id, otaStatus: 'INSTALLED' });
    const again = await poll('A');
    expect(again.body.data).not.toHaveProperty('firmware');
  });

  it('ALL offers to every unit, except one already on that version', async () => {
    try {
      expect((await patchRelease(rel1.id, { rollout: 'ALL' })).status).toBe(200);
      const b = await poll('B');
      expect(b.body.data.firmware).toMatchObject({ id: rel1.id, version: V1 });
      expect(await otaOf('B')).toMatchObject({ otaReleaseId: rel1.id, otaStatus: 'OFFERED' });
      expect((await poll('A')).body.data).not.toHaveProperty('firmware');
      expect((await poll('A', V1)).body.data).not.toHaveProperty('firmware');

      const installed = await poll('B', V1);
      expect(installed.body.data).not.toHaveProperty('firmware');
      expect(await otaOf('B')).toMatchObject({ firmwareVersion: V1, otaStatus: 'INSTALLED' });
    } finally {
      await patchRelease(rel1.id, { rollout: 'TEST', testSerials: [devices.A.serial] });
    }
  });
});

describe('POST /devices/:serial/ota-report', () => {
  it('a unit back on an older version is offered the release again', async () => {
    const r = await poll('A', '1.0.1');
    expect(r.body.data.firmware.id).toBe(rel1.id);
    expect(await otaOf('A')).toMatchObject({ firmwareVersion: '1.0.1', otaStatus: 'OFFERED', otaAttempts: 0 });
  });

  it('DOWNLOADING is kept while the offer stands', async () => {
    const r = await report('A', { releaseId: rel1.id, status: 'DOWNLOADING' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ data: { ok: true } });
    expect(await otaOf('A')).toMatchObject({ otaStatus: 'DOWNLOADING', otaAttempts: 0 });
    expect((await poll('A', '1.0.1')).body.data.firmware.id).toBe(rel1.id);
    expect((await otaOf('A')).otaStatus).toBe('DOWNLOADING');
    const audit = await prisma.auditLog.findFirst({ where: { action: 'DEVICE_OTA_DOWNLOADING', entityId: devices.A.id } });
    expect(audit).toMatchObject({ entity: 'Device', actorUserId: null });
  });

  it('FAILED counts an attempt and keeps the error; the next poll offers again', async () => {
    const r = await report('A', { releaseId: rel1.id, status: 'FAILED', error: 'sha256 mismatch after download' });
    expect(r.status).toBe(200);
    const ota = await otaOf('A');
    expect(ota).toMatchObject({ otaStatus: 'FAILED', otaAttempts: 1, otaError: 'sha256 mismatch after download' });
    expect(ota.otaUpdatedAt).toBeInstanceOf(Date);
    expect(await prisma.auditLog.count({ where: { action: 'DEVICE_OTA_FAILED', entityId: devices.A.id } })).toBe(1);

    expect((await poll('A', '1.0.1')).body.data.firmware.id).toBe(rel1.id);
    expect(await otaOf('A')).toMatchObject({ otaStatus: 'OFFERED', otaAttempts: 1 });
  });

  it('stops offering after 3 failures', async () => {
    await report('A', { releaseId: rel1.id, status: 'FAILED', error: 'timeout' });
    expect((await poll('A', '1.0.1')).body.data.firmware.id).toBe(rel1.id);
    await report('A', { releaseId: rel1.id, status: 'FAILED', error: 'timeout' });
    expect(await otaOf('A')).toMatchObject({ otaStatus: 'FAILED', otaAttempts: 3, otaError: 'timeout' });

    const r = await poll('A', '1.0.1');
    expect(r.body.data).not.toHaveProperty('firmware');
    expect((await otaOf('A')).otaStatus).toBe('FAILED');
  });

  it('validates the body, release and token', async () => {
    expect((await report('A', { releaseId: rel1.id, status: 'DONE' })).status).toBe(400);
    expect((await report('A', { releaseId: rel1.id, status: 'FAILED', error: 'x'.repeat(201) })).status).toBe(400);
    expect((await report('A', { status: 'FAILED' })).status).toBe(400);
    const unknown = await report('A', { releaseId: crypto.randomUUID(), status: 'FAILED' });
    expect(unknown.status).toBe(404);
    const noToken = await request(app)
      .post(`/api/v1/devices/${devices.A.serial}/ota-report`)
      .set('X-Device-Token', 'wrong')
      .send({ releaseId: rel1.id, status: 'FAILED' });
    expect(noToken.status).toBe(401);
    expect(await otaOf('A')).toMatchObject({ otaStatus: 'FAILED', otaAttempts: 3 });
  });

  it('admin retry resets the unit so it is offered again', async () => {
    const r = await request(app)
      .post(`/api/v1/firmware/admin/devices/${devices.A.serial}/retry`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ serial: devices.A.serial, otaStatus: null, otaError: null, otaAttempts: 0 });
    expect(await otaOf('A')).toMatchObject({ otaReleaseId: rel1.id, otaStatus: null, otaError: null, otaAttempts: 0 });

    const offered = (await poll('A', '1.0.1')).body.data.firmware;
    expect(offered.id).toBe(rel1.id);
    // The chip resets its own try count when retryGen changes.
    expect(offered.retryGen).toBe(1);
    expect((await otaOf('A')).otaStatus).toBe('OFFERED');

    const missing = await request(app)
      .post('/api/v1/firmware/admin/devices/SR-NO-SUCH-DEVICE/retry')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missing.status).toBe(404);
  });

  it('ROLLED_BACK counts an attempt and records the version the chip went back to', async () => {
    const r = await report('A', { releaseId: rel1.id, status: 'ROLLED_BACK', error: 'new image failed self-test', version: '1.0.1' });
    expect(r.status).toBe(200);
    expect(await otaOf('A')).toMatchObject({ otaStatus: 'ROLLED_BACK', otaAttempts: 1, firmwareVersion: '1.0.1' });
    expect(await prisma.auditLog.count({ where: { action: 'DEVICE_OTA_ROLLED_BACK', entityId: devices.A.id } })).toBe(1);
  });

  it('stops offering after 3 rollbacks too, even though each re-offer flips the status back to OFFERED', async () => {
    expect((await poll('A', '1.0.1')).body.data.firmware.id).toBe(rel1.id);
    expect((await otaOf('A')).otaStatus).toBe('OFFERED');
    await report('A', { releaseId: rel1.id, status: 'ROLLED_BACK', version: '1.0.1' });
    expect((await poll('A', '1.0.1')).body.data.firmware.id).toBe(rel1.id);
    await report('A', { releaseId: rel1.id, status: 'ROLLED_BACK', version: '1.0.1' });
    expect(await otaOf('A')).toMatchObject({ otaStatus: 'ROLLED_BACK', otaAttempts: 3 });

    expect((await poll('A', '1.0.1')).body.data).not.toHaveProperty('firmware');
    expect((await poll('A', '1.0.1')).body.data).not.toHaveProperty('firmware');
    expect((await otaOf('A')).otaStatus).toBe('ROLLED_BACK');
  });

  it('INSTALLED clears the error and stores the version', async () => {
    const r = await report('A', { releaseId: rel1.id, status: 'INSTALLED', version: V1 });
    expect(r.status).toBe(200);
    expect(await otaOf('A')).toMatchObject({ otaStatus: 'INSTALLED', otaError: null, firmwareVersion: V1 });
    expect((await poll('A', V1)).body.data).not.toHaveProperty('firmware');
  });
});

describe('A newer release', () => {
  it('replaces the offer and starts the attempt count again', async () => {
    await prisma.device.update({ where: { id: devices.A.id }, data: { otaAttempts: 2 } });
    const bin = makeImage(IMAGE_SIZE + 4096);
    const up = await uploadRelease(bin, manifestFor(bin, V2));
    expect(up.status).toBe(201);
    rel2 = { id: up.body.data.id, bin };
    releaseIds.push(rel2.id);
    expect((await patchRelease(rel2.id, { rollout: 'TEST', testSerials: [devices.A.serial] })).status).toBe(200);

    const r = await poll('A', V1);
    expect(r.body.data.firmware).toMatchObject({ id: rel2.id, version: V2, size: bin.length });
    expect(await otaOf('A')).toMatchObject({ otaReleaseId: rel2.id, otaStatus: 'OFFERED', otaAttempts: 0 });
  });

  it('GET /firmware/admin/releases lists newest first with fleet counts', async () => {
    const r = await request(app).get('/api/v1/firmware/admin/releases').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const mine = r.body.data.filter((x: { id: string }) => releaseIds.includes(x.id));
    expect(mine.map((x: { id: string }) => x.id)).toEqual([rel2.id, rel1.id]);
    expect(mine[0].counts).toMatchObject({ onThisVersion: 0, offered: 1, downloading: 0, installed: 0, failed: 0 });
    expect(mine[1].counts).toMatchObject({ onThisVersion: 2, offered: 0, installed: 1 }); // A and B run V1; B is INSTALLED
    expect((await request(app).get('/api/v1/firmware/admin/releases').set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
  });

  it('GET /firmware/admin/devices shows each unit and its update', async () => {
    const r = await request(app).get('/api/v1/firmware/admin/devices').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const a = r.body.data.find((d: { serial: string }) => d.serial === devices.A.serial);
    expect(a).toEqual({
      serial: devices.A.serial,
      firmwareVersion: V1,
      otaReleaseId: rel2.id,
      otaReleaseVersion: V2,
      otaStatus: 'OFFERED',
      otaError: null,
      otaAttempts: 0,
      otaUpdatedAt: expect.any(String),
      lastHeartbeatAt: null,
      isOnline: false,
    });
    expect(JSON.stringify(r.body)).not.toContain(devices.A.token);
  });

  it('turning a rollout OFF stops the offer and the download', async () => {
    expect((await patchRelease(rel2.id, { rollout: 'OFF' })).status).toBe(200);
    expect((await poll('A', V1)).body.data).not.toHaveProperty('firmware');
    expect((await download('A', rel2.id)).status).toBe(404);
    expect((await patchRelease(rel1.id, { rollout: 'OFF' })).status).toBe(200);
    expect((await download('A', rel1.id)).status).toBe(404);
  });
});

describe('Public /uploads', () => {
  it('never serves firmware images', async () => {
    const file = path.basename(rel1.filePath);
    expect(fs.existsSync(path.join(UPLOAD_ROOT, 'firmware', file))).toBe(true);
    for (const url of [
      `/uploads/firmware/${file}`,
      `/uploads/firmware/`,
      `/uploads/FIRMWARE/${file}`,
      `/uploads/%66irmware/${file}`,
      `/uploads//firmware/${file}`,
      `/uploads/products/../firmware/${file}`,
      `/uploads/firmware%2F${file}`,
    ]) {
      const r = await request(app).get(url);
      expect(r.status, url).toBe(404);
      expect(r.headers['content-type'] ?? '', url).not.toContain('octet-stream');
    }
  });

  it('still serves other uploads', async () => {
    fs.mkdirSync(path.join(UPLOAD_ROOT, 'products'), { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_ROOT, 'products', 'ota-test.txt'), 'hello');
    const r = await request(app).get('/uploads/products/ota-test.txt');
    expect(r.status).toBe(200);
    expect(r.text).toBe('hello');
  });
});
