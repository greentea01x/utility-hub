# PostgreSQL integration tests

Use Node.js 24. Put `TEST_DATABASE_URL` in the ignored `.env.test` file, using a PostgreSQL or
Supabase **Session pooler** URI. It may point to the same database as the local demo because the
suite creates its own randomly named `juristic_test_*` schema. The database role must be able to
create and drop schemas.

```sh
npm test          # unit and integration tests
npm run test:int  # integration tests only
```

If `TEST_DATABASE_URL` is absent, the integration suite is reported as skipped. A configured but
unavailable database fails the suite. Database credentials are never needed in test source code.
The fixture generates its own admin password, session secret, and job token.

Every test resets only that temporary schema. All application and session-store connections use
an exclusive `search_path` with no `public` fallback, verified before reset. The fixture runs the
real schema and demo seed, starts the real Express app on an ephemeral loopback port, and closes
the server, session store, and pool before dropping the temporary schema. It also compares row
counts and checksums for the public application tables before and after the suite. Public login
sessions are excluded from that comparison because the running demo app may create/prune them.

The tests cover schema/reset and constraints, login/session regeneration, CSRF rejection, logout,
staff restrictions on billing/payments/receipts, reading validation and transaction rollback,
draft generation/recalculation and concurrency, exact decimal amounts, approval and frozen
readings/items, concurrent payment confirmation and receipts, link-code single use and expiry,
daily-job schedule and concurrency, machine-token authentication, and the notification upgrade.
LINE tests exercise linking and the notification queue without sending external messages.

To upgrade an already initialized app database for the reminder changes, use `npm run db:upgrade`.
This command adds notification columns and the deduplication index without resetting data. It is
safe to repeat. `npm run db:reset` remains a destructive development/demo command and is not used
against the public schema by the integration suite.
