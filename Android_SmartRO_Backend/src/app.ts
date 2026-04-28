import 'dotenv/config';
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

export function buildApp() {
  const app = express();

  const origins = (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim());
  app.use(cors({ origin: origins.includes('*') ? true : origins, credentials: false }));
  app.use(express.json({ limit: '5mb' }));
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ data: { ok: true, ts: new Date().toISOString() } }));

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

  app.use('/api/v1', v1);

  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);

  return app;
}
