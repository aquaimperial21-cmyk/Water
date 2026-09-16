// Invoice numbering.
//
// There used to be two identical `let invoiceCounter = Date.now() % 100000`
// counters — one in booking.ts, one in payment.ts — plus a third format in
// subscription.ts. Both modules load within the same millisecond, so both
// counters started on the same value and issued the same SMR-YYYYMM-NNNNNN
// string; `Invoice.number` is unique, so the collision rolled back a
// transaction that had already taken the customer's money. A database
// sequence is the only counter that survives two modules, two replicas and a
// restart.

import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Next invoice number, e.g. SMR-202609-000042.
 *
 * Pass the transaction client when inside one. Sequences do not roll back, so
 * a failed settlement burns a number rather than reusing it — gaps are fine,
 * duplicates are not.
 */
export async function nextInvoiceNumber(db: Db): Promise<string> {
  const rows = await db.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('invoice_number_seq')`;
  const n = Number(rows[0]?.nextval ?? 0);
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
  return `SMR-${yyyymm}-${String(n).padStart(6, '0')}`;
}
