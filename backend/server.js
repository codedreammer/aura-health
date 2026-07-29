import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDatabase from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import medicineLogRoutes from './routes/medicineLogRoutes.js';
import waterRoutes from './routes/waterRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import careCircleRoutes from './routes/careCircleRoutes.js';

const app = express();

// ---------------------------------------------------------------------------
// 1. Connect to MongoDB — single, awaited call. H1 duplicate fix.
//
//    If DB cannot be reached during boot, the process exits with a non-zero
//    code so load balancers / container orchestrators mark the pod unhealthy
//    instead of routing traffic to a back-end that will fail every request.
// ---------------------------------------------------------------------------

let databaseConnected = false;

try {
  await connectDatabase();
  databaseConnected = true;
} catch (error) {
  console.error('[server] Failed to connect to MongoDB during boot — aborting.', {
    message: error?.message || String(error),
  });
  // eslint-disable-next-line no-process-exit
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Body parsers. Limits are explicit so 10mb POSTs can't blow the heap.
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// ---------------------------------------------------------------------------
// 3. CORS — env-defined origin with Vite dev-server fallback.
//
//    The legacy `app.use(cors())` was permissive (*), which is not
//    production-safe and causes credentialed requests to fail in browsers
//    that enforce `Access-Control-Allow-Credentials: true`.
// ---------------------------------------------------------------------------

const parseCorsOrigins = () => {
  const raw = process.env.FRONTEND_URL || '';
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
  ];

  const combined = Array.from(new Set([...origins, ...defaults]));

  return (origin, callback) => {
    // Permit same-origin requests (mobile / curl / health checks without Origin header)
    if (!origin) return callback(null, true);
    if (combined.includes(origin)) return callback(null, true);

    // Last-resort permissive behaviour for preview deployments. This is still
    // safer than the previous wildcard because credentialed requests will
    // fail in the browser if the Origin is not explicitly allowed.
    if (process.env.NODE_ENV !== 'production') return callback(null, true);

    return callback(new Error(`CORS rejected origin: ${origin}`));
  };
};

app.use(cors({
  origin: parseCorsOrigins(),
  credentials: true,
  maxAge: 600, // cache preflight for 10 minutes
}));

// ---------------------------------------------------------------------------
// 4. Lightweight request metadata + small structured access log.
// ---------------------------------------------------------------------------

app.use((req, res, next) => {
  req.requestStartedAt = Date.now();
  req.requestId =
    (req.headers['x-request-id'] && String(req.headers['x-request-id']).slice(0, 64)) ||
    `sr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ---------------------------------------------------------------------------
// 5. Liveness / health check — available before all other routes so any LB
//    can verify the process is alive without incurring DB auth cost.
// ---------------------------------------------------------------------------

app.get('/healthz', (req, res) => {
  res.status(databaseConnected ? 200 : 503).json({
    ok: databaseConnected,
    requestId: req.requestId,
    uptimeMs: process.uptime() * 1000,
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Aura Health Backend is running.',
    requestId: req.requestId,
  });
});

// ---------------------------------------------------------------------------
// 6. API routes
// ---------------------------------------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/medicine-logs', medicineLogRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/care-circle', careCircleRoutes);

// ---------------------------------------------------------------------------
// 7. 404 — JSON for unknown routes (prevents Express default HTML page).
// ---------------------------------------------------------------------------

app.use('/{*splat}', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
    code: 'NOT_FOUND',
    method: req.method,
    path: req.originalUrl,
    requestId: req.requestId,
  });
});

// ---------------------------------------------------------------------------
// 8. Global error-handler middleware (must be the LAST `app.use`).
//
//    - Routes throw: status + safe message.
//    - Stack traces stripped in production.
//    - Stops Express from emitting its default HTML "Error: ..." page.
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  const status = Number(error?.status) || 500;

  // Never echo the raw error message in production if it's an unhandled
  // 500-class error (could leak DB hostnames, stack snippets, etc.).
  let clientMessage =
    typeof error?.message === 'string' && error.message.trim()
      ? error.message
      : 'Internal server error.';

  if (status >= 500 && process.env.NODE_ENV === 'production') {
    clientMessage = 'Something went wrong on our end. Please try again in a moment.';
  }

  // Structured server-side log (only — NOT echoed back to client).
  const durationMs = typeof req.requestStartedAt === 'number'
    ? Date.now() - req.requestStartedAt
    : null;
  console.error('[server] Request failed', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    message: error?.message,
    durationMs,
    stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    cause: process.env.NODE_ENV === 'development' ? error?.cause?.message || undefined : undefined,
  });

  if (res.headersSent) return;

  res.status(status).json({
    success: false,
    message: clientMessage,
    code: error?.code || (status === 429 ? 'RATE_LIMITED' : null) || null,
    requestId: req.requestId,
  });
});

// ---------------------------------------------------------------------------
// 9. Listen.
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.info('[server] Started', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseConnected,
    frontendOrigins: (process.env.FRONTEND_URL || '(localhost default)').split(',').map((s) => s.trim()),
  });
});

export default app;
