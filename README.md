# Juristic Platform

Walking skeleton for the apartment utility and common-area billing system.

1. Install Node.js 24 and MySQL 8.4.
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `SESSION_SECRET`, and `SEED_ADMIN_PASSWORD`.
3. Run `npm ci`.
4. Run `npm run db:reset`.
5. Start with `npm run dev`.
6. Open `http://localhost:3000/login` and sign in as `admin` with the seed password.

`GET /healthz` reports database availability. The current milestone includes authentication, the session store, CSRF protection, and the dashboard shell.
