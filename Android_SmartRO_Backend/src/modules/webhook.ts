// Inbound webhooks from messaging providers (WhatsApp).
// Parses the loosely-shaped payload via the active driver, then resolves the
// sender (must match a Technician.whatsappNumber or User.phone), parses
// keywords (DONE / EN_ROUTE / YES <ticketId>), and advances the matching job.

import { Router } from 'express';
import { prisma } from '../core/prisma';
import { asyncHandler } from '../core/errors';
import { getMessagingDriver } from '../services/messaging';
import { captureCustomerInbound } from './support';
import { allocateDevice } from './device';

const router = Router();

function normalizePhone(p: string): string {
  // Strip non-digits, prepend "+" if missing.
  const digits = p.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (p.startsWith('+')) return '+' + digits;
  // Accept E.164 with country code already; assume Indian if 10-digit.
  if (digits.length === 10) return '+91' + digits;
  return '+' + digits;
}

router.post(
  '/messaging/inbound',
  asyncHandler(async (req, res) => {
    const driver = getMessagingDriver();
    const parsed = driver.parseInboundWebhook(req.body);
    if (!parsed) return res.json({ data: { ok: true, ignored: true } });

    const from = normalizePhone(parsed.from);
    const text = parsed.text.trim();

    // Match technician first (by whatsappNumber, fallback to user.phone)
    const tech = await prisma.technician.findFirst({
      where: {
        OR: [{ whatsappNumber: from }, { user: { phone: from } }],
      },
      include: { user: true },
    });

    // Install pairing keyword — special-cased because it carries a *second*
    // identifier (the device serial) and triggers an atomic allocation.
    //   "INSTALLED SR-AP-000101 BK-1234"
    //   "INSTALLED SR-AP-000101 JOB-5678"
    // The fragment after the serial matches either Booking.id or Job.id by
    // suffix (last 6+ chars), same convention as the other keywords.
    const installM = /^INSTALLED\s+([A-Z0-9-]+)\s+#?([A-Z0-9-]+)/i.exec(text);
    if (tech && installM) {
      const serial = installM[1]!.toUpperCase();
      const fragment = installM[2]!.toLowerCase();
      // Resolve the booking: prefer matching an open INSTALL Job assigned to
      // this technician whose id endsWith fragment, else a Booking id match.
      const installJob = await prisma.job.findFirst({
        where: {
          technicianId: tech.id,
          type: 'INSTALL',
          status: { in: ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS'] },
          OR: [{ id: { endsWith: fragment } }, { bookingId: { endsWith: fragment } }],
        },
        include: { booking: { include: { subscription: true } } },
      });

      let subscriptionId: string | undefined;
      if (installJob?.booking?.subscription?.id) {
        subscriptionId = installJob.booking.subscription.id;
      } else {
        // Fallback: try resolving directly via booking suffix → its subscription
        const booking = await prisma.booking.findFirst({
          where: { id: { endsWith: fragment }, userId: { not: '' } },
          include: { subscription: true },
        });
        if (booking?.subscription) subscriptionId = booking.subscription.id;
      }
      if (subscriptionId) {
        try {
          const allocated = await allocateDevice({
            serial,
            subscriptionId,
            issueToken: true,
            actorUserId: tech.userId,
          });
          return res.json({
            data: { ok: true, allocated: { deviceId: allocated.device.id, serial, subscriptionId } },
          });
        } catch (e) {
          return res.json({
            data: { ok: false, error: (e as Error).message, action: 'INSTALLED', serial, fragment },
          });
        }
      }
      return res.json({ data: { ok: false, error: 'No matching install job/booking', fragment } });
    }

    // Tokens we accept: "DONE TK-XXXX", "EN_ROUTE TK-XXXX", "YES TK-XXXX"
    const m = /^(DONE|EN[_\s]?ROUTE|ENROUTE|YES|START|PROGRESS)\s+#?([A-Z0-9-]+)/i.exec(text);

    if (tech && m) {
      const action = m[1].toUpperCase().replace(/[\s_]/g, '');
      const idFragment = m[2];

      // Find the most recent open job whose ticket id (full or last 6) matches
      const jobs = await prisma.job.findMany({
        where: {
          technicianId: tech.id,
          status: { in: ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS'] },
          OR: [{ ticketId: idFragment }, { ticket: { id: { endsWith: idFragment.toLowerCase() } } }],
        },
        include: { ticket: true },
        orderBy: { scheduledFor: 'desc' },
        take: 1,
      });
      const job = jobs[0];

      if (job) {
        let nextJob: 'EN_ROUTE' | 'IN_PROGRESS' | 'DONE' = 'IN_PROGRESS';
        let nextTicket: 'IN_PROGRESS' | 'RESOLVED' | null = 'IN_PROGRESS';
        if (action === 'DONE') {
          nextJob = 'DONE';
          nextTicket = 'RESOLVED';
        } else if (action === 'ENROUTE') {
          nextJob = 'EN_ROUTE';
          nextTicket = null;
        } else if (action === 'YES' || action === 'START' || action === 'PROGRESS') {
          nextJob = 'IN_PROGRESS';
          nextTicket = 'IN_PROGRESS';
        }

        await prisma.job.update({
          where: { id: job.id },
          data: { status: nextJob, completedAt: nextJob === 'DONE' ? new Date() : null },
        });
        if (job.ticketId && nextTicket) {
          await prisma.ticket.update({ where: { id: job.ticketId }, data: { status: nextTicket } });
        }
        return res.json({ data: { ok: true, jobId: job.id, advancedTo: nextJob } });
      }
    }

    // Otherwise capture as a customer support inbound (or anon waitlist) so
    // the message doesn't fall on the floor.
    await captureCustomerInbound(from, text);
    return res.json({ data: { ok: true, parsed: { from, text }, matched: false, captured: true } });
  })
);

export default router;
