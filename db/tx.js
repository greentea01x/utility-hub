import pool from './pool.js';

export async function withTx(fn) {
  const connection = await pool.connect();
  connection.execute = async (sql, params = []) => {
    let index = 0;
    const result = await connection.query(sql.replaceAll('?', () => `$${++index}`), params);
    return [result.rows, result.fields];
  };
  try {
    await connection.query('BEGIN');
    const result = await fn(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}
