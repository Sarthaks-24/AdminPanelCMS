const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const sanitizeMongoInput = require('./middleware/sanitizeMongoInput');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const socialRoutes = require('./routes/socials');
const skillRoutes = require('./routes/skills');
const projectRoutes = require('./routes/projects');
const experienceRoutes = require('./routes/experience');
const educationRoutes = require('./routes/education');
const certificationRoutes = require('./routes/certifications');
const resumeRoutes = require('./routes/resume');
const fsRoutes = require('./routes/fs');
const appsRoutes = require('./routes/apps');

const app = express();

app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
app.set('etag', false);
app.use(helmet());

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (isLocalhost || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '256kb' }));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', sanitizeMongoInput);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/socials', socialRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/experience', experienceRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/certifications', certificationRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/fs', fsRoutes);
app.use('/api/apps', appsRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

app.use(errorHandler);

module.exports = app;
