// Create (or re-password) the real admin account.
//
//   ADMIN_EMAIL=ops@yourdomain.in ADMIN_PASSWORD='...' npm run admin:create
//
// Unlike `npm run prisma:seed`, this touches nothing else: no wiping, no demo
// data. Safe to run against production, which is the point — the password is
// typed into the shell (or Railway's run command) and never lands in git.
//
// An existing account with that email keeps its id, name and history; only the
// password, role and status are set.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const MIN_PASSWORD = 12;

function required(key: 'ADMIN_EMAIL' | 'ADMIN_PASSWORD'): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required. Run: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create`);
  return value;
}

async function main() {
  const email = required('ADMIN_EMAIL').trim().toLowerCase();
  const password = required('ADMIN_PASSWORD');
  const fullName = process.env.ADMIN_NAME?.trim() || 'SmartRO Admin';
  // Phone is optional: the console signs in with email + password.
  const phone = process.env.ADMIN_PHONE?.trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`ADMIN_EMAIL "${email}" is not an email address`);
  if (password.length < MIN_PASSWORD) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD} characters (got ${password.length}).`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, kind: 'ADMIN', status: 'ACTIVE' },
    });
    console.log(`Updated existing account ${email}: password reset, role ADMIN, status ACTIVE.`);
    return;
  }

  if (!phone) {
    throw new Error(
      'ADMIN_PHONE is required when creating a new admin (the users table requires a phone). ' +
        'Use the number that should own this account, e.g. ADMIN_PHONE=+919999900001'
    );
  }
  const clash = await prisma.user.findFirst({ where: { phone } });
  if (clash) throw new Error(`ADMIN_PHONE ${phone} already belongs to ${clash.email ?? clash.id}. Pick another number.`);

  const created = await prisma.user.create({
    data: {
      kind: 'ADMIN',
      status: 'ACTIVE',
      email,
      phone,
      fullName,
      passwordHash,
      referralCode: `ADMIN-${Math.floor(1000 + Math.random() * 9000)}`,
    },
  });
  console.log(`Created admin ${created.email} (${created.fullName}). Sign in at the console with this email.`);
}

main()
  .catch((e) => {
    console.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
