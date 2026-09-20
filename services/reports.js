import pool from '../db/pool.js';

export async function dashboardSummary(period) {
  const [[summary]] = await pool.execute(
    `SELECT COUNT(*) AS bills, COALESCE(SUM(total),0) AS billed,
    SUM(status='Paid') AS paid FROM bills WHERE period=?`,
    [period],
  );
  const [[rooms]] = await pool.execute(
    "SELECT COUNT(*) AS total, SUM(status='Occupied') AS occupied FROM rooms",
  );
  return {
    period,
    bills: Number(summary.bills),
    billed: summary.billed,
    paid: Number(summary.paid ?? 0),
    rooms_total: Number(rooms.total),
    rooms_occupied: Number(rooms.occupied ?? 0),
  };
}

export async function arrearsReport(period) {
  const [rows] = await pool.execute(
    `SELECT r.room_number, t.full_name, b.total, b.due_date
    FROM bills b JOIN rooms r ON r.id=b.room_id LEFT JOIN tenants t ON t.room_id=r.id AND t.status='Active'
    WHERE b.period=? AND b.status='Unpaid' ORDER BY r.room_number`,
    [period],
  );
  return rows;
}
