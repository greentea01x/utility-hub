import pg from 'pg';
import { connectionString } from './connection.js';
import { migrationSql } from './migrations.js';

const connection = new pg.Client({ connectionString });
await connection.connect();
try {
  await connection.query('BEGIN');
  await connection.query(await migrationSql());
  await connection.query('COMMIT');
  console.log('Applied database upgrades without resetting application data.');
} catch (error) {
  await connection.query('ROLLBACK');
  throw error;
} finally {
  await connection.end();
}
