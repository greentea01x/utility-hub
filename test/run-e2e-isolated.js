import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createDatabaseFixture } from './helpers/database.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL in .env.test');
const fixture = await createDatabaseFixture();
try {
  await fixture.pool.query(
    "INSERT INTO users (username, display_name, password_hash, role) VALUES ('staff', 'Meter reader', $1, 'staff')",
    [fixture.passwordHash],
  );
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
      env: {
        ...process.env,
        E2E_BASE_URL: fixture.baseURL,
        E2E_ADMIN_USERNAME: 'admin',
        E2E_ADMIN_PASSWORD: fixture.password,
        E2E_STAFF_USERNAME: 'staff',
        E2E_STAFF_PASSWORD: fixture.password,
        E2E_DEMO_MUTATION: '1',
      },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (exitCode) => resolve(exitCode ?? 1));
  });
  process.exitCode = code;
  if (code === 0) {
    const { rows } = await fixture.pool.query(
      'SELECT action, count(*)::int AS count FROM audit_log GROUP BY action ORDER BY action',
    );
    assert.deepEqual(rows, [
      { action: 'BILL_APPROVE', count: 1 },
      { action: 'PAYMENT_CONFIRM', count: 1 },
      { action: 'READING_CREATE', count: 4 },
    ]);
    console.log('Verified browser-created reading, approval, and payment audit records.');
  }
} finally {
  await fixture.close();
}
