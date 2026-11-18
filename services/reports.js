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

export async function dashboardOverview(period) {
  const [roomResult, totalsResult, itemsResult, chartsResult] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE status = 'Occupied')::int AS occupied,
      count(*) FILTER (WHERE status = 'Vacant')::int AS vacant,
      count(DISTINCT floor)::int AS floors FROM rooms`),
    pool.query(
      `SELECT
      count(*) FILTER (WHERE period = $1 AND status IN ('Unpaid','Paid'))::int AS approved,
      count(*) FILTER (WHERE period = $1 AND status = 'Draft')::int AS drafts,
      count(*) FILTER (WHERE period = $1 AND status = 'Paid')::int AS paid_count,
      count(*) FILTER (WHERE period = $1 AND status = 'Unpaid' AND due_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date)::int AS pending_count,
      count(*) FILTER (WHERE period = $1 AND status = 'Unpaid' AND due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date)::int AS overdue_count,
      COALESCE(SUM(total) FILTER (WHERE period = $1 AND status IN ('Unpaid','Paid')),0)::numeric(14,2) AS billed,
      COALESCE(SUM(total) FILTER (WHERE period = $1 AND status = 'Paid'),0)::numeric(14,2) AS paid,
      COALESCE(SUM(total) FILTER (WHERE period = $1 AND status = 'Unpaid'),0)::numeric(14,2) AS outstanding,
      COALESCE(SUM(total) FILTER (WHERE status = 'Unpaid' AND period <= $1),0)::numeric(14,2) AS all_outstanding,
      count(*) FILTER (WHERE period = $1 AND status = 'Unpaid')::int AS outstanding_count
      FROM bills`,
      [period],
    ),
    pool.query(
      `SELECT bi.utility_type, SUM(bi.quantity) AS units, SUM(bi.amount)::numeric(14,2) AS amount,
      count(*)::int AS count FROM bill_items bi JOIN bills b ON b.id = bi.bill_id
      WHERE b.period = $1 AND b.status IN ('Unpaid','Paid') GROUP BY bi.utility_type`,
      [period],
    ),
    pool.query(
      `WITH months AS (
      SELECT to_char(day, 'YYYY-MM') AS period FROM generate_series(
        ($1 || '-01')::date - interval '11 months', ($1 || '-01')::date, interval '1 month') AS day
      ), usage AS (
        SELECT period, SUM(current_reading - previous_reading) FILTER (WHERE utility_type = 'water') AS water,
          SUM(current_reading - previous_reading) FILTER (WHERE utility_type = 'electric') AS electric
        FROM meter_readings WHERE period BETWEEN to_char(($1 || '-01')::date - interval '11 months','YYYY-MM') AND $1
        GROUP BY period
      ) SELECT months.period, COALESCE(usage.water,0) AS water, COALESCE(usage.electric,0) AS electric
      FROM months LEFT JOIN usage USING (period) ORDER BY months.period`,
      [period],
    ),
  ]);
  const items = Object.fromEntries(itemsResult.rows.map((item) => [item.utility_type, item]));
  return {
    period,
    rooms: roomResult.rows[0],
    totals: totalsResult.rows[0],
    items: Object.fromEntries(
      ['water', 'electric', 'common'].map((type) => [
        type,
        items[type] ?? { units: '0', amount: '0.00', count: 0 },
      ]),
    ),
    charts: chartsResult.rows,
  };
}
