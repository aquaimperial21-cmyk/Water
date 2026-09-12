// File-upload endpoint for the admin (product images, technician documents,
// banner images). Uses multer with disk storage. Files land under
// `uploads/<scope>/<uuid>.<ext>` and are served by the static handler in
// app.ts at `/uploads/...`. Response carries a public-relative `url` the
// admin/customer app can store directly on the relevant entity.

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { authRequired } from '../core/auth';
import { asyncHandler, BadRequest } from '../core/errors';

const router = Router();

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

const ALLOWED_SCOPES = new Set(['products', 'banners', 'documents']);

// Whitelist common image / pdf mime types. Reject everything else early.
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const scope = (req.params.scope || 'misc').toLowerCase();
    const safe = ALLOWED_SCOPES.has(scope) ? scope : 'misc';
    const dir = path.join(UPLOAD_ROOT, safe);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 8);
    cb(null, `${randomUUID()}${ext || ''}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

// POST /admin/uploads/:scope  (multipart/form-data, field "file")
router.post(
  '/:scope',
  authRequired(['ADMIN']),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw BadRequest('No file uploaded');
    const scope = req.params.scope;
    if (!ALLOWED_SCOPES.has(scope)) throw BadRequest(`Unknown upload scope: ${scope}`);
    const url = `/uploads/${scope}/${req.file.filename}`;
    res.status(201).json({
      data: {
        url,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  })
);

export default router;
