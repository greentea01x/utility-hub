import pool from '../db/pool.js';

export async function listRooms({ filter = 'all', page = 1, pageSize = 20 }) {
  const where = filter === 'all' ? '' : 'WHERE status = ?';
  const params =
    filter === 'all'
      ? []
      : [filter === 'occupied' ? 'Occupied' : filter === 'vacant' ? 'Vacant' : 'Inactive'];
  const offset = (Math.max(1, Number(page)) - 1) * pageSize;
  const [rows] = await pool.execute(
    `SELECT id, room_number, floor, area_sqm, status FROM rooms ${where} ORDER BY floor, room_number LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM rooms ${where}`, params);
  return { rows, total: Number(countRows[0].total), page: Math.max(1, Number(page)), pageSize };
}

export async function listTenants({ status = 'active', query = '' }) {
  const clauses = [];
  const params = [];
  if (status !== 'all') {
    clauses.push('t.status = ?');
    params.push(status === 'active' ? 'Active' : 'Inactive');
  }
  if (query) {
    clauses.push('(t.full_name LIKE ? OR t.phone LIKE ? OR r.room_number LIKE ?)');
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  const [rows] = await pool.execute(
    `SELECT t.id, t.full_name, t.phone, t.status, t.line_user_id, r.room_number FROM tenants t JOIN rooms r ON r.id=t.room_id ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY r.floor, r.room_number`,
    params,
  );
  return rows;
}

export async function getSettings() {
  const [[settings], [rates]] = await Promise.all([
    pool.execute('SELECT * FROM settings WHERE id = 1'),
    pool.execute(
      'SELECT utility_type, unit_price, effective_from FROM rates ORDER BY utility_type, effective_from DESC',
    ),
  ]);
  return { settings: settings[0], rates };
}
