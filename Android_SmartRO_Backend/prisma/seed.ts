import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Wipe in safe order (FKs)
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.job.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.kycRecord.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.inquiryEvent.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.device.deleteMany();
  await prisma.planCityPrice.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.product.deleteMany();
  await prisma.address.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.otpAttempt.deleteMany();
  await prisma.technician.deleteMany();
  await prisma.user.deleteMany();
  await prisma.city.deleteMany();

  // ── Cities ───────────────────────────────────────────────
  const pune = await prisma.city.create({ data: { name: 'Pune', state: 'Maharashtra' } });
  const mumbai = await prisma.city.create({ data: { name: 'Mumbai', state: 'Maharashtra' } });
  const bangalore = await prisma.city.create({
    data: { name: 'Bangalore', state: 'Karnataka', isServiceable: false },
  });

  // ── Plans (durations) ────────────────────────────────────
  const plan1 = await prisma.plan.create({ data: { name: 'Monthly', durationDays: 30 } });
  const plan3 = await prisma.plan.create({ data: { name: 'Quarterly', durationDays: 90 } });
  const plan6 = await prisma.plan.create({ data: { name: 'Half-yearly', durationDays: 180 } });
  const plan12 = await prisma.plan.create({ data: { name: 'Annual', durationDays: 365 } });

  // ── Products ─────────────────────────────────────────────
  const products = await Promise.all([
    prisma.product.create({
      data: {
        slug: 'aqua-pure-7l',
        name: 'AquaPure 7L (RO+UV+UF)',
        kind: 'HOME',
        capacityLitres: 7,
        technology: 'RO+UV+UF',
        mounting: 'WALL',
        description:
          '7-litre wall-mounted purifier with RO+UV+UF triple stage. Suitable for families up to 4 members. Includes installation, all maintenance, and filter replacements.',
        imageUrl: 'https://images.unsplash.com/photo-1559813353-d4d2c5dac17b?w=800',
        warrantyMonths: 24,
        personasMin: 2,
        personasMax: 4,
        tag: 'BEST_SELLER',
      },
    }),
    prisma.product.create({
      data: {
        slug: 'aqua-mini-5l',
        name: 'AquaMini 5L (RO+UV)',
        kind: 'HOME',
        capacityLitres: 5,
        technology: 'RO+UV',
        mounting: 'COUNTERTOP',
        description:
          '5-litre countertop purifier — perfect for bachelors and small families. Compact, energy-efficient, copper-infused tank.',
        imageUrl: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=800',
        warrantyMonths: 12,
        personasMin: 1,
        personasMax: 2,
      },
    }),
    prisma.product.create({
      data: {
        slug: 'aqua-elite-10l',
        name: 'AquaElite 10L (RO+UV+UF+Mineral)',
        kind: 'HOME',
        capacityLitres: 10,
        technology: 'RO+UV+UF',
        mounting: 'UNDER_SINK',
        description:
          'Premium 10-litre under-sink purifier with mineraliser and zero-water-wastage technology. Ideal for large families.',
        imageUrl: 'https://images.unsplash.com/photo-1606744837616-56c9a5c6a6eb?w=800',
        warrantyMonths: 36,
        personasMin: 4,
        personasMax: 6,
        tag: 'MOST_POPULAR',
      },
    }),
    prisma.product.create({
      data: {
        slug: 'aqua-business-25l',
        name: 'AquaBusiness 25L Commercial',
        kind: 'COMMERCIAL',
        capacityLitres: 25,
        technology: 'RO+UV+UF',
        mounting: 'WALL',
        description:
          'Commercial-grade 25-litre purifier for offices and small institutions. Heavy-duty, 24×7 SLA, dedicated account manager.',
        imageUrl: 'https://images.unsplash.com/photo-1551515270-1e9f51b04dac?w=800',
        warrantyMonths: 24,
      },
    }),
    prisma.product.create({
      data: {
        slug: 'aqua-enterprise-50l',
        name: 'AquaEnterprise 50L',
        kind: 'COMMERCIAL',
        capacityLitres: 50,
        technology: 'RO+UV+UF',
        mounting: 'WALL',
        description:
          'High-capacity 50-litre purifier for large enterprises, restaurants, and educational institutions.',
        imageUrl: 'https://images.unsplash.com/photo-1602166242292-91fcc92ff5b8?w=800',
        warrantyMonths: 24,
      },
    }),
  ]);

  // ── Plan-City Pricing (paise = INR × 100) ────────────────
  const pricingMatrix: Array<[number, number, number, number]> = [
    // [productIdx, basePuneMonthlyINR, baseMumbaiMonthlyINR, depositINR]
    [0, 599, 749, 1500],
    [1, 449, 549, 1000],
    [2, 899, 1099, 2500],
    [3, 1999, 2499, 5000],
    [4, 3499, 4499, 10000],
  ];
  const planList = [plan1, plan3, plan6, plan12];

  for (const [pi, pune_m, mum_m, dep] of pricingMatrix) {
    for (const plan of planList) {
      // Discount tiers: 1mo full price; 3mo 5% off; 6mo 10%; 12mo 15%
      const discount = plan.durationDays === 30 ? 0 : plan.durationDays === 90 ? 0.05 : plan.durationDays === 180 ? 0.1 : 0.15;
      const puneMonthly = Math.round(pune_m * (1 - discount));
      const mumMonthly = Math.round(mum_m * (1 - discount));
      await prisma.planCityPrice.create({
        data: {
          planId: plan.id,
          cityId: pune.id,
          productId: products[pi]!.id,
          monthlyPricePaise: puneMonthly * 100,
          depositPaise: dep * 100,
        },
      });
      await prisma.planCityPrice.create({
        data: {
          planId: plan.id,
          cityId: mumbai.id,
          productId: products[pi]!.id,
          monthlyPricePaise: mumMonthly * 100,
          depositPaise: dep * 100,
        },
      });
    }
  }

  // ── Users ────────────────────────────────────────────────
  const adminPwd = await bcrypt.hash('Admin@12345', 10);
  const techPwd = await bcrypt.hash('Tech@12345', 10);

  const admin = await prisma.user.create({
    data: {
      kind: 'ADMIN',
      phone: '+919999900001',
      email: 'admin@smartro.in',
      passwordHash: adminPwd,
      fullName: 'Aakash Sharma',
      status: 'ACTIVE',
      referralCode: 'ADMIN001',
    },
  });

  const tech1User = await prisma.user.create({
    data: {
      kind: 'TECHNICIAN',
      phone: '+919999911111',
      email: 'tech1@smartro.in',
      passwordHash: techPwd,
      fullName: 'Ramesh Patil',
      status: 'ACTIVE',
    },
  });
  const tech2User = await prisma.user.create({
    data: {
      kind: 'TECHNICIAN',
      phone: '+919999922222',
      email: 'tech2@smartro.in',
      passwordHash: techPwd,
      fullName: 'Suresh Kumar',
      status: 'ACTIVE',
    },
  });
  const tech1 = await prisma.technician.create({
    data: { userId: tech1User.id, employeeCode: 'TECH-001', zone: 'Pune-East' },
  });
  const tech2 = await prisma.technician.create({
    data: { userId: tech2User.id, employeeCode: 'TECH-002', zone: 'Mumbai-West' },
  });

  // Customers
  const customer1 = await prisma.user.create({
    data: {
      kind: 'CUSTOMER',
      phone: '+919876543210',
      fullName: 'Priya Mehta',
      email: 'priya@example.com',
      referralCode: 'PRIYA-001',
      status: 'ACTIVE',
    },
  });
  const customer2 = await prisma.user.create({
    data: {
      kind: 'CUSTOMER',
      phone: '+919812345678',
      fullName: 'Rahul Iyer',
      email: 'rahul@example.com',
      status: 'ACTIVE',
    },
  });
  const customer3 = await prisma.user.create({
    data: {
      kind: 'CUSTOMER',
      phone: '+919800000001',
      fullName: 'Aditi Joshi',
      email: 'aditi@example.com',
      status: 'ACTIVE',
    },
  });

  // Addresses
  await prisma.address.create({
    data: {
      userId: customer1.id,
      label: 'Home',
      line1: 'Flat 302, Sunshine Heights',
      line2: 'Baner Road',
      cityId: pune.id,
      pincode: '411045',
      isDefault: true,
    },
  });
  await prisma.address.create({
    data: {
      userId: customer2.id,
      label: 'Home',
      line1: '12-A Sea Breeze Apartments',
      line2: 'Bandra West',
      cityId: mumbai.id,
      pincode: '400050',
      isDefault: true,
    },
  });

  // ── KYC ──────────────────────────────────────────────────
  await prisma.kycRecord.create({
    data: {
      userId: customer1.id,
      aadhaarLast4: '1234',
      pan: 'ABCDE1234F',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    },
  });
  await prisma.kycRecord.create({
    data: {
      userId: customer2.id,
      aadhaarLast4: '5678',
      pan: 'XYZAB9876C',
      status: 'PENDING',
    },
  });

  // ── Devices ──────────────────────────────────────────────
  const dev1 = await prisma.device.create({
    data: { serial: 'SR-AP-000101', qr: 'QR-AP-000101', productId: products[0]!.id, status: 'WAREHOUSE' },
  });
  const dev2 = await prisma.device.create({
    data: { serial: 'SR-AM-000102', qr: 'QR-AM-000102', productId: products[1]!.id, status: 'WAREHOUSE' },
  });
  await prisma.device.create({
    data: { serial: 'SR-AE-000103', qr: 'QR-AE-000103', productId: products[2]!.id, status: 'WAREHOUSE' },
  });
  await prisma.device.create({
    data: { serial: 'SR-AB-000104', qr: 'QR-AB-000104', productId: products[3]!.id, status: 'WAREHOUSE' },
  });

  // ── Inquiries ────────────────────────────────────────────
  await prisma.inquiry.create({
    data: {
      name: 'Walk-in Lead — Suresh Bhat',
      phone: '+919811112222',
      pincode: '411014',
      cityId: pune.id,
      productId: products[0]!.id,
      planId: plan6.id,
      status: 'NEW',
      notes: 'Called from Hadapsar, family of 4, wants quick install',
      events: { create: { type: 'STATUS_CHANGE', payload: JSON.stringify({ to: 'NEW' }) } },
    },
  });
  await prisma.inquiry.create({
    data: {
      name: 'Sneha Kulkarni',
      phone: '+919833334444',
      pincode: '400072',
      cityId: mumbai.id,
      productId: products[2]!.id,
      planId: plan12.id,
      status: 'CONTACTED',
      notes: 'Interested in elite model with mineraliser',
      events: { create: { type: 'STATUS_CHANGE', payload: JSON.stringify({ to: 'CONTACTED' }) } },
    },
  });
  await prisma.inquiry.create({
    data: {
      userId: customer3.id,
      name: 'Aditi Joshi',
      phone: customer3.phone,
      pincode: '411045',
      cityId: pune.id,
      productId: products[1]!.id,
      planId: plan3.id,
      status: 'PROPOSAL_SENT',
      events: { create: { type: 'NOTE', payload: JSON.stringify({ note: 'Proposal emailed' }) } },
    },
  });

  // ── Booking + Subscription (active) for customer1 ────────
  const booking1Price = await prisma.planCityPrice.findFirstOrThrow({
    where: { productId: products[0]!.id, cityId: pune.id, planId: plan6.id },
  });
  const booking1 = await prisma.booking.create({
    data: {
      userId: customer1.id,
      productId: products[0]!.id,
      planId: plan6.id,
      cityId: pune.id,
      depositPaise: booking1Price.depositPaise,
      firstPaymentPaise: booking1Price.monthlyPricePaise,
      status: 'INSTALLED',
      installationSlot: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      agreementSignedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    },
  });
  const startedAt = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const expiresAt = new Date(startedAt.getTime() + 180 * 24 * 3600 * 1000);
  const lockInUntil = new Date(startedAt.getTime() + 180 * 24 * 3600 * 1000);
  // Seeded device pairing for Priya's subscription. The deviceToken is also
  // pre-issued so the ESP32 endpoints can be smoke-tested with curl out-of-
  // the-box (see SR-AP-000101 demo in STATUS.md).
  await prisma.device.update({
    where: { id: dev1.id },
    data: {
      status: 'INSTALLED',
      deviceToken: 'devtok-demo-priya-aquapure-7l',
      firmwareVersion: '1.4.2',
      wifiSsid: 'PriyaHome_5G',
    },
  });
  const sub1 = await prisma.subscription.create({
    data: {
      userId: customer1.id,
      bookingId: booking1.id,
      productId: products[0]!.id,
      planId: plan6.id,
      deviceId: dev1.id,
      status: 'ACTIVE',
      startedAt,
      expiresAt,
      lockInUntil,
    },
  });
  const pay1 = await prisma.payment.create({
    data: {
      userId: customer1.id,
      bookingId: booking1.id,
      kind: 'DEPOSIT',
      amountPaise: booking1Price.depositPaise + booking1Price.monthlyPricePaise,
      status: 'SUCCESS',
      gatewayRef: 'STUB_SEED_1',
    },
  });
  await prisma.invoice.create({
    data: {
      paymentId: pay1.id,
      number: 'SMR-202509-000001',
      amountPaise: pay1.amountPaise,
      gstPaise: Math.round(pay1.amountPaise * 0.18),
    },
  });

  // ── Pending booking for customer2 (PENDING_PAY state) ────
  const booking2Price = await prisma.planCityPrice.findFirstOrThrow({
    where: { productId: products[2]!.id, cityId: mumbai.id, planId: plan12.id },
  });
  await prisma.booking.create({
    data: {
      userId: customer2.id,
      productId: products[2]!.id,
      planId: plan12.id,
      cityId: mumbai.id,
      depositPaise: booking2Price.depositPaise,
      firstPaymentPaise: booking2Price.monthlyPricePaise,
      status: 'PENDING_KYC',
    },
  });

  // ── Tickets / Jobs ───────────────────────────────────────
  const ticket1 = await prisma.ticket.create({
    data: {
      userId: customer1.id,
      subscriptionId: sub1.id,
      deviceId: dev1.id,
      category: 'FILTER',
      description: 'Routine quarterly filter replacement',
      status: 'ASSIGNED',
      priority: 'MEDIUM',
      technicianId: tech1.id,
      slaDueAt: new Date(Date.now() + 72 * 3600 * 1000),
    },
  });
  await prisma.job.create({
    data: {
      ticketId: ticket1.id,
      technicianId: tech1.id,
      type: 'FILTER',
      scheduledFor: new Date(Date.now() + 4 * 3600 * 1000),
      status: 'SCHEDULED',
    },
  });

  const ticket2 = await prisma.ticket.create({
    data: {
      userId: customer1.id,
      subscriptionId: sub1.id,
      deviceId: dev1.id,
      category: 'REPAIR',
      description: 'Water flow has reduced significantly since last week',
      status: 'OPEN',
      priority: 'HIGH',
      slaDueAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });

  // Today's job for tech1 (so technician app's "today" view is non-empty)
  const todayNoon = new Date(); todayNoon.setHours(14, 30, 0, 0);
  await prisma.job.create({
    data: {
      ticketId: ticket2.id,
      technicianId: tech1.id,
      type: 'SERVICE',
      scheduledFor: todayNoon,
      status: 'SCHEDULED',
    },
  });

  // ── Rollups ──────────────────────────────────────────────
  // lowestMonthlyPaise on Product is the cheapest active monthly across cities;
  // we surface it as "starting at ₹X/mo" badges on product cards.
  for (const product of products) {
    const min = await prisma.planCityPrice.aggregate({
      where: { productId: product.id },
      _min: { monthlyPricePaise: true },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { lowestMonthlyPaise: min._min.monthlyPricePaise ?? null },
    });
  }

  // ── Notifications ────────────────────────────────────────
  await prisma.notification.create({
    data: { userId: customer1.id, channel: 'INAPP', title: 'Welcome to SmartRO', body: 'Your AquaPure 7L is now active.' },
  });
  await prisma.notification.create({
    data: {
      userId: customer1.id, channel: 'INAPP', title: 'Filter replacement scheduled',
      body: 'Technician will visit on ' + todayNoon.toLocaleString('en-IN'),
    },
  });

  // eslint-disable-next-line no-console
  console.log('\n✓ Seed complete\n');
  // eslint-disable-next-line no-console
  console.log('Cities:', [pune.name, mumbai.name].join(', '));
  // eslint-disable-next-line no-console
  console.log('Admin login → email: admin@smartro.in   password: Admin@12345');
  // eslint-disable-next-line no-console
  console.log('Tech1 login  → email: tech1@smartro.in  password: Tech@12345  (phone: +919999911111)');
  // eslint-disable-next-line no-console
  console.log('Tech2 login  → email: tech2@smartro.in  password: Tech@12345  (phone: +919999922222)');
  // eslint-disable-next-line no-console
  console.log('Customers (OTP login, OTP returned in dev response):');
  // eslint-disable-next-line no-console
  console.log('  • Priya Mehta  +919876543210  (has active subscription, KYC verified)');
  // eslint-disable-next-line no-console
  console.log('  • Rahul Iyer   +919812345678  (booking pending KYC)');
  // eslint-disable-next-line no-console
  console.log('  • Aditi Joshi  +919800000001  (inquiry only)');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
