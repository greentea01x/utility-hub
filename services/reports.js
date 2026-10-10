import pool from '../db/pool.js';

// Deliberately reads only rooms and meters; financial columns never enter a staff payload.
export async function readingSummary(period) {
  const {
    rows: [summary],
  } = await pool.query(
    `SELECT count(*)::int AS rooms_total,
      count(*) FILTER (WHERE r.status = 'Occupied')::int AS rooms_occupied,
      count(*) FILTER (WHERE r.status = 'Occupied' AND m.utilities = 2)::int AS readings_complete
     FROM rooms r LEFT JOIN (
       SELECT room_id, count(DISTINCT utility_type) AS utilities
       FROM meter_readings WHERE period = $1 GROUP BY room_id
     ) m ON m.room_id = r.id`,
    [period],
  );
  return {
    period,
    ...summary,
    readings_remaining: summary.rooms_occupied - summary.readings_complete,
  };
}

export async function dashboardSummary(period) {
  const [[summary]] = await pool.execute(
    `SELECT COUNT(*) AS bills, COALESCE(SUM(total),0) AS billed,
    COUNT(*) FILTER (WHERE status='Paid') AS paid FROM bills WHERE period=?`,
    [period],
  );
  const [[rooms]] = await pool.execute(
    "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='Occupied') AS occupied FROM rooms",
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
