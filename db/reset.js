import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { connectionString } from './connection.js';
import { schemaSql } from './migrations.js';

const schemaOnly = process.argv.includes('--schema-only');
const seedOnly = process.argv.includes('--seed-only');

if (!schemaOnly && !seedOnly) throw new Error('Use --schema-only or --seed-only');
if (!schemaOnly && !process.env.SEED_ADMIN_PASSWORD)
  throw new Error('SEED_ADMIN_PASSWORD is required');
const connection = new pg.Client({
  connectionString,
});
await connection.connect();
try {
  await connection.query('BEGIN');
  if (!seedOnly) await connection.query(await schemaSql());
  if (!schemaOnly) {
    const hash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 10);
    const sql = (await readFile(new URL('./seed.sql', import.meta.url), 'utf8')).replace(
      '__ADMIN_PASSWORD_HASH__',
      hash,
    );
    await connection.query(sql);
    console.log('Seeded admin and apartment settings.');
  }
  await connection.query('COMMIT');
} catch (error) {
  await connection.query('ROLLBACK');
  throw error;
} finally {
  await connection.end();
}
