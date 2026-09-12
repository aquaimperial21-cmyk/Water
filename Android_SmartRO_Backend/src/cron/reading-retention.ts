// DeviceReading retention sweep.
//
// At 100 ESP32 units heart-beating every 60 s, the DeviceReading table grows
// by ~4.3 M rows per device per year — ~52 M rows/year total. That's
// manageable on Postgres but pointless to keep forever; product needs only the
// last ~30 days of TDS history for the in-app chart, and aggregate usage is
// already rolled up onto Device.usageLitresTotal.
//
// This cron deletes rows older than READING_RETENTION_DAYS (default 90),
// running nightly at 02:30 UTC. We also keep the most recent LEAK / FILTER_LIFE
// events per device unconditionally — they're tiny and useful for audit.

import { prisma } from '../core/prisma';

const DEFAULT_RETENTION_DAYS = 90;

export async function runReadingRetention(): Promise<{ deleted: number; cutoff: string }> {
  const days = Number(process.env.READING_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Keep all LEAK + FILTER_LIFE rows (low-volume, high-signal). Delete only
  // TDS / USAGE / HEARTBEAT / TEMP older than the cutoff.
  const r = await prisma.deviceReading.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      kind: { in: ['TDS', 'USAGE', 'HEARTBEAT', 'TEMP'] },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`[cron:reading-retention] deleted ${r.count} rows older than ${cutoff.toISOString()}`);
  return { deleted: r.count, cutoff: cutoff.toISOString() };
}
