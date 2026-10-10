# Browser E2E tests

These tests use Playwright with installed Google Chrome and an app backed by PostgreSQL. They are
single-worker because the application uses one shared database. The default smoke
scenarios only read application data and create login sessions.

The room 205 billing scenario is opt-in because it writes readings, a bill, a payment,
and a receipt to the configured database. A separate staff scenario writes room 206 readings
and checks the reduced dashboard, navigation, and HTTP 403 responses for financial/admin routes.
Run `npm run db:reset` against a disposable
demo database, then set `E2E_DEMO_MUTATION=1` for `npm run test:e2e`. Reset again
afterwards if you want the room 205 demo ready for another run.

For a local run:

```sh
# Set DATABASE_URL, SESSION_SECRET, and SEED_ADMIN_PASSWORD in .env.
npm run test:e2e
```

To use an already-running server, set `E2E_BASE_URL` and run `npm run test:e2e`.
This test command loads `.env` for the Playwright runner and starts the app on its
configured `PORT` unless `E2E_BASE_URL` is set.

To run **all six scenarios**, including the room 205 and staff paths, without touching the
public demo data, set `TEST_DATABASE_URL` in `.env.test` and run:

```sh
npm run test:e2e:isolated
```

This command starts a separate app on an ephemeral loopback port backed by a newly seeded
`juristic_test_*` schema, creates a temporary staff account, enables both mutation scenarios only
there, and removes the schema after the browser runner exits. It verifies the resulting meter,
approval, and payment audit rows and checks public application data before and after the run. It uses
the same isolation fixture as the [integration suite](../integration/README.md).
