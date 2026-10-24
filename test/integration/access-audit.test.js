import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createDatabaseFixture, createHttpClient } from '../helpers/database.js';

describe(
  'Staff access and transactional audit history',
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
    let createAnnouncement;

    before(async () => {
      db = await createDatabaseFixture();
      ({ saveReadings } = await import('../../services/readings.js'));
      ({ generateDrafts, approveBills } = await import('../../services/billing.js'));
      ({ confirmPayment } = await import('../../services/payment.js'));
      ({ createLinkCode, consumeLinkCode } = await import('../../services/linking.js'));
      ({ createAnnouncement } = await import('../../services/announcements.js'));
    });
    beforeEach(async () => {
      await db.reset();
    });
    after(async () => {
      if (db) await db.close();
    });

    async function signIn(role = 'admin') {
      if (role === 'staff')
        await db.pool.query(
          "INSERT INTO users (username, display_name, password_hash, role) VALUES ('staff', 'Meter reader', $1, 'staff')",
          [db.passwordHash],
        );
      const browser = createHttpClient(db.baseURL);
      await browser.request('/login');
      const result = await browser.request('/login', {
        method: 'POST',
        body: { username: role, password: db.password },
      });
      assert.equal(result.status, 302);
      assert.equal(result.headers.get('location'), role === 'staff' ? '/readings' : '/dashboard');
      await browser.request(result.headers.get('location'));
      return browser;
    }

    async function readings(values = { water: 1260, electric: 5350 }, userId = 1) {
      return saveReadings({
        roomId: 21,
        period: '2026-09',
        values,
        userId,
        technicianName: 'สมชาย ช่างอาคาร',
      });
    }

    async function draft() {
      await readings();
      await generateDrafts('2026-09', 1);
      return (await db.pool.query('SELECT id FROM bills WHERE room_id = 21')).rows[0].id;
    }

    async function history(action) {
      return (
        await db.pool.query('SELECT * FROM audit_log WHERE action = $1 ORDER BY id', [action])
      ).rows;
    }

    it('denies every implemented admin page, financial API, CSV, and mutation to staff', async () => {
      const billId = await draft();
      await approveBills([billId], 1);
      const payment = await confirmPayment(billId, 1);
      await db.pool.query(
        "INSERT INTO notifications (tenant_id, type, body) VALUES (21, 'ANNOUNCEMENT', 'Queued message')",
      );
      const staff = await signIn('staff');
      const paths = [
        '/tenants',
        '/settings',
        '/announcements',
        '/rooms/new',
        '/users',
        '/bills?period=2026-09',
        `/receipts/${payment.receipt_id}`,
        '/reports/arrears?period=2026-09',
        '/reports/arrears?period=2026-09&format=csv',
        '/api/dashboard/charts?period=2026-09',
        '/api/bills',
        '/api/tenants',
        '/api/settings',
      ];
      for (const path of paths) {
        const result = await staff.request(path);
        assert.equal(result.status, 403, path);
        assert.doesNotMatch(result.text, /1790\.00|Queued message|REC-\d|U-demo/);
      }
      const posts = [
        ['/bills/generate', { period: '2026-09' }],
        ['/api/bills/generate', { period: '2026-09' }],
        [`/bills/${billId}/approve`, {}],
        ['/api/bills/approve', { bill_ids: [billId] }],
        [`/bills/${billId}/pay`, {}],
        [`/api/bills/${billId}/confirm-payment`, {}],
        ['/api/notifications/drain', {}],
        ['/tenants/21/link-code', {}],
        ['/announcements', { title: 'Denied', body: 'Denied', audience: 'all' }],
        ['/rooms/21', {}],
      ];
      for (const [path, body] of posts) {
        assert.equal((await staff.request(path, { method: 'POST', body })).status, 403, path);
      }
      assert.equal(
        (await db.pool.query('SELECT status FROM notifications')).rows[0].status,
        'queued',
      );
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS n FROM announcements')).rows[0].n,
        0,
      );
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM link_codes')).rows[0].n, 0);
      const html = (await staff.request('/dashboard')).text;
      assert.doesNotMatch(html, /href="\/(bills|reports|tenants|settings)|ใบเสร็จ|1790\.00/);
      assert.match(html, /href="\/rooms"/);
      assert.match(html, /href="\/readings"/);
      assert.doesNotMatch((await staff.request('/readings')).text, /href="\/bills/);
    });

    it('returns only room and reading progress to staff without needing financial tables', async () => {
      await draft();
      const staff = await signIn('staff');
      await db.pool.query(
        'ALTER TABLE bills RENAME TO inaccessible_bills; ALTER TABLE rates RENAME TO inaccessible_rates',
      );
      try {
        const response = await staff.request('/api/dashboard/summary?period=2026-09');
        assert.equal(response.status, 200);
        assert.deepEqual(response.json.data, {
          period: '2026-09',
          rooms_total: 80,
          rooms_occupied: 67,
          readings_complete: 1,
          readings_remaining: 66,
        });
        assert.equal((await staff.request('/dashboard')).status, 200);
        assert.equal((await staff.request('/api/dashboard/summary?period=2026-13')).status, 422);
      } finally {
        await db.pool.query(
          'ALTER TABLE inaccessible_bills RENAME TO bills; ALTER TABLE inaccessible_rates RENAME TO rates',
        );
      }
    });

    it('allows staff room inspection and meter saves, attributing the audit to that staff user', async () => {
      const staff = await signIn('staff');
      assert.equal((await staff.request('/rooms')).status, 200);
      const response = await staff.request('/api/readings', {
        method: 'POST',
        body: {
          room_id: 21,
          period: '2026-09',
          utility_type: 'water',
          current_reading: 1260,
          technician_name: 'สมชาย ช่างอาคาร',
        },
      });
      assert.equal(response.status, 200);
      assert.equal(response.json.data.units, 10);
      const [entry] = await history('READING_CREATE');
      assert.equal(entry.actor_user_id, '2');
      assert.equal(entry.actor_source, 'user');
      assert.equal(entry.after_json.current_reading, '1260.00');
    });

    it('keeps the admin financial dashboard, navigation, reports, and notification access', async () => {
      await draft();
      const admin = await signIn();
      const summary = await admin.request('/api/dashboard/summary?period=2026-09');
      assert.equal(summary.status, 200);
      assert.equal(summary.json.data.billed, '1790.00');
      assert.match((await admin.request('/dashboard')).text, /href="\/bills"/);
      assert.equal((await admin.request('/api/dashboard/charts?period=2026-09')).status, 200);
      assert.equal((await admin.request('/reports/arrears?period=2026-09&format=csv')).status, 200);
      assert.equal(
        (await admin.request('/api/notifications/drain', { method: 'POST', body: {} })).status,
        200,
      );
    });

    it('records reading creation and edits with decimal snapshots and the associated draft bill', async () => {
      const billId = await draft();
      const created = await history('READING_CREATE');
      assert.equal(created.length, 2);
      assert.equal(created[0].before_json, null);
      assert.equal(created[0].actor_user_id, '1');
      assert.equal(created[0].bill_id, null);
      await readings(); // Identical saves do not rewrite the reading or append a fictitious edit.
      assert.equal((await history('READING_EDIT')).length, 0);
      await readings({ water: 1261 });
      const [edit] = await history('READING_EDIT');
      assert.equal(edit.entity_type, 'reading');
      assert.equal(edit.entity_id, created[0].entity_id);
      assert.equal(edit.bill_id, billId);
      assert.equal(edit.before_json.current_reading, '1260.00');
      assert.equal(edit.after_json.current_reading, '1261.00');
      assert.equal(edit.after_json.previous_reading, '1250.00');
      assert.ok(edit.created_at);
    });

    it('rolls back earlier readings and their audit entries when a later utility fails validation', async () => {
      await assert.rejects(readings({ water: 1260, electric: 5279 }), {
        code: 'READING_BELOW_PREVIOUS',
      });
      assert.equal((await history('READING_CREATE')).length, 0);
      assert.equal(
        (
          await db.pool.query(
            "SELECT count(*)::int AS n FROM meter_readings WHERE period = '2026-09'",
          )
        ).rows[0].n,
        0,
      );
    });

    it('audits concurrent approval exactly once with the before and after bill states', async () => {
      const billId = await draft();
      const results = await Promise.all([approveBills([billId], 1), approveBills([billId], 1)]);
      assert.equal(
        results.reduce((n, result) => n + result.approved, 0),
        1,
      );
      assert.equal(
        results.reduce((n, result) => n + result.already_approved, 0),
        1,
      );
      const entries = await history('BILL_APPROVE');
      assert.equal(entries.length, 1);
      assert.equal(entries[0].bill_id, billId);
      assert.equal(entries[0].before_json.status, 'Draft');
      assert.equal(entries[0].after_json.status, 'Unpaid');
      assert.equal(entries[0].after_json.total, '1790.00');
      assert.equal(entries[0].actor_user_id, '1');
      await assert.rejects(readings({ water: 1261 }), { code: 'READING_LOCKED' });
      assert.equal((await history('READING_EDIT')).length, 0);
    });

    it('audits the one winning cash payment with its receipt and exact amount', async () => {
      const billId = await draft();
      await approveBills([billId], 1);
      const results = await Promise.allSettled([
        confirmPayment(billId, 1),
        confirmPayment(billId, 1),
      ]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(results.find((result) => result.status === 'rejected').reason.status, 409);
      const payment = results.find((result) => result.status === 'fulfilled').value;
      const entries = await history('PAYMENT_CONFIRM');
      assert.equal(entries.length, 1);
      assert.equal(entries[0].entity_id, payment.payment_id);
      assert.equal(entries[0].bill_id, billId);
      assert.equal(entries[0].before_json.bill_status, 'Unpaid');
      assert.equal(entries[0].after_json.bill_status, 'Paid');
      assert.equal(entries[0].after_json.receipt_id, payment.receipt_id);
      assert.equal(entries[0].after_json.amount, '1790.00');
    });

    it('audits LINE linking once as a webhook action without storing the one-time code', async () => {
      const code = await createLinkCode(21);
      const result = await Promise.all([
        consumeLinkCode(code, 'U-audit-a'),
        consumeLinkCode(code, 'U-audit-b'),
      ]);
      assert.deepEqual(result.sort(), [false, true]);
      const entries = await history('TENANT_LINE_LINK');
      assert.equal(entries.length, 1);
      assert.equal(entries[0].entity_id, '21');
      assert.equal(entries[0].actor_user_id, null);
      assert.equal(entries[0].actor_source, 'line_webhook');
      assert.ok(['U-audit-a', 'U-audit-b'].includes(entries[0].after_json.line_user_id));
      assert.ok(entries[0].after_json.line_linked_at);
      assert.doesNotMatch(JSON.stringify(entries), new RegExp(code));
      assert.doesNotMatch(JSON.stringify(entries), /password_hash|SESSION_SECRET|DATABASE_URL/);
    });

    it('commits announcement creation and its audit together without claiming LINE delivery', async () => {
      const admin = await signIn();
      const response = await admin.request('/announcements', {
        method: 'POST',
        body: {
          title: 'Maintenance',
          body: 'Water supply maintenance tomorrow',
          audience: 'all',
        },
      });
      assert.equal(response.status, 302);
      const [entry] = await history('ANNOUNCEMENT_SEND');
      assert.equal(entry.entity_type, 'announcement');
      assert.equal(entry.actor_user_id, '1');
      assert.equal(entry.before_json, null);
      assert.equal(entry.after_json.title, 'Maintenance');
      assert.equal(entry.after_json.delivery_status, 'not_dispatched');
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS n FROM announcements')).rows[0].n,
        1,
      );
    });

    it('rolls back each implemented business mutation when its audit insert fails', async () => {
      const billId = await draft();
      const code = await createLinkCode(21);
      const tenantBefore = (await db.pool.query('SELECT line_user_id FROM tenants WHERE id = 21'))
        .rows[0].line_user_id;
      await db.pool
        .query(`CREATE FUNCTION reject_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Injected audit persistence failure'; END; $$`);
      const reject = () =>
        db.pool.query(
          'CREATE TRIGGER reject_audit_test BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_audit_test()',
        );
      const allow = () => db.pool.query('DROP TRIGGER reject_audit_test ON audit_log');
      await reject();
      await assert.rejects(readings({ water: 1261 }), { code: 'P0001' });
      assert.equal(
        (
          await db.pool.query(
            "SELECT current_reading FROM meter_readings WHERE room_id = 21 AND period = '2026-09' AND utility_type = 'water'",
          )
        ).rows[0].current_reading,
        '1260.00',
      );
      await assert.rejects(approveBills([billId], 1), { code: 'P0001' });
      assert.equal(
        (await db.pool.query('SELECT status FROM bills WHERE id = $1', [billId])).rows[0].status,
        'Draft',
      );
      await allow();
      await approveBills([billId], 1);
      await reject();
      await assert.rejects(confirmPayment(billId, 1), { code: 'P0001' });
      assert.equal(
        (await db.pool.query('SELECT status FROM bills WHERE id = $1', [billId])).rows[0].status,
        'Unpaid',
      );
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM payments')).rows[0].n, 0);
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM receipts')).rows[0].n, 0);
      await assert.rejects(consumeLinkCode(code, 'U-audit-rejected'), { code: 'P0001' });
      assert.equal(
        (await db.pool.query('SELECT used_at FROM link_codes WHERE code = $1', [code])).rows[0]
          .used_at,
        null,
      );
      assert.equal(
        (await db.pool.query('SELECT line_user_id FROM tenants WHERE id = 21')).rows[0]
          .line_user_id,
        tenantBefore,
      );
      await assert.rejects(
        createAnnouncement({ title: 'Rejected', body: 'Rejected', audience: 'all' }, 1),
        { code: 'P0001' },
      );
      assert.equal(
        (await db.pool.query('SELECT count(*)::int AS n FROM announcements')).rows[0].n,
        0,
      );
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n, 3);
      await allow();
      await db.pool.query('DROP FUNCTION reject_audit_test()');
    });

    it('prevents normal SQL from updating, deleting, or truncating audit history', async () => {
      await readings({ water: 1260 });
      const before = await history('READING_CREATE');
      for (const sql of [
        "UPDATE audit_log SET reason = 'Tampered'",
        'DELETE FROM audit_log',
        'TRUNCATE audit_log',
      ]) {
        await assert.rejects(db.pool.query(sql), { code: '55000' });
      }
      assert.deepEqual(await history('READING_CREATE'), before);
      await assert.rejects(
        db.pool.query(`INSERT INTO audit_log (entity_type, entity_id, action)
      VALUES ('room', 21, 'ROOM_EDIT')`),
        { code: '23514' },
      );
    });

    it('upgrades a legacy schema and preserves business rows and existing audit entries on reruns', async () => {
      await db.pool.query('DROP TABLE audit_log');
      const migration = await readFile(
        new URL('../../db/migrations/002-audit-log.sql', import.meta.url),
        'utf8',
      );
      await db.pool.query(migration);
      await readings({ water: 1260 });
      const before = await history('READING_CREATE');
      await db.pool.query(migration);
      await db.pool.query(migration);
      assert.deepEqual(await history('READING_CREATE'), before);
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM rooms')).rows[0].n, 80);
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM tenants')).rows[0].n, 67);
      await assert.rejects(db.pool.query('DELETE FROM audit_log'), { code: '55000' });
    });
  },
);
