// Customer-facing document downloads: rental agreement + GST invoice.
//
// Files are generated on-demand and streamed directly to the response — we
// don't cache the PDF to disk yet. Once volume grows it's a one-line change
// to persist to /uploads and stash the path on Invoice.pdfUrl.

import { Router } from 'express';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { NotFound, BadRequest, asyncHandler } from '../core/errors';
import { generateAgreementPdf, generateInvoicePdf } from '../services/pdf';

const router = Router();

router.get(
  '/bookings/:id/agreement.pdf',
  authRequired(['CUSTOMER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { product: true, plan: true, user: true },
    });
    if (!booking) throw NotFound('Booking not found');
    if (req.auth!.kind === 'CUSTOMER' && booking.userId !== req.auth!.sub) throw NotFound('Booking not found');
    if (!booking.agreementSignedAt) throw BadRequest('Agreement is not signed yet');

    const pdf = await generateAgreementPdf({ booking });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="agreement-${booking.id.slice(0, 8)}.pdf"`);
    res.send(pdf);
  })
);

router.get(
  '/invoices/:id.pdf',
  authRequired(['CUSTOMER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { payment: { include: { user: true, booking: { include: { product: true, plan: true } } } } },
    });
    if (!invoice) throw NotFound('Invoice not found');
    if (req.auth!.kind === 'CUSTOMER' && invoice.payment.userId !== req.auth!.sub) throw NotFound('Invoice not found');

    const pdf = await generateInvoicePdf({
      invoice,
      payment: invoice.payment,
      booking: invoice.payment.booking ?? null,
      user: invoice.payment.user,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.number}.pdf"`);
    res.send(pdf);
  })
);

// Convenience: list invoices for the signed-in customer (mobile uses this to
// render a billing history with download buttons).
router.get(
  '/invoices/me',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const items = await prisma.invoice.findMany({
      where: { payment: { userId: req.auth!.sub } },
      include: { payment: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ data: items });
  })
);

export default router;
