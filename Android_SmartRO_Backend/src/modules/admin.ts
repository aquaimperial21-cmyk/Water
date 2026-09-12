import { Router } from 'express';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { asyncHandler, NotFound, BadRequest } from '../core/errors';
import { validateBody } from '../core/validate';

const router = Router();

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

router.get(
  '/dashboard/stats',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [
      activeSubscriptions,
      newInquiriesToday,
      openInquiries,
      bookingsThisMonth,
      openTickets,
      paymentsThisMonth,
      devicesByStatus,
    ] = await Promise.all([
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.inquiry.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.inquiry.count({ where: { status: { in: ['NEW', 'CONTACTED', 'PROPOSAL_SENT'] } } }),
      prisma.booking.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', createdAt: { gte: monthStart } },
        _sum: { amountPaise: true },
      }),
      prisma.device.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    res.json({
      data: {
        activeSubscriptions,
        newInquiriesToday,
        openInquiries,
        bookingsThisMonth,
        openTickets,
        revenuePaiseThisMonth: paymentsThisMonth._sum.amountPaise ?? 0,
        devices: devicesByStatus.reduce((acc: Record<string, number>, d) => {
          acc[d.status] = d._count._all;
          return acc;
        }, {}),
      },
    });
  })
);

router.get(
  '/customers',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const customers = await prisma.user.findMany({
      where: { kind: 'CUSTOMER' },
      include: {
        addresses: { include: { city: true } },
        subscriptions: { include: { product: true, plan: true } },
        kycRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: customers });
  })
);

router.get(
  '/customers/:id',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const customer = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        addresses: { include: { city: true } },
        subscriptions: {
          include: {
            product: true,
            plan: true,
            device: true,
            booking: { include: { city: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        kycRecords: { orderBy: { createdAt: 'desc' } },
        bookings: {
          include: { product: true, plan: true, city: true, payments: true },
          orderBy: { createdAt: 'desc' },
        },
        tickets: {
          include: { technician: { include: { user: true } }, device: true },
          orderBy: { createdAt: 'desc' },
        },
        payments: { include: { invoice: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!customer) throw NotFound('Customer not found');

    // Resolve install address per subscription: prefer booking.addressId, else first user address
    const subscriptionsWithAddress = await Promise.all(
      customer.subscriptions.map(async (s) => {
        const addrId = s.booking?.addressId ?? customer.addresses[0]?.id;
        const installAddress = addrId
          ? await prisma.address.findUnique({ where: { id: addrId }, include: { city: true } })
          : null;
        const isOnline =
          s.device?.lastHeartbeatAt &&
          Date.now() - new Date(s.device.lastHeartbeatAt).getTime() < 90 * 60 * 1000;
        return { ...s, installAddress, deviceOnline: !!isOnline };
      })
    );

    res.json({ data: { ...customer, subscriptions: subscriptionsWithAddress } });
  })
);

router.get(
  '/devices',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const items = await prisma.device.findMany({
      include: { product: true, subscription: { include: { user: { select: { id: true, fullName: true, phone: true } } } } },
      orderBy: { serial: 'asc' },
    });
    res.json({ data: items });
  })
);

// ─────────────────────────── Add / edit / retire devices ───────────────────────────
//
// Warehouse intake — ops enters a fresh ESP32 unit:
//   POST   /admin/devices                 → create
//   PATCH  /admin/devices/:serial         → edit warehouse, status, fwVersion etc.
//
// Serials follow the convention SR-<productCode>-<seq> (e.g. SR-AP-000105).
// The route auto-generates a serial if `serial` is omitted and `productId` is set.

const createDeviceSchema = z.object({
  serial: z.string().min(3).max(64).optional(),
  qr: z.string().min(3).max(64).optional(),
  productId: z.string(),
  warehouse: z.string().min(1).max(80).default('Pune-W1'),
  firmwareVersion: z.string().max(40).optional(),
  count: z.number().int().min(1).max(50).default(1),
});

router.post(
  '/devices',
  authRequired(['ADMIN']),
  validateBody(createDeviceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createDeviceSchema>;

    const product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product) throw NotFound('Product not found');

    // Code from product slug: first letter of each hyphen-separated token, max 3.
    const productCode = product.slug
      .split('-')
      .map((t) => t[0]?.toUpperCase())
      .filter(Boolean)
      .join('')
      .slice(0, 3) || 'SR';

    // Bulk-create when `count > 1`; single-create otherwise. Serials must be unique,
    // so we look up the highest existing seq for this productCode and increment.
    const existing = await prisma.device.findMany({
      where: { serial: { startsWith: `SR-${productCode}-` } },
      select: { serial: true },
    });
    const maxSeq = existing.reduce((m, d) => {
      const n = parseInt(d.serial.split('-').pop() ?? '0', 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);

    const created: { id: string; serial: string; qr: string }[] = [];
    for (let i = 0; i < body.count; i++) {
      const seq = (maxSeq + i + 1).toString().padStart(6, '0');
      const serial = body.count === 1 && body.serial ? body.serial : `SR-${productCode}-${seq}`;
      const qr = body.count === 1 && body.qr ? body.qr : `QR-${productCode}-${seq}`;

      // Uniqueness guard — Prisma will throw if either column collides; we
      // surface as 400 with a helpful message instead of a 500.
      const collision = await prisma.device.findFirst({
        where: { OR: [{ serial }, { qr }] },
        select: { serial: true },
      });
      if (collision) throw BadRequest(`Serial or QR collision: ${collision.serial}`);

      const d = await prisma.device.create({
        data: {
          serial,
          qr,
          productId: body.productId,
          warehouse: body.warehouse,
          firmwareVersion: body.firmwareVersion ?? null,
          status: 'WAREHOUSE',
        },
        select: { id: true, serial: true, qr: true },
      });
      created.push(d);
      await prisma.auditLog.create({
        data: {
          actorUserId: req.auth!.sub,
          action: 'DEVICE_CREATE',
          entity: 'Device',
          entityId: d.id,
          after: JSON.stringify({ serial: d.serial, productId: body.productId, warehouse: body.warehouse }),
        },
      });
    }
    res.status(201).json({ data: { created } });
  })
);

const patchDeviceSchema = z.object({
  warehouse: z.string().min(1).max(80).optional(),
  qr: z.string().min(3).max(64).optional(),
  firmwareVersion: z.string().max(40).optional(),
  // RETIRED is terminal — once a unit is retired no allocate/state will work.
  status: z.enum(['WAREHOUSE', 'IN_SERVICE', 'RETIRED']).optional(),
});

router.patch(
  '/devices/:serial',
  authRequired(['ADMIN']),
  validateBody(patchDeviceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof patchDeviceSchema>;
    const device = await prisma.device.findUnique({
      where: { serial: req.params.serial },
      include: { subscription: true },
    });
    if (!device) throw NotFound('Device not found');
    if (body.status === 'RETIRED' && device.subscription) {
      throw BadRequest('Cannot retire a device that is still allocated — deallocate first.');
    }
    if (body.status && device.status === 'INSTALLED' && body.status === 'WAREHOUSE') {
      throw BadRequest('Cannot send an INSTALLED device back to warehouse without deallocating first.');
    }
    const updated = await prisma.device.update({
      where: { id: device.id },
      data: body,
    });
    await prisma.auditLog.create({
      data: {
        actorUserId: req.auth!.sub,
        action: 'DEVICE_UPDATE',
        entity: 'Device',
        entityId: device.id,
        before: JSON.stringify({ status: device.status, warehouse: device.warehouse }),
        after: JSON.stringify(body),
      },
    });
    res.json({ data: updated });
  })
);

router.get(
  '/payments',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const items = await prisma.payment.findMany({
      include: { user: { select: { id: true, fullName: true, phone: true } }, invoice: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ data: items });
  })
);

router.get(
  '/audit-logs',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ data: logs });
  })
);

// ───────────────────────────────────── Catalog management ──────────────────────────────────────

// imageUrl accepts either a fully-qualified URL or a relative path returned
// by the /admin/uploads endpoint (e.g. "/uploads/products/<uuid>.png").
const imageUrlSchema = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (v) => /^https?:\/\//i.test(v) || v.startsWith('/'),
    { message: 'Must be a URL or a path starting with "/"' }
  );

const productSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  kind: z.enum(['HOME', 'COMMERCIAL']),
  capacityLitres: z.number().int().positive().max(1000),
  technology: z.string().min(1).max(40), // e.g. RO, RO+UV, RO+UV+UF
  mounting: z.enum(['WALL', 'COUNTERTOP', 'UNDER_SINK']),
  description: z.string().min(10).max(2000),
  imageUrl: imageUrlSchema.nullish(),
  warrantyMonths: z.number().int().min(0).max(120).default(12),
  isActive: z.boolean().default(true),
});

const productPatchSchema = productSchema.partial();

const pricingSchema = z.object({
  planId: z.string().uuid(),
  cityId: z.string().uuid(),
  monthlyPricePaise: z.number().int().nonnegative(),
  depositPaise: z.number().int().nonnegative(),
});

// List all products (incl inactive) — admin view
router.get(
  '/products',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const items = await prisma.product.findMany({
      include: {
        prices: { include: { plan: true, city: true } },
        _count: { select: { bookings: true, subscriptions: true, devices: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: items });
  })
);

// Single product (admin)
router.get(
  '/products/:id',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        prices: { include: { plan: true, city: true } },
        _count: { select: { bookings: true, subscriptions: true, devices: true } },
      },
    });
    if (!product) throw NotFound('Product not found');
    res.json({ data: product });
  })
);

// Create product
router.post(
  '/products',
  authRequired(['ADMIN']),
  validateBody(productSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof productSchema>;
    const slug = input.slug ?? slugify(input.name);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) throw BadRequest(`Slug "${slug}" already in use`);
    const product = await prisma.product.create({
      data: {
        name: input.name,
        slug,
        kind: input.kind,
        capacityLitres: input.capacityLitres,
        technology: input.technology,
        mounting: input.mounting,
        description: input.description,
        imageUrl: input.imageUrl ?? null,
        warrantyMonths: input.warrantyMonths,
        isActive: input.isActive,
      },
      include: { prices: { include: { plan: true, city: true } } },
    });
    res.status(201).json({ data: product });
  })
);

// Update product (partial)
router.patch(
  '/products/:id',
  authRequired(['ADMIN']),
  validateBody(productPatchSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const input = req.body as z.infer<typeof productPatchSchema>;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw NotFound('Product not found');
    if (input.slug && input.slug !== existing.slug) {
      const dup = await prisma.product.findUnique({ where: { slug: input.slug } });
      if (dup) throw BadRequest(`Slug "${input.slug}" already in use`);
    }
    const product = await prisma.product.update({
      where: { id },
      data: input,
      include: { prices: { include: { plan: true, city: true } } },
    });
    res.json({ data: product });
  })
);

// Deactivate (soft delete) — keeps history
router.delete(
  '/products/:id',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw NotFound('Product not found');
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ data: product });
  })
);

// Upsert a price for (product, city, plan)
router.post(
  '/products/:id/pricing',
  authRequired(['ADMIN']),
  validateBody(pricingSchema),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const { planId, cityId, monthlyPricePaise, depositPaise } = req.body as z.infer<typeof pricingSchema>;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw NotFound('Product not found');
    const [city, plan] = await Promise.all([
      prisma.city.findUnique({ where: { id: cityId } }),
      prisma.plan.findUnique({ where: { id: planId } }),
    ]);
    if (!city) throw BadRequest('City not found');
    if (!plan) throw BadRequest('Plan not found');
    const price = await prisma.planCityPrice.upsert({
      where: { planId_cityId_productId: { planId, cityId, productId } },
      update: { monthlyPricePaise, depositPaise, effectiveFrom: new Date() },
      create: { planId, cityId, productId, monthlyPricePaise, depositPaise },
      include: { plan: true, city: true },
    });
    res.status(201).json({ data: price });
  })
);

// Remove a price row
router.delete(
  '/products/:id/pricing/:priceId',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const { id, priceId } = req.params;
    const price = await prisma.planCityPrice.findUnique({ where: { id: priceId } });
    if (!price || price.productId !== id) throw NotFound('Price not found');
    await prisma.planCityPrice.delete({ where: { id: priceId } });
    res.json({ data: { ok: true } });
  })
);

// ───────────────────────────────────── Technicians (Employees) ──────────────────────────────────────

const SHA = (s?: string | null) => (s ? createHash('sha256').update(s).digest('hex') : null);
const last4 = (s?: string | null) => (s ? s.replace(/\s+/g, '').slice(-4) : null);

const technicianCreateSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional(),
  employeeCode: z.string().min(2).max(40),
  zone: z.string().min(1).max(80),
  whatsappNumber: z.string().min(8).max(20).optional(),
  // HR
  dateOfJoining: z.string().datetime().optional(),
  dateOfBirth: z.string().datetime().optional(),
  employmentType: z.enum(['PROBATION', 'PERMANENT', 'CONTRACT']).default('PROBATION'),
  monthlySalaryPaise: z.number().int().nonnegative().optional(),
  // PII (raw — hashed before storage)
  aadhaar: z.string().regex(/^\d{12}$/).optional(),
  pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/).optional(),
  bankAccountNumber: z.string().min(6).max(40).optional(),
  bankIfsc: z.string().min(6).max(20).optional(),
  bankName: z.string().min(1).max(80).optional(),
  accountHolderName: z.string().min(1).max(120).optional(),
  // Address
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  addressCity: z.string().max(80).optional(),
  addressState: z.string().max(80).optional(),
  addressPincode: z.string().max(10).optional(),
  // Emergency
  emergencyContactName: z.string().max(120).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
  emergencyContactRelation: z.string().max(40).optional(),
  // Initial password (admin sets, tech changes on first login)
  initialPassword: z.string().min(8).max(64).optional(),
});

function maskTechnician<T extends Record<string, unknown>>(t: T) {
  // Strip hashes from API response; only last-4 fields are exposed.
  const { aadhaarHash, panHash, bankAccountHash, ...rest } = t as T & {
    aadhaarHash?: string | null;
    panHash?: string | null;
    bankAccountHash?: string | null;
  };
  return rest;
}

// List technicians
router.get(
  '/technicians',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const techs = await prisma.technician.findMany({
      include: { user: { select: { id: true, fullName: true, phone: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: techs.map(maskTechnician) });
  })
);

// One technician (full HR profile, PII as last-4 only)
router.get(
  '/technicians/:id',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const tech = await prisma.technician.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true, status: true } },
      },
    });
    if (!tech) throw NotFound('Technician not found');
    res.json({ data: maskTechnician(tech) });
  })
);

// Create technician — auto-creates a paired User(kind=TECHNICIAN)
router.post(
  '/technicians',
  authRequired(['ADMIN']),
  validateBody(technicianCreateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof technicianCreateSchema>;

    // Uniqueness checks
    const [byPhone, byCode, byEmail] = await Promise.all([
      prisma.user.findUnique({ where: { phone: input.phone } }),
      prisma.technician.findUnique({ where: { employeeCode: input.employeeCode } }),
      input.email ? prisma.user.findUnique({ where: { email: input.email } }) : null,
    ]);
    if (byPhone) throw BadRequest('Phone already in use');
    if (byCode) throw BadRequest(`Employee code "${input.employeeCode}" already in use`);
    if (byEmail) throw BadRequest('Email already in use');

    const tempPassword = input.initialPassword ?? randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const created = await prisma.user.create({
      data: {
        kind: 'TECHNICIAN',
        phone: input.phone,
        email: input.email ?? null,
        fullName: input.fullName,
        passwordHash,
        technician: {
          create: {
            employeeCode: input.employeeCode,
            zone: input.zone,
            isActive: true,
            status: 'ACTIVE',
            whatsappNumber: input.whatsappNumber ?? null,
            dateOfJoining: input.dateOfJoining ? new Date(input.dateOfJoining) : null,
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            employmentType: input.employmentType,
            monthlySalaryPaise: input.monthlySalaryPaise ?? null,
            aadhaarHash: SHA(input.aadhaar) ?? null,
            aadhaarLast4: last4(input.aadhaar) ?? null,
            panHash: SHA(input.pan) ?? null,
            panLast4: input.pan ? input.pan.slice(-4) : null,
            bankAccountHash: SHA(input.bankAccountNumber) ?? null,
            bankAccountLast4: last4(input.bankAccountNumber) ?? null,
            bankIfsc: input.bankIfsc ?? null,
            bankName: input.bankName ?? null,
            accountHolderName: input.accountHolderName ?? null,
            addressLine1: input.addressLine1 ?? null,
            addressLine2: input.addressLine2 ?? null,
            addressCity: input.addressCity ?? null,
            addressState: input.addressState ?? null,
            addressPincode: input.addressPincode ?? null,
            emergencyContactName: input.emergencyContactName ?? null,
            emergencyContactPhone: input.emergencyContactPhone ?? null,
            emergencyContactRelation: input.emergencyContactRelation ?? null,
            documentUrls: '[]',
          },
        },
      },
      include: { technician: true },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: req.auth!.sub,
        action: 'TECHNICIAN_CREATE',
        entity: 'Technician',
        entityId: created.technician!.id,
        after: JSON.stringify({ employeeCode: input.employeeCode }),
      },
    });

    res.status(201).json({
      data: { ...maskTechnician(created.technician!), user: { id: created.id, fullName: created.fullName, phone: created.phone, email: created.email }, tempPassword },
    });
  })
);

const technicianPatchSchema = technicianCreateSchema.partial().extend({
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'EXITED']).optional(),
});

router.patch(
  '/technicians/:id',
  authRequired(['ADMIN']),
  validateBody(technicianPatchSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const input = req.body as z.infer<typeof technicianPatchSchema>;
    const existing = await prisma.technician.findUnique({ where: { id }, include: { user: true } });
    if (!existing) throw NotFound('Technician not found');

    const techData: Record<string, unknown> = {};
    const userData: Record<string, unknown> = {};

    if (input.zone !== undefined) techData.zone = input.zone;
    if (input.whatsappNumber !== undefined) techData.whatsappNumber = input.whatsappNumber;
    if (input.dateOfJoining !== undefined) techData.dateOfJoining = new Date(input.dateOfJoining);
    if (input.dateOfBirth !== undefined) techData.dateOfBirth = new Date(input.dateOfBirth);
    if (input.employmentType !== undefined) techData.employmentType = input.employmentType;
    if (input.monthlySalaryPaise !== undefined) techData.monthlySalaryPaise = input.monthlySalaryPaise;
    if (input.bankIfsc !== undefined) techData.bankIfsc = input.bankIfsc;
    if (input.bankName !== undefined) techData.bankName = input.bankName;
    if (input.accountHolderName !== undefined) techData.accountHolderName = input.accountHolderName;
    if (input.addressLine1 !== undefined) techData.addressLine1 = input.addressLine1;
    if (input.addressLine2 !== undefined) techData.addressLine2 = input.addressLine2;
    if (input.addressCity !== undefined) techData.addressCity = input.addressCity;
    if (input.addressState !== undefined) techData.addressState = input.addressState;
    if (input.addressPincode !== undefined) techData.addressPincode = input.addressPincode;
    if (input.emergencyContactName !== undefined) techData.emergencyContactName = input.emergencyContactName;
    if (input.emergencyContactPhone !== undefined) techData.emergencyContactPhone = input.emergencyContactPhone;
    if (input.emergencyContactRelation !== undefined) techData.emergencyContactRelation = input.emergencyContactRelation;
    if (input.status !== undefined) {
      techData.status = input.status;
      techData.isActive = input.status === 'ACTIVE';
      if (input.status === 'EXITED') techData.exitedAt = new Date();
    }

    if (input.aadhaar !== undefined) {
      techData.aadhaarHash = SHA(input.aadhaar);
      techData.aadhaarLast4 = last4(input.aadhaar);
    }
    if (input.pan !== undefined) {
      techData.panHash = SHA(input.pan);
      techData.panLast4 = input.pan ? input.pan.slice(-4) : null;
    }
    if (input.bankAccountNumber !== undefined) {
      techData.bankAccountHash = SHA(input.bankAccountNumber);
      techData.bankAccountLast4 = last4(input.bankAccountNumber);
    }

    if (input.fullName !== undefined) userData.fullName = input.fullName;
    if (input.phone !== undefined) userData.phone = input.phone;
    if (input.email !== undefined) userData.email = input.email;

    const updated = await prisma.technician.update({
      where: { id },
      data: {
        ...techData,
        ...(Object.keys(userData).length ? { user: { update: userData } } : {}),
      },
      include: { user: { select: { id: true, fullName: true, phone: true, email: true, status: true } } },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: req.auth!.sub,
        action: 'TECHNICIAN_UPDATE',
        entity: 'Technician',
        entityId: id,
        before: JSON.stringify({ status: existing.status, zone: existing.zone }),
        after: JSON.stringify(input),
      },
    });

    res.json({ data: maskTechnician(updated) });
  })
);

// Append a document to documentUrls JSON array
const documentSchema = z.object({
  label: z.string().min(1).max(80),
  url: z.string().min(1).max(500),
});
router.post(
  '/technicians/:id/documents',
  authRequired(['ADMIN']),
  validateBody(documentSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { label, url } = req.body as z.infer<typeof documentSchema>;
    const t = await prisma.technician.findUnique({ where: { id } });
    if (!t) throw NotFound('Technician not found');
    let docs: Array<{ label: string; url: string; uploadedAt: string }> = [];
    try {
      docs = t.documentUrls ? JSON.parse(t.documentUrls) : [];
    } catch {
      docs = [];
    }
    docs.push({ label, url, uploadedAt: new Date().toISOString() });
    const updated = await prisma.technician.update({
      where: { id },
      data: { documentUrls: JSON.stringify(docs) },
    });
    res.status(201).json({ data: maskTechnician(updated) });
  })
);

// ───────────────────────────────────── Broadcasts ──────────────────────────────────────

const broadcastSchema = z.object({
  audience: z.enum(['ALL', 'ACTIVE_SUBSCRIBERS', 'EXPIRING_7D', 'NO_SUBSCRIPTION']).default('ALL'),
  channel: z.enum(['WHATSAPP', 'SMS']).default('WHATSAPP'),
  templateKey: z.enum(['admin.broadcast.custom', 'banner.broadcast']).default('admin.broadcast.custom'),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
});

router.post(
  '/broadcasts',
  authRequired(['ADMIN']),
  validateBody(broadcastSchema),
  asyncHandler(async (req, res) => {
    const { audience, channel, templateKey, title, body } = req.body as z.infer<typeof broadcastSchema>;
    const { dispatch } = await import('../services/notifications');

    let targets: { id: string; phone: string; fullName: string | null }[] = [];

    if (audience === 'ALL') {
      targets = await prisma.user.findMany({
        where: { kind: 'CUSTOMER', status: 'ACTIVE' },
        select: { id: true, phone: true, fullName: true },
      });
    } else if (audience === 'ACTIVE_SUBSCRIBERS') {
      const subs = await prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        select: { user: { select: { id: true, phone: true, fullName: true } } },
      });
      targets = subs.map((s) => s.user);
    } else if (audience === 'EXPIRING_7D') {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      const subs = await prisma.subscription.findMany({
        where: { status: 'ACTIVE', expiresAt: { gte: start, lt: end } },
        select: { user: { select: { id: true, phone: true, fullName: true } } },
      });
      targets = subs.map((s) => s.user);
    } else {
      // NO_SUBSCRIPTION
      const subscribed = await prisma.subscription.findMany({
        select: { userId: true },
        distinct: ['userId'],
      });
      const subscribedIds = new Set(subscribed.map((s) => s.userId));
      const all = await prisma.user.findMany({
        where: { kind: 'CUSTOMER', status: 'ACTIVE' },
        select: { id: true, phone: true, fullName: true },
      });
      targets = all.filter((u) => !subscribedIds.has(u.id));
    }

    let sent = 0;
    let failed = 0;
    for (const t of targets) {
      const r = await dispatch({
        userId: t.id,
        to: t.phone,
        channel,
        templateKey,
        vars: { name: t.fullName ?? 'there', title, body },
      });
      if (r.sent) sent++;
      else failed++;
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: req.auth!.sub,
        action: 'BROADCAST_SEND',
        entity: 'Broadcast',
        after: JSON.stringify({ audience, channel, templateKey, title, count: targets.length, sent, failed }),
      },
    });

    res.status(201).json({ data: { audience, count: targets.length, sent, failed } });
  })
);

// Manual cron triggers (for admin "run now" or smoke testing)
router.post(
  '/cron/expiry-reminders/run',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const { runExpiryReminders } = await import('../cron');
    const r = await runExpiryReminders();
    res.json({ data: r });
  })
);
router.post(
  '/cron/tech-schedule/run',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const { runTechSchedule } = await import('../cron');
    const r = await runTechSchedule();
    res.json({ data: r });
  })
);

export default router;
