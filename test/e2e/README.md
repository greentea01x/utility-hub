# Browser E2E tests

These tests use Playwright with installed Google Chrome and an app backed by PostgreSQL. They are
single-worker because the application uses one shared database. The default smoke
scenarios only read application data and create login sessions.

The room 205 billing scenario is opt-in because it writes readings, a bill, a payment,
and a receipt to the configured database. Run `npm run db:reset` against a disposable
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

To run **all five scenarios**, including the database-mutating room 205 path, without touching the
public demo data, set `TEST_DATABASE_URL` in `.env.test` and run:

```sh
npm run test:e2e:isolated
```

This command starts a separate app on an ephemeral loopback port backed by a newly seeded
`juristic_test_*` schema, enables the billing scenario only there, and removes the schema after
the browser runner exits. It checks public application data before and after the run. It uses
the same isolation fixture as the [integration suite](../integration/README.md).
