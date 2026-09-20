import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pool from './db/pool.js';
import { csrf } from './middleware/csrf.js';
import { requireAuth } from './middleware/auth.js';
import { errors, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import internalRoutes, { healthz } from './routes/internal.js';
import roomsRoutes from './routes/rooms.js';
import tenantsRoutes from './routes/tenants.js';
import settingsRoutes from './routes/settings.js';
import readingsRoutes from './routes/readings.js';
import billsRoutes from './routes/bills.js';

if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required');
const app = express();
const MySQLStore = MySQLStoreFactory(session);
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', new URL('./views', import.meta.url).pathname);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'self'"], styleSrc: ["'self'"], scriptSrc: ["'self'"] },
    },
  }),
);
app.use(express.static(new URL('./public', import.meta.url).pathname));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    store: new MySQLStore({}, pool),
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
  }),
);
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});
app.use('/internal', internalRoutes);
app.get('/healthz', healthz);
app.use('/line/webhook', (_req, res) => res.sendStatus(501));
app.use(csrf);
app.use(
  '/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
);
app.use(authRoutes);
app.use(requireAuth);
app.use(dashboardRoutes);
app.use(roomsRoutes);
app.use(tenantsRoutes);
app.use(settingsRoutes);
app.use(readingsRoutes);
app.use(billsRoutes);
app.use(notFound);
app.use(errors);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Juristic Platform listening on :${port}`));
