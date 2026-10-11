const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const logger = require('./lib/logger');
const readiness = require('./lib/readiness');
const requestId = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
const sanitizeMongoInput = require('./middleware/sanitizeMongoInput');
const { watchResponses } = require('./lib/alerts');
const { rejectWritesWhenFull } = require('./lib/storageGuard');
const { envNumber, envNumberInvalid } = require('./lib/envNumber');

const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');
const socialRoutes = require('./routes/socials');
const skillRoutes = require('./routes/skills');
const projectRoutes = require('./routes/projects');
const experienceRoutes = require('./routes/experience');
const educationRoutes = require('./routes/education');
const certificationRoutes = require('./routes/certifications');
const resumeRoutes = require('./routes/resume');
const appsRoutes = require('./routes/apps');
const v1Routes = require('./routes/v1');

const app = express();

// Blank means 0 here; validateEnv separately refuses a blank value in production (it must be explicit there).
// A malformed value is refused outright instead of falling back, because the wrong hop count misattributes client IPs.
if (envNumberInvalid('TRUST_PROXY_HOPS')) throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
const trustProxyHops = envNumber('TRUST_PROXY_HOPS');
app.set('trust proxy', trustProxyHops);
app.set('etag', false);

// Request id first so every log line and error body can carry it, then one access-log line per
// request: reqId, method, path, status, ms, plus owner/app/tokenId/cacheHit when /v1 resolved them.
// Secrets are redacted by lib/logger.js; the logger is silent under NODE_ENV=test.
const PROBE_PATHS = new Set(['/livez', '/readyz', '/api/health']);
const requestFields = (req, res) => ({
  method: req.method,
  path: (req.originalUrl || req.url || '').split('?')[0],
  // The client address as Express resolved it through TRUST_PROXY_HOPS; a proxy address here means
  // the hop count is wrong and every visitor shares one rate-limit bucket.
  ip: req.ip,
  status: res.statusCode,
  owner: req.ownerId ? String(req.ownerId) : (req.userId ? String(req.userId) : undefined),
  app: req.cmsApp ? String(req.cmsApp._id) : undefined,
  tokenId: req.tokenId ? String(req.tokenId) : undefined,
  cacheHit: res.locals?.cacheHit,
});
app.use(requestId);
// Burst alerts on load-shedding 503s, 429s and /v1 401s (lib/alerts.js, docs/OPERATIONS.md#alerts).
app.use(watchResponses);
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  quietReqLogger: true,
  quietResLogger: true,
  customAttributeKeys: { reqId: 'reqId', responseTime: 'ms' },
  autoLogging: { ignore: (req) => PROBE_PATHS.has((req.url || '').split('?')[0]) },
  customSuccessObject: (req, res, val) => ({ ...requestFields(req, res), ms: val.responseTime }),
  // The handlers already log real 5xx errors with their stack; skip pino-http's synthetic "failed with status code" error.
  customErrorObject: (req, res, err, val) => ({ ...requestFields(req, res), ms: val.responseTime, ...(res.err || req.err ? { err: val.err } : {}) }),
  customSuccessMessage: () => 'request',
  customErrorMessage: () => 'request failed',
}));
app.use(helmet());

// Probes sit above every limiter: /livez is process liveness, /readyz adds a Mongo ping.
const liveness = (req, res) => res.json({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
app.get('/livez', liveness);
app.get('/api/health', liveness);
// The ping result is shared for a few seconds (lib/readiness.js) and the public body is the bare
// status: the internal reason (shutting_down, mongo_disconnected, mongo_ping_failed) is not published.
app.get('/readyz', async (req, res) => {
  const result = await readiness.checkReadyCached();
  res.status(result.ok ? 200 : 503).json({ status: result.ok ? 'ready' : 'unavailable' });
});

// Mount /v1 before the dashboard CORS middleware so its stricter preflight policy wins.
app.use('/v1', v1Routes);

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
}));

app.use(express.json({ limit: '256kb' }));
// Express 5 leaves req.body undefined without a JSON body; controllers may destructure it.
app.use((req, res, next) => { req.body ??= {}; next(); });

// Dashboard responses carry account data (the export is the full PII set): never store them in a browser or
// shared cache. /v1 sets its own Cache-Control.
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api', sanitizeMongoInput);
// Near the Atlas storage cap, content and App writes answer 503 storage_full (reads and deletes still pass).
app.use(['/api/profile', '/api/socials', '/api/skills', '/api/projects', '/api/experience', '/api/education', '/api/certifications', '/api/resume', '/api/apps'], rejectWritesWhenFull);
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/socials', socialRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/experience', experienceRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/certifications', certificationRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/apps', appsRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'not_found', message: 'API route not found', requestId: req.id });
});

app.use(errorHandler);

module.exports = app;
