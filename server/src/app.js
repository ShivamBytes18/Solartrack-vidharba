// import express from 'express';
// import helmet from 'helmet';
// import cors from 'cors';
// import path from 'node:path';
// import fs from 'node:fs';
// import { fileURLToPath } from 'node:url';
// import { config } from './config.js';
// import { requireAdmin, requireAuth } from './auth.js';
// import { errorHandler } from './lib/http.js';
// import publicRoutes from './routes/public.js';
// import authRoutes from './routes/auth.js';
// import staffRoutes from './routes/staff.js';
// import adminRoutes from './routes/admin.js';

// export function createApp() {
//   const app = express();
//   app.set('trust proxy', 1);
//   app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': config.isProd ? [] : null, 'default-src': ["'self'"], 'img-src': ["'self'", 'blob:', 'data:'], 'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], 'font-src': ["'self'", 'https://fonts.gstatic.com'] } } }));
//   app.use(cors({ origin: config.clientOrigin }));
//   app.use(express.json({ limit: '100kb' }));

//   app.get('/api/health', (_req, res) => res.json({ ok: true }));
//   app.use('/api/public', publicRoutes);
//   app.use('/api/auth', authRoutes);
//   app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
//   app.use('/api', requireAuth, staffRoutes);
//   app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

//   // Production: serve the built React app from the same origin.
//   const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
//   if (fs.existsSync(dist)) {
//     app.use(express.static(dist));
//     app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
//   }
//   app.use(errorHandler);
//   return app;
// }


import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { requireAdmin, requireAuth } from './auth.js';
import { errorHandler } from './lib/http.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import staffRoutes from './routes/staff.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // Set crossOriginResourcePolicy to 'cross-origin' so clients on other domains can fetch responses
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'upgrade-insecure-requests': config.isProd ? [] : null,
          'default-src': ["'self'"],
          'img-src': ["'self'", 'blob:', 'data:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
        },
      },
    })
  );

  // Allowed origins list (local dev + Render client + whatever is configured in config/env)
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://solartrack-vidharba-1client.onrender.com',
    ...(config.clientOrigin ? [config.clientOrigin] : []),
    ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) : []),
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/public', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
  app.use('/api', requireAuth, staffRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // Production: serve the built React app from the same origin (if running unified)
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}