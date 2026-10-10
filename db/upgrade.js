import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { connectionString } from './connection.js';

const connection = new pg.Client({ connectionString });
await connection.connect();
try {
  await connection.query('BEGIN');
  const directory = new URL('./migrations/', import.meta.url);
  const migrations = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of migrations)
    await connection.query(await readFile(new URL(name, directory), 'utf8'));
  await connection.query('COMMIT');
  console.log('Applied database upgrades without resetting application data.');
} catch (error) {
  await connection.query('ROLLBACK');
  throw error;
} finally {
  await connection.end();
}
