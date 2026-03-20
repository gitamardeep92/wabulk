import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/sessions.js';
import messageRoutes from './routes/messages.js';
import templateRoutes from './routes/templates.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import contactRoutes from './routes/contacts.js';

import { startWorker } from './workers/messageWorker.js';
import { restoreAllSessions } from './services/sessionManager.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '../public');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security & Middleware ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Since frontend/admin are served from the same server,
// all requests are same-origin — CORS is effectively a no-op.
// We use * to avoid any CORS-related 403s during development or
// if someone accesses the API from an external tool.
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// API key specific rate limit (stricter)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => req.headers.authorization || req.ip,
});

// Handle preflight requests for all routes
app.options('*', cors());

// ── API Routes (must come BEFORE static files) ────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/auth', authRoutes);
app.use('/sessions', sessionRoutes);
app.use('/v1/messages', apiLimiter, messageRoutes);
app.use('/templates', templateRoutes);
app.use('/admin-api', adminRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/contacts', contactRoutes);

// ── Static file serving ───────────────────────────────────

// User dashboard → /app
app.use('/app', express.static(path.join(PUBLIC, 'app')));
app.get('/app/*', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'app', 'index.html'));
});

// Admin panel → /admin
app.use('/admin', express.static(path.join(PUBLIC, 'admin')));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'admin', 'index.html'));
});

// Marketing site → / (root, must be last)
app.use('/', express.static(path.join(PUBLIC, 'marketing')));
app.get('*', (req, res) => {
  const indexPath = path.join(PUBLIC, 'marketing', 'index.html');
  res.sendFile(indexPath);
});

// ── Error handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 WaBulk running on port ${PORT}`);
  console.log(`   ENV:       ${process.env.NODE_ENV}`);
  console.log(`   Dashboard: http://localhost:${PORT}/app`);
  console.log(`   Admin:     http://localhost:${PORT}/admin`);
  console.log(`   API:       http://localhost:${PORT}/v1/messages`);

  // Start Supabase-based message worker (no Redis needed)
  startWorker();
  console.log('⚙️  Message worker started');

  // Restore active WA sessions from Supabase
  await restoreAllSessions();
});

export default app;
