// PDF generation for legal/customer-facing docs.
// pdfkit is loaded lazily so the backend can still boot if the dep is not yet
// installed (e.g. on the first developer machine before `npm install`).
//
// Each generator returns a Buffer so the caller can either stream it to the
// HTTP response or persist it to /uploads and store the URL on the row
// (Invoice.pdfUrl).

import type { Booking, Invoice, Payment, Plan, Product, User } from '@prisma/client';

interface PDFDocLike {
  on(event: 'data' | 'end', cb: (chunk?: Buffer) => void): PDFDocLike;
  fontSize(size: number): PDFDocLike;
  font(name: string): PDFDocLike;
  fillColor(c: string): PDFDocLike;
  text(s: string, opts?: object): PDFDocLike;
  text(s: string, x: number, y: number, opts?: object): PDFDocLike;
  moveDown(lines?: number): PDFDocLike;
  moveTo(x: number, y: number): PDFDocLike;
  lineTo(x: number, y: number): PDFDocLike;
  stroke(): PDFDocLike;
  end(): void;
  y: number;
  page: { width: number; height: number; margins: { left: number; right: number; top: number; bottom: number } };
}

async function buildPdf(write: (doc: PDFDocLike) => void): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFDocument = require('pdfkit');
  const doc: PDFDocLike = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    try {
      write(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generateAgreementPdf(args: {
  booking: Booking & { product: Product; plan: Plan; user: User };
}): Promise<Buffer> {
  const { booking } = args;
  return buildPdf((doc) => {
    doc.fontSize(20).font('Helvetica-Bold').text('SmartRO Rental Agreement', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Agreement ID: AGR-${booking.id.slice(0, 8).toUpperCase()}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fillColor('#111').font('Helvetica-Bold').fontSize(12).text('Customer');
    doc.font('Helvetica').fontSize(11).text(booking.user.fullName ?? booking.user.phone);
    doc.text(booking.user.phone);
    if (booking.user.email) doc.text(booking.user.email);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Equipment');
    doc.font('Helvetica').text(`${booking.product.name}`);
    doc.text(`Capacity: ${booking.product.capacityLitres} L · Technology: ${booking.product.technology}`);
    doc.text(`Warranty: ${booking.product.warrantyMonths} months (covered by SmartRO at no cost during rental)`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Plan & charges');
    doc.font('Helvetica')
      .text(`Plan: ${booking.plan.name} (${booking.plan.durationDays} days)`)
      .text(`Security deposit (refundable): ${rupees(booking.depositPaise)}`)
      .text(`First-cycle rent: ${rupees(booking.firstPaymentPaise)}`);
    if (booking.referralCreditPaise > 0) {
      doc.text(`Referral credit applied: -${rupees(booking.referralCreditPaise)} (code ${booking.referralCode ?? ''})`);
    }
    doc.text(`Total payable at signup: ${rupees(booking.depositPaise + booking.firstPaymentPaise)}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Trial & cancellation');
    doc.font('Helvetica')
      .text('• 7-day risk-free trial. Cancel within this window for a 100% refund (deposit + first month rent).')
      .text('• After trial, a 6-month minimum lock-in applies. Early cancellation forfeits the deposit subject to ops policy.')
      .text('• Post lock-in, cancel anytime; deposit refunded within 7 working days after quality inspection.')
      .text('• SmartRO maintains the device end-to-end. All filters, service visits, and one relocation per year included.');
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Signed');
    doc.font('Helvetica').text(`Customer accepted on ${booking.agreementSignedAt?.toISOString() ?? '—'}`);
    doc.text(`SmartRO Services Pvt Ltd · GSTIN 27AAAAA0000A1Z5`);

    doc.moveDown(2);
    doc.fillColor('#999').fontSize(8).text(
      'This is a system-generated agreement. By signing through the SmartRO mobile app the customer agrees to the full Terms of Service available at https://smartro.in/terms.',
      { align: 'center' }
    );
  });
}

export async function generateInvoicePdf(args: {
  invoice: Invoice;
  payment: Payment;
  booking?: (Booking & { product: Product; plan: Plan }) | null;
  user: User;
}): Promise<Buffer> {
  const { invoice, payment, booking, user } = args;
  return buildPdf((doc) => {
    doc.fontSize(18).font('Helvetica-Bold').text('Tax Invoice', { align: 'right' });
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(invoice.number, { align: 'right' });
    doc.fillColor('#111');
    doc.moveDown(2);

    doc.font('Helvetica-Bold').fontSize(14).text('SmartRO Services Pvt Ltd');
    doc.font('Helvetica').fontSize(10).fillColor('#555')
      .text('1st Floor, Aqua Tower, Baner Road, Pune 411045')
      .text('GSTIN: 27AAAAA0000A1Z5 · PAN: AAAAA0000A')
      .text('care@smartro.in · +91 99999 99999');
    doc.fillColor('#111');
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Bill to');
    doc.font('Helvetica').text(user.fullName ?? user.phone).text(user.phone);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Items');
    doc.font('Helvetica');
    const desc = booking
      ? `${booking.product.name} · ${booking.plan.name} (${payment.kind})`
      : `${payment.kind} payment`;
    const subTotal = Math.round(invoice.amountPaise - invoice.gstPaise);
    doc.text(`${desc} — ${rupees(subTotal)}`);
    doc.text(`GST @ 18% — ${rupees(invoice.gstPaise)}`);
    doc.font('Helvetica-Bold').text(`Total — ${rupees(invoice.amountPaise)}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Payment');
    doc.font('Helvetica').text(`Mode: ${payment.gatewayRef?.startsWith('STUB') ? 'Cash/Stub' : 'Razorpay'}`);
    doc.text(`Ref: ${payment.gatewayRef ?? '—'}`);
    doc.text(`Paid on: ${payment.updatedAt.toISOString()}`);

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#999').text(
      'This is a computer-generated invoice and does not require a signature. For any queries write to billing@smartro.in.',
      { align: 'center' }
    );
  });
}
