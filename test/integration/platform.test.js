import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createDatabaseFixture, createHttpClient } from '../helpers/database.js';

describe(
  'PostgreSQL application integration',
  {
    skip:
      !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to run database integration tests',
    concurrency: false,
    timeout: 240000,
  },
  () => {
    let db;
    let saveReadings;
    let generateDrafts;
    let approveBills;
    let confirmPayment;
    let createLinkCode;
    let consumeLinkCode;
    let runDailyJob;

    before(async () => {
      db = await createDatabaseFixture();
      ({ saveReadings } = await import('../../services/readings.js'));
      ({ generateDrafts, approveBills } = await import('../../services/billing.js'));
      ({ confirmPayment } = await import('../../services/payment.js'));
      ({ createLinkCode, consumeLinkCode } = await import('../../services/linking.js'));
      ({ runDailyJob } = await import('../../services/jobs.js'));
    });
    beforeEach(async () => {
      await db.reset();
    });
    after(async () => {
      if (db) await db.close();
    });

    async function signIn(username = 'admin') {
      const browser = createHttpClient(db.baseURL);
      assert.equal((await browser.request('/login')).status, 200);
      const response = await browser.request('/login', {
        method: 'POST',
        body: { username, password: db.password },
      });
      assert.equal(response.status, 302);
      assert.equal(
        response.headers.get('location'),
        username === 'staff' ? '/readings' : '/dashboard',
      );
      assert.equal((await browser.request('/dashboard')).status, 200);
      return browser;
    }

    async function recordDemo(period = '2026-09') {
      return saveReadings({
        roomId: 21,
        period,
        values: { water: 1260, electric: 5350 },
        userId: 1,
      });
    }

    async function draftDemo() {
      await recordDemo();
      await generateDrafts('2026-09', 1);
      const { rows } = await db.pool.query(
        "SELECT * FROM bills WHERE room_id = 21 AND period = '2026-09'",
      );
      return rows[0];
    }

    async function addReminderBill(roomId, offset, { period = '2026-09', status = 'Unpaid' } = {}) {
      const { rows } = await db.pool.query(
        `INSERT INTO bills (room_id, period, due_date, status, subtotal, total)
      VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date + $3::int, $4, 100, 100)
      RETURNING id`,
        [roomId, period, offset, status],
      );
      return rows[0].id;
    }

    it('resets and seeds 80 rooms, 67 tenants, rates, and room 205 without touching public data', async () => {
      const { rows } = await db.pool.query(`SELECT (SELECT count(*)::int FROM rooms) AS rooms,
      (SELECT count(*)::int FROM tenants) AS tenants,
      (SELECT count(*)::int FROM tenants WHERE line_user_id IS NOT NULL) AS linked,
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM bills) AS bills`);
      assert.deepEqual(rows[0], { rooms: 80, tenants: 67, linked: 54, users: 1, bills: 0 });
      const rates = await db.pool.query(
        'SELECT utility_type, unit_price FROM rates ORDER BY utility_type',
      );
      assert.deepEqual(rates.rows, [
        { utility_type: 'common', unit_price: '35.00' },
        { utility_type: 'electric', unit_price: '8.00' },
        { utility_type: 'water', unit_price: '18.00' },
      ]);
      await draftDemo();
      await db.reset();
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS count FROM bills')).rows[0].count,
        0,
      );
      await assert.rejects(
        db.pool.query(`INSERT INTO tenants (room_id, full_name, phone, move_in_date)
      VALUES (21, 'Duplicate occupant', '0812345678', CURRENT_DATE)`),
        { code: '23505' },
      );
    });

    it('rotates and persists the login session, serves health, and protects anonymous API requests', async () => {
      const browser = createHttpClient(db.baseURL);
      assert.equal((await browser.request('/healthz')).json.data.status, 'ok');
      const login = await browser.request('/login');
      assert.match(login.headers.get('set-cookie'), /HttpOnly/);
      assert.match(login.headers.get('set-cookie'), /SameSite=Lax/);
      const previousCookie = browser.cookie;
      const response = await browser.request('/login', {
        method: 'POST',
        body: { username: 'admin', password: db.password },
      });
      assert.equal(response.status, 302);
      assert.notEqual(browser.cookie, previousCookie);
      assert.equal((await browser.request('/dashboard')).status, 200);
      const sessions = await db.pool.query(
        "SELECT sess->'user'->>'username' AS username FROM sessions",
      );
      assert.deepEqual(sessions.rows, [{ username: 'admin' }]);
      const anonymous = createHttpClient(db.baseURL);
      const denied = await anonymous.request('/api/dashboard/summary?period=2026-09');
      assert.equal(denied.status, 401);
      assert.equal(denied.json.error.code, 'AUTH_REQUIRED');
    });

    it('rejects incorrect passwords and inactive users without authenticating them', async () => {
      for (const inactive of [false, true]) {
        if (inactive) await db.pool.query("UPDATE users SET status = 'Inactive' WHERE id = 1");
        const browser = createHttpClient(db.baseURL);
        await browser.request('/login');
        const response = await browser.request('/login', {
          method: 'POST',
          body: {
            username: 'admin',
            password: inactive ? db.password : 'wrong-password',
          },
        });
        assert.equal(response.status, 200);
        assert.match(response.text, /role="alert"/);
        assert.equal((await browser.request('/dashboard')).headers.get('location'), '/login');
      }
    });

    it('rejects missing, altered, multibyte, and non-string CSRF tokens with 403 and no writes', async () => {
      const browser = await signIn();
      for (const token of [undefined, '0'.repeat(64), 'ก'.repeat(64), Array(64).fill('x')]) {
        const response = await browser.request('/api/readings', {
          method: 'POST',
          csrf: false,
          body: {
            _csrf: token,
            room_id: 21,
            period: '2026-09',
            utility_type: 'water',
            current_reading: 1260,
          },
        });
        assert.equal(response.status, 403);
        assert.equal(response.json.error.code, 'CSRF_INVALID');
      }
      assert.equal(
        (
          await db.pool.query(
            "SELECT count(*)::int AS count FROM meter_readings WHERE period = '2026-09'",
          )
        ).rows[0].count,
        0,
      );
    });

    it('destroys the database session on logout', async () => {
      const browser = await signIn();
      assert.equal((await browser.request('/logout', { method: 'POST' })).status, 302);
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS count FROM sessions')).rows[0].count,
        0,
      );
      assert.equal((await browser.request('/api/dashboard/summary?period=2026-09')).status, 401);
    });

    it('allows staff readings but refuses bill generation, approval, payment, and receipt access', async () => {
      const bill = await draftDemo();
      await approveBills([bill.id], 1);
      const payment = await confirmPayment(bill.id, 1);
      await db.pool.query(
        `INSERT INTO users (username, display_name, password_hash, role)
      VALUES ('staff', 'Integration staff', $1, 'staff')`,
        [db.passwordHash],
      );
      const browser = await signIn('staff');
      assert.equal((await browser.request('/readings')).status, 200);
      for (const [path, body] of [
        ['/api/bills/generate', { period: '2026-10' }],
        ['/api/bills/approve', { bill_ids: [bill.id] }],
        [`/api/bills/${bill.id}/confirm-payment`, {}],
        [`/bills/${bill.id}/pay`, {}],
      ])
        assert.equal((await browser.request(path, { method: 'POST', body })).status, 403);
      assert.equal((await browser.request('/bills')).status, 403);
      const receipt = await browser.request(`/receipts/${payment.receipt_id}`);
      assert.equal(receipt.status, 403);
      assert.doesNotMatch(receipt.text, /1790\.00/);
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS count FROM payments')).rows[0].count,
        1,
      );
    });

    it('saves room 205 readings through HTTP using the previous readings and computes units', async () => {
      const browser = await signIn();
      for (const [utility, current, units] of [
        ['water', 1260, 10],
        ['electric', 5350, 70],
      ]) {
        const result = await browser.request('/api/readings', {
          method: 'POST',
          body: {
            room_id: 21,
            period: '2026-09',
            utility_type: utility,
            current_reading: current,
          },
        });
        assert.equal(result.status, 200);
        assert.equal(result.json.data.units, units);
      }
      const { rows } = await db.pool.query(
        "SELECT utility_type, previous_reading FROM meter_readings WHERE period = '2026-09' ORDER BY utility_type",
      );
      assert.deepEqual(rows, [
        { utility_type: 'electric', previous_reading: '5280.00' },
        { utility_type: 'water', previous_reading: '1250.00' },
      ]);
    });

    it('rolls back a two-utility save when one reading decreases and rejects unavailable rooms', async () => {
      await assert.rejects(
        saveReadings({
          roomId: 21,
          period: '2026-09',
          values: { water: 1260, electric: 5279 },
          userId: 1,
        }),
        { code: 'READING_BELOW_PREVIOUS', status: 422 },
      );
      assert.equal(
        (
          await db.pool.query(
            "SELECT count(*)::int AS count FROM meter_readings WHERE period = '2026-09'",
          )
        ).rows[0].count,
        0,
      );
      await assert.rejects(
        saveReadings({ roomId: 80, period: '2026-09', values: { water: 1 }, userId: 1 }),
        { code: 'ROOM_NOT_OCCUPIED' },
      );
      await assert.rejects(
        saveReadings({ roomId: 9999, period: '2026-09', values: { water: 1 }, userId: 1 }),
        { code: 'ROOM_NOT_FOUND' },
      );
    });

    it('uses the last available reading after missed months and edits without duplicating rows', async () => {
      await recordDemo('2026-11');
      await saveReadings({ roomId: 21, period: '2026-11', values: { water: 1261 }, userId: 1 });
      const { rows } = await db.pool.query(
        "SELECT previous_reading, current_reading FROM meter_readings WHERE room_id = 21 AND period = '2026-11' AND utility_type = 'water'",
      );
      assert.deepEqual(rows, [{ previous_reading: '1250.00', current_reading: '1261.00' }]);
    });

    it('rejects invalid calendar months before readings or bill generation write to the database', async () => {
      const browser = await signIn();
      for (const period of ['2026-00', '2026-13', '2026-1']) {
        assert.equal(
          (
            await browser.request('/api/readings', {
              method: 'POST',
              body: {
                room_id: 21,
                period,
                utility_type: 'water',
                current_reading: 1260,
              },
            })
          ).status,
          422,
        );
        assert.equal(
          (await browser.request('/api/bills/generate', { method: 'POST', body: { period } }))
            .status,
          422,
        );
      }
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS count FROM bills')).rows[0].count,
        0,
      );
    });

    it('generates one 1790.00-baht draft with three items and recalculates it without counting it as new', async () => {
      await recordDemo();
      assert.equal((await generateDrafts('2026-09', 1)).generated, 1);
      assert.equal((await generateDrafts('2026-09', 1)).generated, 0);
      const { rows } = await db.pool.query('SELECT id, total, subtotal, status FROM bills');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].total, '1790.00');
      assert.equal(rows[0].subtotal, '1790.00');
      assert.equal(rows[0].status, 'Draft');
      const items = await db.pool.query(
        'SELECT utility_type, amount FROM bill_items ORDER BY utility_type',
      );
      assert.deepEqual(items.rows, [
        { utility_type: 'common', amount: '1050.00' },
        { utility_type: 'electric', amount: '560.00' },
        { utility_type: 'water', amount: '180.00' },
      ]);
      await saveReadings({ roomId: 21, period: '2026-09', values: { water: 1261 }, userId: 1 });
      assert.equal((await generateDrafts('2026-09', 1)).generated, 0);
      assert.equal((await db.pool.query('SELECT total FROM bills')).rows[0].total, '1808.00');
    });

    it('serializes concurrent generation without duplicate bills or line items', async () => {
      await recordDemo();
      const results = await Promise.all([
        generateDrafts('2026-09', 1),
        generateDrafts('2026-09', 1),
      ]);
      assert.equal(
        results.reduce((sum, result) => sum + result.generated, 0),
        1,
      );
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS count FROM bills')).rows[0].count,
        1,
      );
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS count FROM bill_items')).rows[0].count,
        3,
      );
    });

    it('rounds each decimal line item in PostgreSQL and sums the rounded amounts', async () => {
      await db.pool.query('UPDATE rooms SET area_sqm = 1 WHERE id = 21');
      await db.pool.query(
        "UPDATE rates SET unit_price = CASE WHEN utility_type = 'common' THEN 1 ELSE 1.50 END",
      );
      await saveReadings({
        roomId: 21,
        period: '2026-09',
        values: { water: 1250.01, electric: 5280.01 },
        userId: 1,
      });
      await generateDrafts('2026-09', 1);
      const items = await db.pool.query(
        'SELECT utility_type, amount FROM bill_items ORDER BY utility_type',
      );
      assert.deepEqual(items.rows, [
        { utility_type: 'common', amount: '1.00' },
        { utility_type: 'electric', amount: '0.02' },
        { utility_type: 'water', amount: '0.02' },
      ]);
      assert.equal((await db.pool.query('SELECT total FROM bills')).rows[0].total, '1.04');
    });

    it('approves once with a three-day due-date floor and freezes readings and monetary items', async () => {
      const bill = await draftDemo();
      assert.deepEqual(await approveBills([bill.id, 9999], 1), {
        approved: 1,
        already_approved: 0,
        not_found: 1,
      });
      const approved = await db.pool.query(
        "SELECT *, due_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date + 3 AS due_floor FROM bills",
      );
      assert.equal(approved.rows[0].status, 'Unpaid');
      assert.equal(approved.rows[0].due_floor, true);
      assert.deepEqual(await approveBills([bill.id], 1), {
        approved: 0,
        already_approved: 1,
        not_found: 0,
      });
      await assert.rejects(recordDemo(), { code: 'READING_LOCKED' });
      await db.pool.query('UPDATE rates SET unit_price = unit_price + 1');
      assert.equal((await generateDrafts('2026-09', 1)).generated, 0);
      assert.equal((await db.pool.query('SELECT total FROM bills')).rows[0].total, '1790.00');
      assert.equal(
        (await db.pool.query('SELECT due_date FROM bills')).rows[0].due_date,
        approved.rows[0].due_date,
      );
    });

    it('concurrent HTTP cash confirmations create one payment and receipt and reject the second with 409', async () => {
      const bill = await draftDemo();
      await approveBills([bill.id], 1);
      const browser = await signIn();
      const results = await Promise.all([
        browser.request(`/api/bills/${bill.id}/confirm-payment`, { method: 'POST', body: {} }),
        browser.request(`/api/bills/${bill.id}/confirm-payment`, { method: 'POST', body: {} }),
      ]);
      assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
      const payment = results.find((result) => result.status === 200).json.data;
      assert.equal(payment.amount, '1790.00');
      assert.match(payment.receipt_number, /^REC-\d{6}-\d{6}$/);
      const { rows } = await db.pool.query(`SELECT (SELECT count(*)::int FROM payments) AS payments,
      (SELECT count(*)::int FROM receipts) AS receipts, (SELECT status FROM bills LIMIT 1) AS status`);
      assert.deepEqual(rows[0], { payments: 1, receipts: 1, status: 'Paid' });
      const receipt = await browser.request(`/receipts/${payment.receipt_id}`);
      assert.equal(receipt.status, 200);
      assert.match(receipt.text, /1790\.00/);
      assert.equal(
        (await browser.request('/api/dashboard/summary?period=2026-09')).json.data.paid,
        1,
      );
    });

    it('refuses draft/missing payments and rolls back the Paid state if payment persistence fails', async () => {
      const bill = await draftDemo();
      await assert.rejects(confirmPayment(bill.id, 1), { status: 409 });
      await assert.rejects(confirmPayment(9999, 1), { status: 404 });
      await approveBills([bill.id], 1);
      await assert.rejects(confirmPayment(bill.id, 9999), { code: '23503' });
      assert.equal((await db.pool.query('SELECT status FROM bills')).rows[0].status, 'Unpaid');
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS count FROM payments')).rows[0].count,
        0,
      );
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS count FROM receipts')).rows[0].count,
        0,
      );
    });

    it('consumes a LINE link code once under concurrent requests', async () => {
      const code = await createLinkCode(21);
      assert.match(code, /^[A-F0-9]{6}$/);
      const results = await Promise.all([
        consumeLinkCode(code, 'U-integration-a'),
        consumeLinkCode(code, 'U-integration-b'),
      ]);
      assert.deepEqual(results.sort(), [false, true]);
      assert.equal(await consumeLinkCode(code, 'U-integration-c'), false);
      const { rows } = await db.pool.query(
        'SELECT line_user_id, line_linked_at FROM tenants WHERE id = 21',
      );
      assert.ok(['U-integration-a', 'U-integration-b'].includes(rows[0].line_user_id));
      assert.ok(rows[0].line_linked_at);
    });

    it('rejects expired link codes and rolls back code use when the LINE identity is already linked', async () => {
      const expired = await createLinkCode(21);
      await db.pool.query(
        "UPDATE link_codes SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE code = $1",
        [expired],
      );
      assert.equal(await consumeLinkCode(expired, 'U-integration-expired'), false);
      const code = await createLinkCode(22);
      await assert.rejects(consumeLinkCode(code, 'U-demo-001'), { code: '23505' });
      assert.equal(
        (await db.pool.query('SELECT used_at FROM link_codes WHERE code = $1', [code])).rows[0]
          .used_at,
        null,
      );
      assert.equal(await consumeLinkCode(code, 'U-integration-valid'), true);
    });

    it('queues only two-day pre-due and days 1/8/15 overdue reminders, excluding paid and voided payments', async () => {
      for (const [room, offset] of [
        [1, 2],
        [2, 3],
        [3, -1],
        [4, -2],
        [5, -8],
        [6, -15],
        [7, -16],
      ])
        await addReminderBill(room, offset);
      await addReminderBill(8, -1, { status: 'Paid' });
      const voided = await addReminderBill(9, -1);
      await db.pool.query(
        `INSERT INTO payments (bill_id, amount, received_by, voided_at, void_reason)
      VALUES ($1, 100, 1, CURRENT_TIMESTAMP, 'Integration void reason')`,
        [voided],
      );
      assert.deepEqual(await runDailyJob(), { queued: 4, checked: 4 });
      const { rows } = await db.pool.query(`SELECT type, count(*)::int AS count,
      bool_and(send_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date) AS correct_day
      FROM notifications GROUP BY type ORDER BY type`);
      assert.deepEqual(rows, [
        { type: 'OVERDUE', count: 3, correct_day: true },
        { type: 'PRE_DUE', count: 1, correct_day: true },
      ]);
      assert.deepEqual(await runDailyJob(), { queued: 0, checked: 4 });
    });

    it('deduplicates concurrent daily jobs per bill while preserving separate bills for one tenant', async () => {
      await addReminderBill(1, -1, { period: '2026-08' });
      await addReminderBill(1, -8, { period: '2026-09' });
      const results = await Promise.all([runDailyJob(), runDailyJob(), runDailyJob()]);
      assert.equal(
        results.reduce((sum, result) => sum + result.queued, 0),
        2,
      );
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS count FROM notifications')).rows[0].count,
        2,
      );
      await assert.rejects(
        db.pool.query(`INSERT INTO notifications (tenant_id, bill_id, type, body, send_date)
      SELECT tenant_id, bill_id, type, body, send_date FROM notifications LIMIT 1`),
        { code: '23505' },
      );
    });

    it('requires the daily-job machine token and does not require browser CSRF for an authorized job', async () => {
      const browser = createHttpClient(db.baseURL);
      await addReminderBill(1, 2);
      assert.equal(
        (await browser.request('/internal/jobs/daily', { method: 'POST', csrf: false })).status,
        401,
      );
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS count FROM notifications')).rows[0].count,
        0,
      );
      const response = await browser.request('/internal/jobs/daily', {
        method: 'POST',
        csrf: false,
        headers: { 'x-job-token': db.jobToken },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(response.json.data, { queued: 1, checked: 1 });
    });

    it('upgrades an existing notification table twice without losing legacy rows or application data', async () => {
      await db.pool.query('DROP INDEX uq_notifications_reminder');
      await db.pool.query('ALTER TABLE notifications DROP COLUMN bill_id, DROP COLUMN send_date');
      await db.pool.query(
        "INSERT INTO notifications (tenant_id, type, body) VALUES (1, 'ANNOUNCEMENT', 'Legacy notification')",
      );
      const migration = await readFile(
        new URL('../../db/migrations/001-reminder-deduplication.sql', import.meta.url),
        'utf8',
      );
      await db.pool.query(migration);
      await db.pool.query(migration);
      const { rows } = await db.pool.query(
        'SELECT body, bill_id, send_date IS NOT NULL AS has_date FROM notifications',
      );
      assert.deepEqual(rows, [{ body: 'Legacy notification', bill_id: null, has_date: true }]);
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS count FROM rooms')).rows[0].count,
        80,
      );
      await addReminderBill(1, 2);
      assert.equal((await runDailyJob()).queued, 1);
    });
  },
);
