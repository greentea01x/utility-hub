import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createDatabaseFixture, createHttpClient } from '../helpers/database.js';

describe(
  'Meter reading page editing and error recovery',
  {
    skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL',
    concurrency: false,
    timeout: 240000,
  },
  () => {
    let db;
    before(async () => {
      db = await createDatabaseFixture();
    });
    beforeEach(async () => {
      await db.reset();
    });
    after(async () => {
      if (db) await db.close();
    });

    async function signIn() {
      const browser = createHttpClient(db.baseURL);
      await browser.request('/login');
      const response = await browser.request('/login', {
        method: 'POST',
        body: { username: 'admin', password: db.password },
      });
      assert.equal(response.status, 302);
      assert.equal((await browser.request('/readings?period=2026-09')).status, 200);
      return browser;
    }

    it('opens pending rooms by default and displays only the active tenant', async () => {
      await db.pool.query(`INSERT INTO meter_readings
        (room_id,period,utility_type,previous_reading,current_reading,recorded_by)
        VALUES (1,'2026-09','water',0,1,1), (1,'2026-09','electric',0,2,1)`);
      await db.pool.query(`INSERT INTO tenants
        (room_id,full_name,phone,move_in_date,status)
        VALUES (21,'Former tenant must stay hidden','0812345678','2025-01-01','Inactive')`);
      const browser = await signIn();
      const response = await browser.request('/readings?period=2026-09');
      assert.equal(response.status, 200);
      assert.match(response.text, /data-room="205"/);
      assert.doesNotMatch(response.text, /data-room="101"|Former tenant must stay hidden/);
      assert.match(response.text, /ผู้พักอาศัยห้อง 205/);
      assert.match(response.text, /name="filter" value="pending"/);
    });

    it('renders approved room readings locked and rejects direct posts without changing data', async () => {
      await db.pool.query(`INSERT INTO meter_readings
        (room_id,period,utility_type,previous_reading,current_reading,recorded_by)
        VALUES (21,'2026-09','water',1250,1260,1), (21,'2026-09','electric',5280,5350,1)`);
      await db.pool.query(`INSERT INTO bills (room_id,period,status,due_date,total)
        VALUES (21,'2026-09','Unpaid','2026-09-05',1790)`);
      const browser = await signIn();
      const page = await browser.request('/readings?period=2026-09&filter=all&q=205');
      assert.equal(page.status, 200);
      assert.match(page.text, /data-locked="true"/);
      const response = await browser.request('/readings/21', {
        method: 'POST',
        body: {
          period: '2026-09',
          filter: 'all',
          q: '205',
          water: 1261,
          electric: 5351,
          technician_name: 'สมชาย ช่างอาคาร',
        },
      });
      assert.equal(response.status, 409);
      assert.match(response.text, /บิลนี้อนุมัติแล้ว ไม่สามารถแก้เลขมิเตอร์/);
      assert.match(response.text, /data-room="205"/);
      assert.match(response.text, /name="q" value="205"/);
      assert.deepEqual(
        (
          await db.pool.query(`SELECT utility_type,current_reading FROM meter_readings
          WHERE period='2026-09' ORDER BY utility_type`)
        ).rows,
        [
          { utility_type: 'electric', current_reading: '5350.00' },
          { utility_type: 'water', current_reading: '1260.00' },
        ],
      );
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n, 0);
    });

    it('keeps attempted values, search and room visible after below-previous validation', async () => {
      const browser = await signIn();
      const response = await browser.request('/readings/21', {
        method: 'POST',
        body: {
          period: '2026-09',
          filter: 'pending',
          q: '205',
          water: '1240',
          electric: '5350',
          technician_name: '  สมชาย ช่างอาคาร  ',
        },
      });
      assert.equal(response.status, 422);
      assert.match(response.text, /เลขมิเตอร์ใหม่ต้องไม่น้อยกว่าครั้งก่อน/);
      assert.match(response.text, /name="water"[^>]*value="1240"/);
      assert.match(response.text, /name="electric"[^>]*value="5350"/);
      assert.match(response.text, /name="technician_name" value="  สมชาย ช่างอาคาร  "/);
      assert.match(response.text, /name="filter" value="pending"/);
      assert.match(response.text, /name="q" value="205"/);
      assert.equal(
        (
          await db.pool.query(
            "SELECT count(*)::int AS n FROM meter_readings WHERE period='2026-09'",
          )
        ).rows[0].n,
        0,
      );
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n, 0);
    });

    it('refuses blank form readings instead of coercing them into a saved zero', async () => {
      const browser = await signIn();
      const response = await browser.request('/readings/1', {
        method: 'POST',
        body: {
          period: '2026-09',
          filter: 'pending',
          q: '101',
          water: '',
          electric: '',
          technician_name: 'สมชาย ช่างอาคาร',
        },
      });
      assert.equal(response.status, 422);
      assert.match(response.text, /กรุณากรอกเลขมิเตอร์ให้ครบและถูกต้อง/);
      assert.equal(
        (
          await db.pool.query(
            "SELECT count(*)::int AS n FROM meter_readings WHERE period='2026-09'",
          )
        ).rows[0].n,
        0,
      );
    });

    it('shows the saved completed room after leaving the pending filter without losing search', async () => {
      const browser = await signIn();
      const response = await browser.request('/readings/21', {
        method: 'POST',
        body: {
          period: '2026-09',
          filter: 'pending',
          q: '205',
          water: '1260',
          electric: '5350',
          technician_name: 'สมชาย ช่างอาคาร',
        },
      });
      assert.equal(response.status, 302);
      const location = response.headers.get('location');
      const redirect = new URL(location, db.baseURL);
      assert.equal(redirect.searchParams.get('period'), '2026-09');
      assert.equal(redirect.searchParams.get('filter'), 'all');
      assert.equal(redirect.searchParams.get('q'), '205');
      assert.equal(redirect.searchParams.get('saved'), '21');
      const page = await browser.request(location);
      assert.equal(page.status, 200);
      assert.match(page.text, /data-room="205"[^>]*data-complete="true"/);
      assert.match(page.text, /บันทึกเลขมิเตอร์เรียบร้อย/);
      assert.equal(
        (
          await db.pool.query(
            "SELECT count(*)::int AS n FROM meter_readings WHERE period='2026-09'",
          )
        ).rows[0].n,
        2,
      );
    });
  },
);
