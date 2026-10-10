import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { schemaSql as loadSchemaSql } from '../../db/migrations.js';

export async function createDatabaseFixture() {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
  const schema = `juristic_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.TEST_DATABASE_URL);
  // No public fallback: even the reset script's unqualified DROP statements stay isolated.
  url.searchParams.set(
    'options',
    `-c search_path=${schema} -c timezone=UTC -c statement_timeout=10000`,
  );
  const originalEnvironment = { ...process.env };
  const password = `integration-${randomUUID()}`;
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    SESSION_SECRET: randomUUID(),
    SEED_ADMIN_PASSWORD: password,
    JOB_TOKEN: randomUUID(),
    LINE_CHANNEL_SECRET: randomUUID(),
    LINE_CHANNEL_ACCESS_TOKEN: '',
    NODE_ENV: 'test',
    DB_POOL_SIZE: '4',
  });
  const { connectionString } = await import('../../db/connection.js');
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
  const schemaSql = await loadSchemaSql();
  const seedSql = (await readFile(new URL('../../db/seed.sql', import.meta.url), 'utf8')).replace(
    '__ADMIN_PASSWORD_HASH__',
    await bcrypt.hash(password, 10),
  );
  let pool;
  let sessionStore;
  let server;
  let schemaCreated = false;
  let baseline;

  async function assertIsolation() {
    const result = await client.query('SHOW search_path');
    assert.equal(
      result.rows[0].search_path,
      schema,
      'Test reset requires an exclusive test search_path',
    );
  }

  async function publicSnapshot() {
    const result = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      AND tablename = ANY($1::text[]) ORDER BY tablename`,
      [
        [
          'users',
          'settings',
          'rooms',
          'tenants',
          'rates',
          'meter_readings',
          'bills',
          'bill_items',
          'payments',
          'receipts',
          'link_codes',
          'notifications',
          'announcements',
          'audit_log',
        ],
      ],
    );
    const snapshot = {};
    for (const { tablename } of result.rows) {
      const { rows } = await client.query(`SELECT count(*)::int AS count,
        md5(COALESCE(string_agg(row_to_json(t)::text, '' ORDER BY id), '')) AS checksum
        FROM public."${tablename}" t`);
      snapshot[tablename] = rows[0];
    }
    return snapshot;
  }

  async function reset() {
    await assertIsolation();
    await client.query('BEGIN');
    try {
      await client.query(schemaSql);
      await client.query(seedSql);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  async function close() {
    try {
      if (server)
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      if (sessionStore) await sessionStore.close();
      if (pool) await pool.end();
      if (schemaCreated) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
      if (baseline)
        assert.deepEqual(
          await publicSnapshot(),
          baseline,
          'Public application data changed during integration tests',
        );
    } finally {
      await client.end();
      for (const key of Object.keys(process.env))
        if (!(key in originalEnvironment)) delete process.env[key];
      Object.assign(process.env, originalEnvironment);
    }
  }

  try {
    await client.connect();
    await assertIsolation();
    baseline = await publicSnapshot();
    await client.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await reset();
    ({ default: pool } = await import('../../db/pool.js'));
    // Check a separately acquired application connection, not just the bootstrap client.
    const path = await pool.query('SHOW search_path');
    assert.equal(path.rows[0].search_path, schema);
    const { default: app, sessionStore: store } = await import('../../app.js');
    sessionStore = store;
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    return {
      pool,
      password,
      schema,
      reset,
      close,
      baseURL: `http://127.0.0.1:${server.address().port}`,
      jobToken: process.env.JOB_TOKEN,
      passwordHash: await bcrypt.hash(password, 10),
    };
  } catch (error) {
    await close();
    throw error;
  }
}

export function createHttpClient(baseURL) {
  let cookie;
  let token;
  return {
    get cookie() {
      return cookie;
    },
    get token() {
      return token;
    },
    async request(path, { method = 'GET', body, csrf = true, headers = {} } = {}) {
      const requestHeaders = { ...headers };
      if (cookie) requestHeaders.cookie = cookie;
      if (body !== undefined) requestHeaders['content-type'] = 'application/json';
      if (csrf && token && method !== 'GET') requestHeaders['x-csrf-token'] = token;
      const response = await fetch(`${baseURL}${path}`, {
        method,
        headers: requestHeaders,
        redirect: 'manual',
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      for (const value of response.headers.getSetCookie()) cookie = value.split(';')[0];
      const text = await response.text();
      const match = text.match(/name="_csrf" value="([^"]+)"/);
      if (match) token = match[1];
      return {
        status: response.status,
        headers: response.headers,
        text,
        json: response.headers.get('content-type')?.includes('application/json')
          ? JSON.parse(text)
          : undefined,
      };
    },
  };
}
