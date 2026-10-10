import { spawn } from 'node:child_process';
import { createDatabaseFixture } from './helpers/database.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL in .env.test');
const fixture = await createDatabaseFixture();
try {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
      env: {
        ...process.env,
        E2E_BASE_URL: fixture.baseURL,
        E2E_ADMIN_USERNAME: 'admin',
        E2E_ADMIN_PASSWORD: fixture.password,
        E2E_DEMO_MUTATION: '1',
      },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (exitCode) => resolve(exitCode ?? 1));
  });
  process.exitCode = code;
} finally {
  await fixture.close();
}
