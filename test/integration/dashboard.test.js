import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createDatabaseFixture, createHttpClient } from '../helpers/database.js';
import { currentPeriod, shiftPeriod } from '../../lib/presentation.js';
import { navigationFor } from '../../lib/permissions.js';

describe(
  'Residence dashboard and specification navigation',
  {
    skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL',
    concurrency: false,
    timeout: 240000,
  },
  () => {
    let db, overview;
    before(async () => {
      db = await createDatabaseFixture();
      ({ dashboardOverview: overview } = await import('../../services/reports.js'));
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
          "INSERT INTO users (username,display_name,password_hash,role) VALUES ('staff','Staff',$1,'staff')",
          [db.passwordHash],
        );
      const browser = createHttpClient(db.baseURL);
      await browser.request('/login');
      assert.equal(
        (
          await browser.request('/login', {
            method: 'POST',
            body: { username: role, password: db.password },
          })
        ).status,
        302,
      );
      return browser;
    }
    it('uses Bangkok month boundaries and supports year transitions', () => {
      assert.equal(currentPeriod(new Date('2026-09-30T17:00:00Z')), '2026-10');
      assert.equal(currentPeriod(new Date('2026-09-30T16:59:59Z')), '2026-09');
      assert.equal(shiftPeriod('2026-01', -1), '2025-12');
      assert.equal(shiftPeriod('2026-12', 1), '2027-01');
    });
    it('computes approved decimal totals, due-date buckets and arrears through the selected period', async () => {
      await db.pool.query(`INSERT INTO bills (room_id,period,status,due_date,total) VALUES
      (1,'2026-09','Paid','2026-09-05',100.10),
      (2,'2026-09','Unpaid',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date,200.20),
      (3,'2026-09','Unpaid',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date - 1,300.30),
      (4,'2026-09','Draft','2026-09-05',999.99),
      (5,'2026-09','Voided','2026-09-05',888.88),
      (6,'2026-08','Unpaid','2026-08-05',50.05),
      (7,'2026-10','Unpaid','2026-10-05',70.07)`);
      await db.pool
        .query(`INSERT INTO bill_items (bill_id,utility_type,description,quantity,unit_price,amount)
      SELECT id,'water','Water',10,10.01,total FROM bills WHERE room_id IN (1,4,5)`);
      const result = await overview('2026-09');
      assert.deepEqual(result.rooms, { total: 80, occupied: 67, vacant: 13, floors: 5 });
      assert.deepEqual(result.totals, {
        approved: 3,
        drafts: 1,
        paid_count: 1,
        pending_count: 1,
        overdue_count: 1,
        billed: '600.60',
        paid: '100.10',
        outstanding: '500.50',
        all_outstanding: '550.55',
        outstanding_count: 2,
      });
      assert.equal(result.items.water.amount, '100.10');
      assert.equal(result.items.water.count, 1);
      assert.equal(result.items.electric.amount, '0.00');
    });
    it('returns exactly twelve chronological real usage buckets with empty months and window boundaries', async () => {
      await db.pool
        .query(`INSERT INTO meter_readings (room_id,period,utility_type,previous_reading,current_reading,recorded_by) VALUES
      (1,'2025-09','water',0,999,1),(1,'2025-10','water',10,22.5,1),
      (1,'2026-09','electric',100,171.25,1),(1,'2026-10','water',0,888,1)`);
      const result = await overview('2026-09');
      assert.equal(result.charts.length, 12);
      assert.equal(result.charts[0].period, '2025-10');
      assert.equal(Number(result.charts[0].water), 12.5);
      assert.equal(Number(result.charts[1].water), 0);
      assert.equal(Number(result.charts[10].water), 10);
      assert.equal(Number(result.charts[10].electric), 80);
      assert.equal(result.charts[11].period, '2026-09');
      assert.equal(Number(result.charts[11].electric), 71.25);
      const admin = await signIn();
      const api = await admin.request('/api/dashboard/charts?period=2026-09');
      assert.equal(api.status, 200);
      assert.deepEqual(api.json.data, { period: '2026-09', series: result.charts });
    });
    it('renders every admin specification menu destination and rejects invalid periods', async () => {
      const admin = await signIn();
      for (const page of navigationFor('admin')) {
        const result = await admin.request(page.href);
        assert.equal(result.status, 200, page.href);
        assert.match(result.text, /สุขธารา เรสซิเดนซ์/);
        assert.doesNotMatch(result.text, /UtilityHub|password_hash/);
      }
      for (const path of ['/payments/history?period=2026-09', '/dashboard?period=2026-09']) {
        assert.equal((await admin.request(path)).status, 200, path);
      }
      for (const path of [
        '/dashboard?period=2026-13',
        '/payments/history?period=oops',
        '/readings?filter=invalid',
        '/api/dashboard/charts?period=2026-00',
      ]) {
        assert.equal((await admin.request(path)).status, 422, path);
      }
      assert.match((await admin.request('/reports')).text, /อยู่ระหว่างพัฒนา/);
    });
    it('filters meter completeness and vacant rooms without leaking financial or tenant information to staff', async () => {
      await db.pool
        .query(`INSERT INTO meter_readings (room_id,period,utility_type,previous_reading,current_reading,recorded_by)
      VALUES (1,'2026-09','water',0,1,1),(1,'2026-09','electric',0,2,1),(2,'2026-09','water',0,3,1)`);
      const staff = await signIn('staff');
      const complete = await staff.request('/readings?period=2026-09&filter=complete');
      assert.equal(complete.status, 200);
      assert.match(complete.text, /data-room="101"/);
      assert.doesNotMatch(
        complete.text,
        /data-room="102"|href="\/(payments|users|reports|tenants|bills|settings)|password_hash/,
      );
      const pending = await staff.request('/readings?period=2026-09&filter=pending&q=102');
      assert.match(pending.text, /data-room="102"/);
      assert.doesNotMatch(pending.text, /data-room="101"/);
      const vacant = await staff.request('/readings?period=2026-09&filter=vacant');
      assert.equal((vacant.text.match(/data-vacant="true"/g) ?? []).length, 13);
      assert.doesNotMatch(vacant.text, /name="water"/);
      for (const path of ['/payments', '/payments/history', '/users', '/reports'])
        assert.equal((await staff.request(path)).status, 403, path);
    });
    it('lists unpaid bills from all periods and groups receipt history by Bangkok payment month', async () => {
      await db.pool.query(`INSERT INTO bills (room_id,period,status,due_date,total) VALUES
      (1,'2026-08','Unpaid','2026-08-05',123.45),
      (2,'2026-09','Draft','2026-09-05',987.65),
      (3,'2026-08','Paid','2026-08-05',111.11),
      (4,'2026-08','Paid','2026-08-05',222.22)`);
      await db.pool.query(`INSERT INTO payments (bill_id,amount,received_by,received_at)
      SELECT id,total,1,CASE room_id WHEN 3 THEN '2026-08-31T16:59:59Z'::timestamptz ELSE '2026-08-31T17:00:00Z'::timestamptz END
      FROM bills WHERE status='Paid'`);
      await db.pool.query(`INSERT INTO receipts (payment_id,receipt_number)
      SELECT id, 'REC-UI-' || id FROM payments`);
      const admin = await signIn();
      const counter = await admin.request('/payments');
      assert.match(counter.text, /123.45/);
      assert.doesNotMatch(counter.text, /987.65|111.11|222.22/);
      const history = await admin.request('/payments/history?period=2026-09');
      assert.equal(history.status, 200);
      assert.match(history.text, /222.22/);
      assert.doesNotMatch(history.text, /111.11/);
      const receipt = (
        await db.pool.query('SELECT receipt_number FROM receipts ORDER BY id DESC LIMIT 1')
      ).rows[0].receipt_number;
      assert.match(
        (await admin.request(`/payments/history?period=2026-09&q=${receipt}`)).text,
        /222.22/,
      );
      assert.doesNotMatch(
        (await admin.request('/payments/history?period=2026-09&q=000')).text,
        /222.22/,
      );
    });
    it('renames legacy branding without overwriting a customized residence name', async () => {
      const migration = await readFile(
        new URL('../../db/migrations/003-residence-name.sql', import.meta.url),
        'utf8',
      );
      await db.pool.query("UPDATE settings SET apartment_name = 'UtilityHub Apartment'");
      await db.pool.query(migration);
      await db.pool.query(migration);
      assert.equal(
        (await db.pool.query('SELECT apartment_name FROM settings')).rows[0].apartment_name,
        'สุขธารา เรสซิเดนซ์',
      );
      await db.pool.query("UPDATE settings SET apartment_name = 'Custom residence'");
      await db.pool.query(migration);
      assert.equal(
        (await db.pool.query('SELECT apartment_name FROM settings')).rows[0].apartment_name,
        'Custom residence',
      );
    });
  },
);
