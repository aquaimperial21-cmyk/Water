import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { errorHandler } from './core/errors';

import authRoutes from './modules/auth';
import catalogRoutes from './modules/catalog';
import inquiryRoutes from './modules/inquiry';
import bookingRoutes from './modules/booking';
import kycRoutes from './modules/kyc';
import subscriptionRoutes from './modules/subscription';
import ticketRoutes from './modules/ticket';
import technicianRoutes from './modules/technician';
import adminRoutes from './modules/admin';
import bannerRoutes from './modules/banner';
import notificationRoutes from './modules/notification';
import deviceRoutes from './modules/device';
import webhookRoutes from './modules/webhook';
import uploadRoutes from './modules/upload';
import paymentRoutes, { webhookRouter as razorpayWebhookRouter } from './modules/payment';
import referralRoutes from './modules/referral';
import docRoutes from './modules/docs';
import supportRoutes from './modules/support';

export function buildApp() {
  const app = express();

  const origins = (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim());
  app.use(cors({ origin: origins.includes('*') ? true : origins, credentials: false }));
  // Preserve the raw body buffer so HMAC-SHA256 webhook signatures (Razorpay,
  // and any future provider) can be verified against the exact bytes received.
  app.use(
    express.json({
      limit: '5mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ data: { ok: true, ts: new Date().toISOString() } }));

  // Static-serve uploaded files. URLs returned by the upload endpoint look
  // like `/uploads/products/<uuid>.jpg` and resolve here.
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), { maxAge: '7d' }));

  const v1 = express.Router();
  v1.use('/auth', authRoutes);
  v1.use('/', catalogRoutes); // /cities /products /plans /pricing
  v1.use('/inquiries', inquiryRoutes);
  v1.use('/bookings', bookingRoutes);
  v1.use('/kyc', kycRoutes);
  v1.use('/subscriptions', subscriptionRoutes);
  v1.use('/tickets', ticketRoutes);
  v1.use('/technician', technicianRoutes);
  v1.use('/admin', adminRoutes);
  v1.use('/banners', bannerRoutes);
  v1.use('/notifications', notificationRoutes);
  v1.use('/devices', deviceRoutes);
  v1.use('/webhooks', webhookRoutes);
  v1.use('/webhooks/razorpay', razorpayWebhookRouter);
  v1.use('/payments', paymentRoutes);
  v1.use('/referrals', referralRoutes);
  v1.use('/', docRoutes); // /bookings/:id/agreement.pdf, /invoices/:id.pdf, /invoices/me
  v1.use('/', supportRoutes); // /waitlist, /help-requests, /admin/help-requests, /admin/waitlist
  v1.use('/admin/uploads', uploadRoutes);

  app.use('/api/v1', v1);

  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);

  return app;
}
