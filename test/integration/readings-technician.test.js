import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createDatabaseFixture, createHttpClient } from '../helpers/database.js';

describe(
  'Required technician attribution on every meter save',
  {
    skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL',
    concurrency: false,
    timeout: 240000,
  },
  () => {
    let db;
    let saveReadings;
    before(async () => {
      db = await createDatabaseFixture();
      ({ saveReadings } = await import('../../services/readings.js'));
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
          "INSERT INTO users (username, display_name, password_hash, role) VALUES ('staff', 'Staff account', $1, 'staff')",
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
      await browser.request('/readings?period=2026-09&q=205');
      return browser;
    }

    function roomMarkup(html, number = '205') {
      const match = html.match(new RegExp(`<tr[^>]*data-room="${number}"[^>]*>[\\s\\S]*?</tr>`));
      assert.ok(match, `Room ${number} should be rendered`);
      return match[0];
    }

    async function readingsSnapshot() {
      return (
        await db.pool.query(
          'SELECT room_id,period,utility_type,previous_reading,current_reading,recorded_by,recorded_at,technician_name FROM meter_readings ORDER BY id',
        )
      ).rows;
    }

    it('rejects missing, blank and out-of-range names through API and HTML without any reading or audit writes', async () => {
      const browser = await signIn();
      const before = await readingsSnapshot();
      for (const technicianName of [undefined, '', '   ', 'ก', 'ก'.repeat(101)]) {
        const api = await browser.request('/api/readings', {
          method: 'POST',
          body: {
            room_id: 21,
            period: '2026-09',
            utility_type: 'water',
            current_reading: 1260,
            technician_name: technicianName,
          },
        });
        assert.equal(api.status, 422);
        assert.equal(api.json.error.code, 'VALIDATION_FAILED');
        assert.ok(api.json.error.fields.technician_name);
        const html = await browser.request('/readings/21', {
          method: 'POST',
          body: {
            period: '2026-09',
            filter: 'pending',
            q: '205',
            water: '1260',
            electric: '5350',
            technician_name: technicianName,
          },
        });
        assert.equal(html.status, 422);
        const room = roomMarkup(html.text);
        assert.match(room, /role="alert"/);
        assert.match(room, /กรุณากรอกชื่อช่างผู้จดมิเตอร์ 2–100 ตัวอักษร/);
      }
      await assert.rejects(
        saveReadings({ roomId: 21, period: '2026-09', values: { water: 1260 }, userId: 1 }),
        { status: 422, code: 'VALIDATION_FAILED' },
      );
      assert.deepEqual(await readingsSnapshot(), before);
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n, 0);
    });

    it('stores the manually entered trimmed name while attributing API and HTML writes to the authenticated staff account', async () => {
      const browser = await signIn('staff');
      const technicianName = 'วิชัย ช่างอาคาร';
      const body = {
        technician_name: `  ${technicianName}  `,
        recorded_by: 1,
        user_id: 1,
        userId: 1,
      };
      const api = await browser.request('/api/readings', {
        method: 'POST',
        body: {
          ...body,
          room_id: 21,
          period: '2026-09',
          utility_type: 'water',
          current_reading: 1260,
        },
      });
      assert.equal(api.status, 200);
      const html = await browser.request('/readings/21', {
        method: 'POST',
        body: {
          ...body,
          period: '2026-09',
          filter: 'pending',
          q: '205',
          water: '1260',
          electric: '5350',
        },
      });
      assert.equal(html.status, 302);
      const rows = (
        await db.pool.query(
          "SELECT utility_type,technician_name,recorded_by FROM meter_readings WHERE period='2026-09' ORDER BY utility_type",
        )
      ).rows;
      assert.deepEqual(rows, [
        { utility_type: 'electric', technician_name: technicianName, recorded_by: '2' },
        { utility_type: 'water', technician_name: technicianName, recorded_by: '2' },
      ]);
      const audits = (await db.pool.query('SELECT actor_user_id,after_json FROM audit_log')).rows;
      assert.equal(audits.length, 2);
      for (const audit of audits) {
        assert.equal(audit.actor_user_id, '2');
        assert.equal(audit.after_json.recorded_by, '2');
        assert.equal(audit.after_json.technician_name, technicianName);
      }
      const page = await browser.request(html.headers.get('location'));
      const room = roomMarkup(page.text);
      assert.match(room, /name="technician_name" value=""/);
      assert.equal((room.match(/class="meter-recorded-by"/g) ?? []).length, 2);
      assert.equal((room.match(new RegExp(technicianName, 'g')) ?? []).length, 2);
      assert.doesNotMatch(page.text, /href="\/bills/);
    });

    it('audits a changed technician name even when readings match, and treats the same trimmed name and readings as a no-op', async () => {
      const save = (technicianName) =>
        saveReadings({
          roomId: 21,
          period: '2026-09',
          values: { water: 1260, electric: 5350 },
          userId: 1,
          technicianName,
        });
      await save('สมชาย ช่างอาคาร');
      const before = await readingsSnapshot();
      await save('  สมชาย ช่างอาคาร  ');
      assert.deepEqual(await readingsSnapshot(), before);
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n, 2);
      await save('วิชัย ช่างอาคาร');
      const edits = (
        await db.pool.query(
          "SELECT actor_user_id,before_json,after_json FROM audit_log WHERE action='READING_EDIT' ORDER BY id",
        )
      ).rows;
      assert.equal(edits.length, 2);
      for (const edit of edits) {
        assert.equal(edit.actor_user_id, '1');
        assert.equal(edit.before_json.technician_name, 'สมชาย ช่างอาคาร');
        assert.equal(edit.after_json.technician_name, 'วิชัย ช่างอาคาร');
        assert.equal(edit.before_json.current_reading, edit.after_json.current_reading);
      }
    });

    it('shows independent technician names and timestamps per utility while leaving the next manual entry blank', async () => {
      await saveReadings({
        roomId: 21,
        period: '2026-09',
        values: { water: 1260 },
        userId: 1,
        technicianName: 'สมชาย ผู้จดน้ำ',
      });
      await saveReadings({
        roomId: 21,
        period: '2026-09',
        values: { electric: 5350 },
        userId: 1,
        technicianName: 'วิชัย ผู้จดไฟ',
      });
      await db.pool.query(
        "UPDATE meter_readings SET recorded_at=CASE utility_type WHEN 'water' THEN '2026-09-01T02:15:00Z'::timestamptz ELSE '2026-09-02T03:45:00Z'::timestamptz END WHERE period='2026-09'",
      );
      const browser = await signIn();
      const room = roomMarkup(
        (await browser.request('/readings?period=2026-09&filter=all&q=205')).text,
      );
      const water = room.match(/<td class="water-current"[\s\S]*?<\/td>/)?.[0];
      const electric = room.match(/<td class="electric-current"[\s\S]*?<\/td>/)?.[0];
      assert.match(water, /สมชาย ผู้จดน้ำ/);
      assert.match(water, /datetime="2026-09-01T02:15:00.000Z"/);
      assert.match(electric, /วิชัย ผู้จดไฟ/);
      assert.match(electric, /datetime="2026-09-02T03:45:00.000Z"/);
      assert.match(room, /name="technician_name" value=""/);
    });

    it('renders legacy readings without inventing a technician name or pre-filling a new entry', async () => {
      const browser = await signIn();
      const page = await browser.request('/readings?period=2026-08&filter=complete&q=205');
      assert.equal(page.status, 200);
      const room = roomMarkup(page.text);
      assert.equal((room.match(/ไม่ได้ระบุชื่อช่าง \(ข้อมูลเดิม\)/g) ?? []).length, 2);
      assert.equal((room.match(/<time datetime="[^"]+"/g) ?? []).length, 2);
      assert.match(room, /name="technician_name" value=""/);
    });
  },
);
