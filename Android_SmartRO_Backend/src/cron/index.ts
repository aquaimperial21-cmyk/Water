// Cron registry. Started from server.ts after the HTTP listener boots.
// CRON_DISABLED=1 short-circuits all jobs (used in tests + during smoke runs).

import cron from 'node-cron';
import { runExpiryReminders } from './expiry-reminders';
import { runTechSchedule } from './tech-schedule';
import { runReadingRetention } from './reading-retention';

export function registerCronJobs(): void {
  if (process.env.CRON_DISABLED === '1') {
    // eslint-disable-next-line no-console
    console.log('[cron] disabled via CRON_DISABLED=1');
    return;
  }

  // Daily 09:00 IST = 03:30 UTC — recharge reminders (7 / 3 / 1 day windows)
  cron.schedule(
    '30 3 * * *',
    () => {
      runExpiryReminders().catch((e) => console.error('[cron:expiry] error', e));
    },
    { timezone: 'UTC' },
  );

  // Daily 07:30 IST = 02:00 UTC — technician daily schedule WhatsApp
  cron.schedule(
    '0 2 * * *',
    () => {
      runTechSchedule().catch((e) => console.error('[cron:tech-schedule] error', e));
    },
    { timezone: 'UTC' },
  );

  // Daily 02:30 UTC — DeviceReading retention (delete telemetry > 90 days).
  // Caps the unbounded growth from per-minute ESP32 heartbeats.
  cron.schedule(
    '30 2 * * *',
    () => {
      runReadingRetention().catch((e) => console.error('[cron:reading-retention] error', e));
    },
    { timezone: 'UTC' },
  );

  // eslint-disable-next-line no-console
  console.log(
    '[cron] registered: expiry-reminders @ 09:00 IST, tech-schedule @ 07:30 IST, reading-retention @ 02:30 UTC'
  );
}

// Re-export for manual invocation (smoke tests + admin "run now" button).
export { runExpiryReminders, runTechSchedule, runReadingRetention };
