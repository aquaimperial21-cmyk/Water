// Register and roll out purifier firmware without the admin console. Same
// checks as POST /api/v1/firmware/admin/releases (core/firmware.ts).
//
// On the server, inside the API container (the image ships dist/):
//   docker compose cp firmware.bin  api:/tmp/firmware.bin
//   docker compose cp firmware.json api:/tmp/firmware.json
//   docker compose exec api npm run firmware:add -- /tmp/firmware.bin /tmp/firmware.json "Fixes X"
//   docker compose exec api npm run firmware:rollout -- 1.1.0 TEST SR-AP-000105,SR-AP-000106
//   docker compose exec api npm run firmware:rollout -- 1.1.0 ALL --now
//   docker compose exec api npm run firmware:rollout -- 1.1.0 OFF
// (with the `smartro` wrapper: `smartro exec api npm run firmware:add -- ...`)
//
// Locally, without a build: npx tsx src/scripts/firmware.ts add <bin> <manifest> [notes]
//
// rollout: the serial list (comma-separated) replaces the release's test
// list; leave it out to keep the current one. --now makes units install as
// soon as they see the offer; without it installNow is turned off.

import 'dotenv/config';
import fs from 'node:fs';
import { prisma } from '../core/prisma';
import { HttpError } from '../core/errors';
import { ROLLOUTS, registerFirmwareRelease, updateFirmwareRelease, type Rollout } from '../core/firmware';

const USAGE = `Usage:
  npm run firmware:add -- <path-to-bin> <path-to-manifest.json> [notes]
  npm run firmware:rollout -- <version> <OFF|TEST|ALL> [serial,serial,...] [--now]`;

async function add(args: string[]) {
  const [binPath, manifestPath, ...notesParts] = args;
  if (!binPath || !manifestPath) throw new Error(USAGE);
  const release = await registerFirmwareRelease({
    bin: fs.readFileSync(binPath),
    manifestText: fs.readFileSync(manifestPath, 'utf8'),
    notes: notesParts.join(' ') || null,
    actorUserId: null,
  });
  console.log(
    `Added firmware ${release.version} (${release.sizeBytes} bytes, sha256 ${release.sha256})\n` +
      `  id ${release.id}, rollout OFF. Next: npm run firmware:rollout -- ${release.version} TEST <serial>`
  );
}

async function rollout(args: string[]) {
  const now = args.includes('--now');
  const [version, mode, serialList] = args.filter((a) => a !== '--now');
  const rollout = mode?.toUpperCase() as Rollout | undefined;
  if (!version || !rollout || !ROLLOUTS.includes(rollout)) throw new Error(USAGE);

  const release = await prisma.firmwareRelease.findUnique({ where: { version } });
  if (!release) throw new Error(`No firmware release with version ${version}`);
  const testSerials = serialList !== undefined ? serialList.split(',') : undefined;
  const updated = await updateFirmwareRelease(release.id, { rollout, testSerials, installNow: now }, null);
  console.log(
    `Firmware ${updated.version}: rollout ${updated.rollout}, installNow ${updated.installNow}` +
      (updated.rollout === 'TEST' ? `, test serials: ${updated.testSerials.join(', ') || '(none)'}` : '')
  );
  if (updated.rollout === 'TEST' && updated.testSerials.length === 0) {
    console.warn('Warning: rollout TEST with no test serials offers the update to nobody.');
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'add') await add(args);
  else if (command === 'rollout') await rollout(args);
  else throw new Error(USAGE);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e: unknown) => {
    if (e instanceof HttpError) {
      console.error(`Error: ${e.message}`);
      if (e.fields) console.error(JSON.stringify(e.fields, null, 2));
    } else {
      console.error(e instanceof Error ? e.message : e);
    }
    await prisma.$disconnect();
    process.exit(1);
  });
