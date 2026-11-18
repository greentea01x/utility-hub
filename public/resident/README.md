# Condo one resident service

หน้าเว็บจริงสำหรับเปิดจาก LINE LIFF แยกจากต้นแบบใน `/resident-preview/`

- URL หลัก `/resident/`
- เมนู `/resident/?page=bills`, `history`, `receipts`, `room`, `announcements`, `contact`
- ใบเสร็จเฉพาะใบ `/resident/?page=receipts&id=<receipt-number>`
- ประกาศเฉพาะเรื่อง `/resident/?page=announcements&id=<announcement-id>`

หน้าเว็บโหลดการตั้งค่าจาก `/api/resident/config` ก่อนเริ่ม LIFF เมื่อ LINE ยืนยันตัวตนแล้ว จะส่ง ID token ไปให้เซิร์ฟเวอร์ตรวจสอบผ่าน `/api/resident/session` จากนั้นจึงอ่าน `/api/resident/data` ข้อมูลห้องมาจากสิทธิ์บนเซิร์ฟเวอร์เท่านั้น หน้าเว็บไม่ส่งเลขห้องหรือ LINE user ID เพื่อเลือกข้อมูล

ไม่มีข้อมูลตัวอย่างสำรอง ไม่มีการเก็บ token หรือข้อมูลส่วนบุคคลใน localStorage และไม่มีการส่งข้อความ LINE จากหน้าเว็บ หากยังผูกบัญชีไม่สำเร็จ จะแสดงขั้นตอนรับรหัสแบบใช้ครั้งเดียวจากสำนักงานแล้วส่งในแชต OA

ใช้ LIFF SDK ทางการจาก `https://static.line-scdn.net/liff/edge/2/sdk.js` ตั้ง LIFF endpoint เป็น HTTPS URL ของ `/resident/` และเปิด scope `openid` ตามการตั้งค่าของเซิร์ฟเวอร์ ก่อนใช้จริงต้องตั้งค่า LINE channel และ deploy ระบบตามเอกสารส่วนหลักของโครงการ

ทั้ง 6 เมนูรองรับรายการว่างและข้อมูลตัวเลขที่ยังไม่มี โดยแสดง `—` แทนการสมมุติว่าเป็น 0 สำเนาใบเสร็จพิมพ์หรือบันทึกเป็น PDF ผ่าน browser print ได้ หาก LINE browser ไม่รองรับ ให้เปิดใน browser ภายนอกและยืนยัน LINE บัญชีเดิม

สถานะอ่านประกาศเป็นข้อมูลชั่วคราวในหน่วยความจำของหน้าเว็บ ไม่ส่งสถานะรับทราบไปยังสำนักงาน ข้อมูลติดต่อและค่าบริการทั้งหมดที่แสดงหลังเข้าสู่ระบบมาจาก API
