# เชื่อม Condo one กับ LINE Official Account

เอกสารนี้ใช้ตั้งค่าเมนูลูกบ้าน 6 หน้าให้เปิดผ่าน LIFF ที่ `/resident/` และรับรหัสผูกห้องผ่าน `/line/webhook` ส่วน `/resident-preview/` เป็นต้นแบบที่ใช้ข้อมูลตัวอย่างต่อไป หน้าเว็บที่เปิดจาก `localhost` ยังไม่ใช่เว็บสาธารณะสำหรับลูกบ้านบนโทรศัพท์

สคริปต์เตรียมค่าจะทำงานในเครื่องเท่านั้น ไม่เรียก LINE API ไม่ส่งข้อความ ไม่อัปโหลดรูป และไม่เปิด rich menu ให้ลูกบ้านทุกคน การพบค่าครบยังไม่แปลว่าเชื่อมต่อสำเร็จ ต้องทดสอบตามขั้นตอนด้านล่าง

## 1. เตรียม OA และช่องทางใน LINE Developers

1. เข้า [LINE Official Account Manager](https://manager.line.biz/) ด้วยบัญชีผู้ดูแล OA ของ Condo one เลือกบัญชีให้ถูกต้อง แล้วเปิดใช้ Messaging API จากการตั้งค่าของ OA หากยังไม่ได้เปิด
2. เลือก Provider ของโครงการ และตรวจ Messaging API channel ใน [LINE Developers Console](https://developers.line.biz/console/)
3. สร้างหรือใช้ LINE Login channel ประเภท Web app **ภายใต้ Provider เดียวกัน** กับ Messaging API channel เพราะ LINE user ID ของคนเดียวกันต่างกันเมื่ออยู่คนละ Provider ดู [การสร้างช่องทาง LIFF](https://developers.line.biz/en/docs/liff/getting-started/)
4. ใช้ชื่อแอป `Condo one Resident` และเพิ่มบัญชีที่ใช้ทดสอบเป็น Admin หรือ Tester ขณะ channel ยังอยู่สถานะ Developing ดู [การจัดการสิทธิ์](https://developers.line.biz/en/docs/line-developers-console/managing-roles/)

แนวทางนี้ใช้ LINE Login + LIFF ซึ่งรองรับอยู่ในเอกสารปัจจุบัน LINE แนะนำ LINE MINI App สำหรับแอปที่สร้างใหม่ด้วย หากโครงการจะใช้ MINI App ให้ตกลงประเภท channel ก่อนสร้าง เพราะช่องทางทั้งสองย้ายข้ามประเภทโดยตรงไม่ได้ ดู [คำแนะนำการสร้าง LIFF](https://developers.line.biz/en/docs/liff/getting-started/) และ [FAQ](https://developers.line.biz/en/faq/tags/liff/)

## 2. เปิดเว็บผ่าน HTTPS และเก็บค่าบนเซิร์ฟเวอร์

นำแอป Express พร้อมฐานข้อมูลไปไว้บนโฮสต์ที่มี HTTPS และโดเมนสาธารณะ คำสั่งเซิร์ฟเวอร์ไฟล์ static ที่ใช้ดูต้นแบบบนพอร์ต 4174 ไม่มี API และใช้แทน backend ไม่ได้ ตั้ง `PUBLIC_BASE_URL` เป็น origin ของแอป เช่น `https://condo.example.org` โดยไม่ต่อ `/resident/` ไม่ใส่ query และไม่ใส่รหัสผ่านใน URL

สำหรับโฮสต์ Render ใช้ `render.yaml` และ [ขั้นตอนเปิดเว็บบน Render](RENDER-DEPLOY.md) ซึ่งตรงกับ Node.js 24 และ PostgreSQL ของโครงการปัจจุบัน

เก็บค่าจริงใน `.env` ภายในเครื่องหรือระบบจัดการ environment ของโฮสต์เท่านั้น อย่าวาง Channel secret หรือ access token ใน HTML, JavaScript ฝั่งลูกบ้าน, Git หรือข้อความแชท

| ตัวแปร | ค่าที่นำมาใช้ | หน้าที่ |
| --- | --- | --- |
| `PUBLIC_BASE_URL` | HTTPS origin ของแอป | สร้าง Endpoint และ Webhook URL |
| `LIFF_ID` | ID ที่ได้รับหลังเพิ่ม LIFF app | เปิดแอปจากเมนู LINE |
| `LINE_LOGIN_CHANNEL_ID` | Channel ID ของ **LINE Login** | ตรวจ ID token ที่เซิร์ฟเวอร์ |
| `LINE_CHANNEL_SECRET` | Channel secret ของ **Messaging API** | ตรวจลายเซ็น webhook |
| `LINE_CHANNEL_ACCESS_TOKEN` | Access token ของ **Messaging API** | เตรียมไว้สำหรับเรียก Messaging API; ไม่จำเป็นต่อการล็อกอินหน้า LIFF ชุดนี้ |

ระบบยังต้องมี `DATABASE_URL` และ `SESSION_SECRET` ตามการตั้งค่าแอปหลักด้วย อย่าสลับ secret ของ LINE Login กับ secret ของ Messaging API โดย [webhook ใช้ secret ของ Messaging API channel](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)

ก่อนเปิด `/resident/` ให้รัน migration ฐานข้อมูลด้วย environment ของฐานข้อมูลที่จะใช้งานจริง:

```sh
npm run db:upgrade
```

Migration `006` เพิ่ม `bills.tenant_id` เพื่อระบุผู้พักอาศัยเจ้าของบิลโดยตรง บิลที่สร้างใหม่จะบันทึกเจ้าของจากรายการผู้พักอาศัยขณะสร้างบิล ประวัติและใบเสร็จในหน้าลูกบ้านแสดงเฉพาะรายการที่ระบุเจ้าของตรงกับบัญชีที่ผูก LINE อยู่ จึงไม่ใช้เพียงเลขห้องในการเปิดประวัติย้อนหลัง

บิลเก่าไม่ได้รับการกำหนดเจ้าของย้อนหลังอัตโนมัติ เพราะผู้พักอาศัยปัจจุบันอาจไม่ใช่เจ้าของบิลในช่วงก่อนหน้า เจ้าหน้าที่ต้องตรวจหลักฐานผู้พักอาศัยและช่วงเวลาของแต่ละบิลก่อนกำหนด `tenant_id` ให้บิลเก่าด้วยการตรวจทานเป็นรายกรณี ระหว่างยังไม่ตรวจทาน บิลเหล่านั้นจะไม่ปรากฏในประวัติของลูกบ้าน การอัปเกรดนี้ไม่ใช่การรีเซ็ตฐานข้อมูล

## 3. เพิ่ม LIFF app

ใน LINE Login channel เปิดแท็บ LIFF → Add แล้วตั้งค่าดังนี้:

| รายการ | ค่า |
| --- | --- |
| LIFF app name | `Condo one Resident` |
| Size | `Full` |
| Endpoint URL | `{PUBLIC_BASE_URL}/resident/` |
| Scope | `openid` |

`openid` ใช้ขอ ID token เพื่อให้ backend ยืนยันตัวตน ไม่ต้องเพิ่ม `chat_message.write` สำหรับการเปิดเมนูทั้งหก หน้าแอปชุดนี้ไม่ส่งข้อความเข้าแชท Endpoint ต้องเป็น HTTPS และไม่มี fragment (`#`) ตาม [การเพิ่ม LIFF app](https://developers.line.biz/en/docs/liff/registering-liff-apps/)

นำ LIFF ID ที่ได้ไปใส่ `LIFF_ID` แล้วรีสตาร์ตแอปด้วย environment ที่อัปเดตแล้ว เมื่อใช้ URL ที่มี `?page=...` ให้โค้ดอ่าน query หลัง `await liff.init(...)` เสร็จ เพราะ LINE อาจส่ง query ผ่าน `liff.state` ระหว่าง redirect และต้องไม่ลบพารามิเตอร์ `liff.*` ดู [พารามิเตอร์ของ LIFF URL](https://developers.line.biz/en/tips/2026/07/16/liff-url-additional-info/)

## 4. ตั้ง webhook สำหรับผูก LINE กับห้อง

ใน Messaging API channel ตั้ง Webhook URL เป็น `{PUBLIC_BASE_URL}/line/webhook` กด Verify ให้สำเร็จ แล้วเปิด Use webhook เซิร์ฟเวอร์ต้องรับ request body เดิมและตรวจ `x-line-signature` ก่อนอ่าน event ดู [การตั้ง bot และ webhook](https://developers.line.biz/en/docs/messaging-api/building-bot/) และ [การตรวจ signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)

ขั้นตอนผูกห้อง:

1. เจ้าหน้าที่เข้าระบบหลังบ้านและเลือกผู้พักอาศัย/ห้องที่ตรวจสอบแล้ว
2. เจ้าหน้าที่สร้างรหัสผูก LINE จากรายการผู้พักอาศัย (`POST /tenants/:id/link-code` สำหรับ admin) แล้วแจ้งรหัสแก่เจ้าของบัญชีห้องนั้น
3. ลูกบ้านเพิ่ม OA เป็นเพื่อน แล้วพิมพ์รหัสในแชทกับ OA รหัสในระบบปัจจุบันใช้ครั้งเดียวและหมดอายุใน 7 วัน
4. Webhook ตรวจรหัสและผูก LINE user ID กับรายการผู้พักอาศัย จากนั้นลูกบ้านเปิดเมนู LIFF อีกครั้ง
5. ถ้าเปิดเมนูแล้วระบบยังไม่พบการผูกบัญชี ให้เจ้าหน้าที่ตรวจสถานะก่อนออกหรือส่งรหัสใหม่ อย่าใช้เลขห้องที่กรอกเองเป็นหลักฐานอนุญาตดูบิล

การส่งรหัสจากโทรศัพท์เป็นการทดสอบที่ผู้ทดสอบทำเอง สคริปต์ setup ไม่ส่งข้อความแทนผู้ใช้ และการเชื่อมชุดนี้ไม่ได้เพิ่มระบบ Push/Broadcast แจ้งบิลอัตโนมัติ

## 5. ลิงก์ของ rich menu ทั้ง 6 ช่อง

ตั้งแต่ละช่องเป็น Link/URI action โดยแทน `{LIFF_ID}` ด้วยค่าจริง:

| ตำแหน่ง | เมนู | URI |
| --- | --- | --- |
| แถวบน · ซ้าย | ดูบิลเดือนนี้ | `https://liff.line.me/{LIFF_ID}/?page=bills` |
| แถวบน · กลาง | ประวัติชำระเงิน | `https://liff.line.me/{LIFF_ID}/?page=history` |
| แถวบน · ขวา | ใบเสร็จรับเงิน | `https://liff.line.me/{LIFF_ID}/?page=receipts` |
| แถวล่าง · ซ้าย | ข้อมูลห้องพัก | `https://liff.line.me/{LIFF_ID}/?page=room` |
| แถวล่าง · กลาง | ข่าวสารคอนโด | `https://liff.line.me/{LIFF_ID}/?page=announcements` |
| แถวล่าง · ขวา | ติดต่อนิติบุคคล | `https://liff.line.me/{LIFF_ID}/?page=contact` |

รูปแบบ `https://liff.line.me/{LIFF_ID}/?page=...` เป็น LIFF URL ที่ส่ง query เพิ่มได้ ดู [การเปิด LIFF app](https://developers.line.biz/en/docs/liff/opening-liff-app/) อย่าใส่ URL `localhost` หรือ URL ของ `/resident-preview/` ในเมนูใช้งานจริง

Rich menu ทำได้จาก OA Manager หรือ Messaging API แต่เมนูหนึ่งชุดต้องจัดการผ่านเครื่องมือที่ใช้สร้างชุดนั้น ให้ตรวจภาพสุดท้ายและขอบเขตพื้นที่กดก่อนบันทึก โดยเฉพาะภาพที่มีแบนเนอร์เหนือแถวปุ่ม สคริปต์นี้ไม่เดาพิกัดพื้นที่กดและไม่สร้าง API payload ที่พร้อม activate ดู [โครงสร้างและเครื่องมือจัดการ rich menu](https://developers.line.biz/en/docs/messaging-api/rich-menus-overview/)

## 6. ตรวจค่าโดยไม่เชื่อมต่อเครือข่าย

จากโฟลเดอร์โครงการ ใช้ Node.js 24:

```sh
node --env-file-if-exists=.env scripts/line-setup.js
```

คำสั่งแสดงเพียง `configured`, `missing` หรือ `invalid` สำหรับตัวแปร ไม่แสดง secret และสร้างไฟล์ต่อไปนี้:

- `output/line-setup/line-setup.json` — สถานะค่า Endpoint และ LIFF settings
- `output/line-setup/rich-menu-links.json` — ลิงก์ทั้ง 6 เมนู หรือ template เมื่อยังไม่มี LIFF ID

ตรวจโดยไม่เขียนไฟล์ และให้ exit code เป็น `1` เมื่อค่าที่จำเป็นยังไม่ครบ:

```sh
node --env-file-if-exists=.env scripts/line-setup.js --check --no-write
```

`configured` หมายถึงมีค่าเท่านั้น สคริปต์ไม่พิสูจน์ว่า secret/token ถูกต้อง โดเมนเปิดได้ บัญชีอยู่ Provider เดียวกัน หรือข้อมูลในฐานข้อมูลพร้อมใช้งาน ค่า `connectionVerified`, `published` และ `defaultRichMenuActivated` ใน manifest จึงเป็น `false` เสมอ

## 7. ทดสอบบนมือถือก่อนเปิดให้ลูกบ้าน

ใช้ OA ทดสอบ หรือผูก rich menu เฉพาะบัญชีทดสอบผ่าน Messaging API ก่อนเปิดเป็น default ให้ทุกคน LINE Login channel สถานะ Developing ใช้ได้เฉพาะ Admin/Tester ที่มีบัญชี LINE ผูกกับบัญชีนักพัฒนา ตรวจ [วิธีทดสอบ LINE Login](https://developers.line.biz/en/docs/line-login/getting-started/) โดย rich menu ไม่แสดงใน LINE บนคอมพิวเตอร์ ให้ทดสอบด้วย LINE บนโทรศัพท์ตาม [ข้อกำหนด rich menu](https://developers.line.biz/en/docs/messaging-api/rich-menus-overview/)

ทดสอบเปิดทั้งหกเมนู ตรวจว่าบิล ประวัติ ใบเสร็จ และข้อมูลห้องเป็นของบัญชีที่ผูกอยู่เท่านั้น ทดสอบบัญชีที่ยังไม่ผูกต้องไม่เห็นข้อมูลของห้องอื่น แล้วตรวจข่าวสารและหมายเลขสำนักงาน เมื่อผ่านจึงเปิด channel ให้ลูกบ้านใช้และตั้ง rich menu เป็น default จากบัญชีผู้ดูแล การเปลี่ยน LINE Login channel เป็น Published ย้อนกลับเป็น Developing ไม่ได้ตาม [เอกสาร LINE Login](https://developers.line.biz/en/docs/line-login/getting-started/)

สถานะการเชื่อมต่อจริงต้องบันทึกจากผลทดสอบบน LINE และระบบโฮสต์ ไม่ใช้ผล preflight แทนผลทดสอบนั้น
