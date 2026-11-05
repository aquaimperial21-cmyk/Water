// Daily morning — for each active technician with a whatsappNumber, builds a
// summary of their jobs for today and dispatches a WhatsApp message.

import { prisma } from '../core/prisma';
import { dispatch } from '../services/notifications';

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export async function runTechSchedule(): Promise<{ techs: number; sent: number }> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const techs = await prisma.technician.findMany({
    where: { status: 'ACTIVE', whatsappNumber: { not: null } },
    include: { user: true },
  });

  let sent = 0;

  for (const t of techs) {
    const jobs = await prisma.job.findMany({
      where: {
        technicianId: t.id,
        scheduledFor: { gte: start, lt: end },
        status: { in: ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS'] },
      },
      include: { ticket: { include: { user: true } } },
      orderBy: { scheduledFor: 'asc' },
    });

    const lines = jobs.length
      ? jobs
          .map((j, i) => {
            const at = fmtTime(j.scheduledFor);
            const what = j.type;
            const who = j.ticket?.user?.fullName ?? 'customer';
            const tid = j.ticket?.id?.slice(-6).toUpperCase() ?? '—';
            return `${i + 1}. ${at} · ${what} · ${who} · #${tid}`;
          })
          .join('\n')
      : 'No jobs today. Rest up — we will ping when something comes in.';

    const r = await dispatch({
      userId: t.userId,
      to: t.whatsappNumber!,
      channel: 'WHATSAPP',
      templateKey: 'tech.schedule.daily',
      vars: {
        name: t.user.fullName ?? 'team',
        date: start.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' }),
        jobs: lines,
      },
      idempotencyDate: start,
    });
    if (r.sent) sent++;
  }

  // eslint-disable-next-line no-console
  console.log(`[cron:tech-schedule] techs=${techs.length} sent=${sent}`);
  return { techs: techs.length, sent };
}
