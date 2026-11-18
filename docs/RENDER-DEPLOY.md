# เตรียมเปิด Condo one บน Render

ไฟล์ `render.yaml` เตรียม Web Service สำหรับทดสอบ Node.js 24 + Express โดยใช้ฐานข้อมูล PostgreSQL/Supabase ที่มีอยู่ การเพิ่มไฟล์นี้ยังไม่ได้สร้างบริการบน Render และยังไม่มี public URL ที่ยืนยันแล้ว

## สิ่งที่เตรียมไว้

| รายการ | การตั้งค่า |
| --- | --- |
| Service | `condo-one` ชื่อบริการเสนอใช้; URL จริงให้ยึดจาก Render |
| Runtime | Node.js 24 ตรงกับ `.nvmrc` และ `package.json` |
| Plan | `free` ระบุไว้ชัดเจน; ไม่สร้างฐานข้อมูลหรือ disk เพิ่ม |
| Build / Start | `npm ci` / `npm start` |
| Health check | `/healthz` ตรวจการเชื่อมต่อฐานข้อมูลด้วย `SELECT 1` |
| Deploy หลังแก้โค้ด | Manual; `autoDeployTrigger: "off"` |
| Session | เก็บใน PostgreSQL; Render สร้าง `SESSION_SECRET` ให้ |

แผน Free ชุดนี้ใช้สำหรับทดสอบเท่านั้น Render ระบุว่าไม่เหมาะกับ production โดยพักบริการหลังไม่มีการใช้งาน 15 นาทีและอาจใช้เวลาประมาณ 1 นาทีในการเริ่มตอบใหม่ จึงไม่รับประกันว่า LINE webhook พร้อมตอบตลอดเวลา ทั้งยังมีข้อจำกัดการใช้งานและทราฟฟิกขาออกที่เกี่ยวข้องกับฐานข้อมูล/API ดู [ข้อจำกัด Free](https://render.com/docs/free) ก่อนเปิดให้ลูกบ้านใช้งานจริงต้องเลือกแผนที่เหมาะกับการพร้อมให้บริการร่วมกับเจ้าของโครงการ

หากบัญชีหรือหน้าสรุป Render ไม่อนุญาตแผน Free ให้หยุดก่อนสร้างบริการ ไม่เปลี่ยนเป็นแผนเสียเงินอัตโนมัติ โครงสร้าง blueprint และตัวเลือก manual deploy อ้างอิง [Blueprint specification](https://render.com/docs/blueprint-spec)

## 1. เตรียม source และฐานข้อมูล

1. ใช้ Git repository ของโครงการที่บัญชี Render เข้าถึงได้ ตรวจให้แน่ใจว่ารวมไฟล์ `/resident/`, API, migration และ `render.yaml` ฉบับล่าสุดแล้ว การ push/upload source เป็นขั้นตอนภายนอกแยกจากการเตรียมไฟล์นี้
2. ใช้ฐานข้อมูล PostgreSQL เดิมที่มีตารางและข้อมูลของโครงการแล้ว จาก Supabase ให้ใช้ Session Pooler URI พร้อม `sslmode=require` ใส่เฉพาะใน Environment ของ Render ห้ามใส่ใน YAML หรือ Git
3. ก่อนเปิดบริการลูกบ้าน ให้ตรวจว่า migration `006-bill-resident-ownership.sql` ถูกใช้กับฐานข้อมูลเป้าหมายแล้ว หากยังไม่ได้ใช้ ให้รันจากเครื่องผู้ดูแลที่ตั้ง `.env` ของฐานข้อมูลเป้าหมายนั้นไว้:

   ```sh
   node --env-file=.env db/upgrade.js
   ```

   ถ้ารันในสภาพแวดล้อมที่มี `DATABASE_URL` อยู่แล้ว ใช้ `node db/upgrade.js` คำสั่ง upgrade เก็บข้อมูลเดิมไว้ บิลเก่าไม่ถูกกำหนดเจ้าของย้อนหลังอัตโนมัติ ต้องตรวจสอบเจ้าของก่อนจึงจะแสดงในประวัติลูกบ้าน รายละเอียดอยู่ใน [คู่มือ LINE](LINE-SETUP.md)
4. ไม่รัน `db:reset`, `db:migrate` หรือ `db:seed` กับฐานข้อมูลที่มีข้อมูลใช้งาน คำสั่ง `db:migrate` ปัจจุบันเรียก schema ที่มี `DROP TABLE`; blueprint จึงไม่เรียกคำสั่งฐานข้อมูลใด ๆ ระหว่าง build/start หากจะใช้ฐานข้อมูลว่าง ต้องวางแผนสร้าง schema และบัญชีผู้ดูแลแยกต่างหาก

## 2. สร้าง Web Service จาก Blueprint

ใน Render เลือก New → Blueprint แล้วเชื่อม repository/branch ที่มีไฟล์ `render.yaml` ตรวจชื่อบริการ แผน และค่า Environment ก่อนสร้าง หากใช้ New → Web Service แบบกรอกเอง ให้ใช้ค่าจากตารางด้านบนและปิด automatic deploy

| ตัวแปร | วิธีใส่ค่า |
| --- | --- |
| `DATABASE_URL` | URI ของฐานข้อมูลเป้าหมาย; `sync: false` ให้ใส่ใน Render เท่านั้น |
| `SESSION_SECRET` | `generateValue: true` ให้ Render สร้างค่าสุ่ม; ไม่ต้องคัดลอกจากเครื่อง |
| `LINE_CHANNEL_SECRET` | Secret ของ Messaging API channel; ใส่ใน Render เท่านั้น |
| `LINE_LOGIN_CHANNEL_ID` | ID ของ LINE Login channel ภายใต้ Provider เดียวกับ Messaging API |
| `PUBLIC_BASE_URL` | ยังไม่ประกาศใน blueprint; เพิ่มที่ Render หลังได้ HTTPS origin จริง |
| `LIFF_ID` | ยังไม่ประกาศใน blueprint; เพิ่มที่ Render เมื่อสร้าง LIFF app สำเร็จ |
| `NODE_VERSION` / `NODE_ENV` / `TZ` | `24` / `production` / `Asia/Bangkok` ตาม blueprint |
| `DB_POOL_SIZE` | `5` เพื่อจำกัด connection ต่อ instance |
| `RESIDENT_OFFICE_PHONE` | `081-234-5678` ตามข้อมูลที่ผู้ใช้ให้ |

ไม่ต้องตั้ง `PORT` เอง; `server.js` อ่านพอร์ตที่โฮสต์กำหนด `npm start` ไม่อ่าน `.env` อัตโนมัติ จึงต้องใส่ environment ใน Render ให้ครบ การคัดลอก `.env` เข้า Git ไม่ใช่วิธี deploy

`LINE_CHANNEL_ACCESS_TOKEN` ไม่จำเป็นต่อการเปิดหน้า LIFF และ webhook ผูกรหัสในชุดนี้ จึงไม่บังคับใน blueprint หากเพิ่มการเรียก Messaging API ในภายหลัง ให้ใส่ token ใน Environment ของ Render เท่านั้น Blueprint นี้ไม่สร้าง cron และไม่เปิดระบบ Push/Broadcast

## 3. หลัง deployment แรก

1. รอให้ Render แสดงบริการพร้อมใช้งาน แล้วคัดลอก HTTPS URL ที่ Render กำหนดจริง ไม่มี URL ตัวอย่างใดในคู่มือนี้เป็นเว็บที่เปิดแล้ว
2. เปิด `/healthz` บน origin นั้น ต้องได้ HTTP 200 และ `{"data":{"status":"ok"}}` หากได้ 503 ให้ตรวจฐานข้อมูลและค่าการเชื่อมต่อก่อนเปิด LINE
3. ตั้ง `PUBLIC_BASE_URL` เป็น origin จริง โดยไม่ต่อ `/resident/` ไม่มี query และไม่มี fragment
4. ใน LINE Login channel เพิ่ม LIFF app ชื่อ `Condo one Resident`, Size `Full`, scope `openid`, Endpoint URL เป็น origin จริงตามด้วย `/resident/` แล้วใส่ LIFF ID ใน Environment ของ Render
5. บันทึก Environment และ deploy ใหม่ จากนั้นตั้ง Messaging API webhook เป็น origin เดียวกันตามด้วย `/line/webhook` กด Verify แล้วเปิด Use webhook
6. ใช้บัญชีทดสอบรับรหัสผูกห้องจากสำนักงาน แล้วทดสอบเมนูทั้งหกก่อนเปิด rich menu ให้ลูกบ้าน รายละเอียดลิงก์และลำดับทดสอบอยู่ใน [LINE-SETUP.md](LINE-SETUP.md)

`PUBLIC_BASE_URL` และ `LIFF_ID` ไม่ถูกประกาศเป็นค่าว่างใน blueprint เพื่อให้ค่าที่เพิ่มใน Render ภายหลังไม่ถูก YAML นำค่าว่างไปทับ ก่อนสร้างบริการลูกบ้านจะอยู่ในสถานะยังตั้งค่าไม่ครบ อย่าเพิ่ม secret ลงใน YAML

เมื่อ Environment พร้อมแล้ว ตรวจรายการตั้งค่าแบบไม่เรียกเครือข่ายในสภาพแวดล้อมนั้นได้ด้วย:

```sh
node scripts/line-setup.js --check --no-write
```

คำสั่งนี้ตรวจเพียงรูปแบบและการมีค่า ไม่ยืนยันว่า deployment หรือ LINE เชื่อมต่อสำเร็จ

## พื้นที่เก็บข้อมูลและข้อจำกัดปัจจุบัน

ไม่ต้องเพิ่ม persistent disk สำหรับแอปฉบับนี้ ใบเสร็จเก็บเป็นข้อมูลใน PostgreSQL และสร้างหน้าพิมพ์จากข้อมูลนั้น ไม่มีระบบอัปโหลดรูปสลิปหรือไฟล์ใบเสร็จเข้าดิสก์ของเซิร์ฟเวอร์ Session ก็เก็บใน PostgreSQL ส่วนโลโก้ ฟอนต์ และภาพหน้าเว็บอยู่ใน repository

หากเพิ่มการอัปโหลดไฟล์ภายหลัง ต้องเลือก object storage หรือพื้นที่ถาวรก่อนใช้จริง อย่าเก็บไฟล์ผู้ใช้ไว้ใน filesystem ชั่วคราวของ Web Service ส่วนไฟล์ backup ที่สคริปต์งานผู้ดูแลสร้างใน `db/backups/` ควรเก็บจากเครื่องผู้ดูแลหรือระบบสำรองที่คงอยู่ ไม่ใช้เป็น backup ถาวรบน Web Service

เอกสาร deployment รุ่นเก่าใน `02-engineering-spec.html` ยังอ้าง MySQL/Aiven และคำสั่งสาธิตที่ไม่ตรงกับโค้ดปัจจุบัน ให้ใช้คู่มือนี้สำหรับ Express/PostgreSQL แทน ไฟล์ CI ปัจจุบันยังตั้งบริการ MySQL และไม่ได้ทำ deploy จึงไม่ถือว่า CI ยืนยันความพร้อมของ deployment นี้แล้ว

ตรวจไวยากรณ์ YAML และความสอดคล้องกับโค้ดได้ภายในเครื่อง แต่การรับ blueprint, ข้อจำกัดแผน และสถานะ Live ต้องตรวจในบัญชี Render จริง ขั้นตอนเตรียมไฟล์นี้ไม่ได้เชื่อมต่อ Render หรือเปลี่ยนข้อมูลในฐานข้อมูล
