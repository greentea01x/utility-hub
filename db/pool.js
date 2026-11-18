import pg from 'pg';
import { connectionString } from './connection.js';
import { log } from '../lib/log.js';

const { Pool } = pg;
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_SIZE ?? 10),
});
pool.on('error', (error) => {
  log('error', 'Database pool connection error', {
    code: typeof error.code === 'string' ? error.code : 'UNKNOWN',
  });
});

const parameterize = (sql) => {
  let index = 0;
  return sql.replaceAll('?', () => `$${++index}`);
};

pool.execute = async (sql, params = []) => {
  const result = await pool.query(parameterize(sql), params);
  return [result.rows, result.fields];
};

pool.getConnection = async () => {
  const client = await pool.connect();
  client.execute = async (sql, params = []) => {
    const result = await client.query(parameterize(sql), params);
    return [result.rows, result.fields];
  };
  client.beginTransaction = () => client.query('BEGIN');
  client.commit = () => client.query('COMMIT');
  client.rollback = () => client.query('ROLLBACK');
  return client;
};

export default pool;
