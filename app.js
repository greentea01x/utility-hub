import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { createLoginLimiter } from './middleware/login-limit.js';
import pool from './db/pool.js';
import { csrf } from './middleware/csrf.js';
import { requireAuth, requirePageAccess } from './middleware/auth.js';
import { errors, notFound } from './middleware/errors.js';
import { AppError } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import internalRoutes, { healthz } from './routes/internal.js';
import roomsRoutes from './routes/rooms.js';
import tenantsRoutes from './routes/tenants.js';
import settingsRoutes from './routes/settings.js';
import readingsRoutes from './routes/readings.js';
import billsRoutes from './routes/bills.js';
import paymentsRoutes from './routes/payments.js';
import lineRoutes from './routes/line.js';
import residentRoutes from './routes/resident.js';
import notificationsRoutes from './routes/notifications.js';
import announcementsRoutes from './routes/announcements.js';
import reportsRoutes from './routes/reports.js';
import workspaceRoutes from './routes/workspace.js';
import {
  residenceName,
  currentPeriod,
  monthLabel,
  shiftPeriod,
  money,
  quantity,
  displayDate,
  chartScale,
} from './lib/presentation.js';

if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required');
const app = express();
const PgStore = connectPgSimple(session);
export const sessionStore = new PgStore({
  pool,
  tableName: 'sessions',
  createTableIfMissing: true,
});
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', new URL('./views', import.meta.url).pathname);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: [(req) => req.path.startsWith('/resident/') ? "'self' https://static.line-scdn.net" : "'self'"],
        connectSrc: [(req) => req.path.startsWith('/resident/') ? "'self' https://api.line.me https://access.line.me https://liff.line.me" : "'self'"],
        // Local HTTP previews must retain their origin through login redirects.
        upgradeInsecureRequests: ['development', 'test'].includes(app.get('env')) ? null : [],
      },
    },
  }),
);
app.use(express.static(new URL('./public', import.meta.url).pathname));
app.use('/line', express.raw({ type: 'application/json' }), lineRoutes);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use((req, res, next) => {
  Object.assign(res.locals, {
    residenceName,
    currentPeriod,
    monthLabel,
    shiftPeriod,
    money,
    quantity,
    displayDate,
    chartScale,
    currentPath: req.path,
    updatedAt: new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
      timeZone: 'Asia/Bangkok',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()),
  });
  next();
});
app.get('/healthz', healthz);
app.get('/internal/healthz', healthz);
const persistedSession = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  },
});
app.use((req, res, next) => {
  persistedSession(req, res, (error) => {
    if (error) return next(new AppError(503, 'DB_UNAVAILABLE', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'));
    res.locals.session = req.session;
    return next();
  });
});
app.use('/internal', internalRoutes);
app.use(csrf);
app.use('/api/resident', residentRoutes);
app.use('/login', createLoginLimiter());
app.use(authRoutes);
app.use(requireAuth);
app.use(requirePageAccess);
app.use(dashboardRoutes);
app.use(roomsRoutes);
app.use(tenantsRoutes);
app.use(settingsRoutes);
app.use(readingsRoutes);
app.use(billsRoutes);
app.use(paymentsRoutes);
app.use(notificationsRoutes);
app.use(announcementsRoutes);
app.use(reportsRoutes);
app.use(workspaceRoutes);
app.use(notFound);
app.use(errors);

export default app;
