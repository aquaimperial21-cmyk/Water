// Crash reports from the customer app.
//
// The app has an error screen and a global error handler
// (Frontend/src/utils/crashReporter.ts). When something
// breaks it posts here: what broke, on which screen, in which app version
// and over-the-air update. Each report becomes one "[app-error]" line in the
// server log (smartro logs api | grep app-error), which is all we need to
// find and fix it. Nothing is stored in the database.
//
// No login needed (the app can break before sign-in); a valid token, when
// sent, adds the user id. Rate-limited per user / client address, and every
// field is capped, so a crash loop can't flood the log.

import { Router } from 'express';
import { z } from 'zod';
import { authOptional } from '../core/auth';
import { asyncHandler, HttpError } from '../core/errors';
import { clientKey, hit } from '../core/ratelimit';
import { validateBody } from '../core/validate';

const router = Router();

const reportSchema = z.object({
  kind: z.enum(['render', 'global', 'promise', 'updates']),
  fatal: z.boolean().default(false),
  message: z.string().max(1000),
  stack: z.string().max(6000).optional(),
  componentStack: z.string().max(4000).optional(),
  screen: z.string().max(100).optional(),
  appVersion: z.string().max(40).optional(),
  updateId: z.string().max(80).optional(),
  platform: z.string().max(20).optional(),
  osVersion: z.string().max(40).optional(),
});

router.post(
  '/',
  authOptional(),
  validateBody(reportSchema),
  asyncHandler(async (req, res) => {
    const who = req.auth?.sub ?? clientKey(req.header('x-forwarded-for'), req.ip);
    const limit = hit(`app-error:${who}`, 30, 600);
    if (!limit.allowed) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many reports');
    }
    const r = req.body as z.infer<typeof reportSchema>;
    // eslint-disable-next-line no-console
    console.error(
      `[app-error] ${JSON.stringify({ user: req.auth?.sub ?? null, ...r, stack: r.stack?.split('\n').slice(0, 25).join('\n') })}`,
    );
    res.status(202).json({ data: { ok: true } });
  }),
);

export default router;
