import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const root = '/Users/initia-army/Documents/juristic-platform';
const tmp = path.join(root, 'tmp/block-diagram-phases-20261017');
const p = Presentation.create({ slideSize: { width: 1920, height: 1080 } });
const font = 'Thonburi';
const ink = '#222222', gray = '#666666', pale = '#F1F1F1';
const nodes = new Map();
const connections = [];

function text(slide, name, content, x, y, w, h, size = 28, bold = false, align = 'left', color = ink) {
  const s = slide.shapes.add({ geometry: 'textbox', name,
    position: { left: x, top: y, width: w, height: h },
    fill: 'none', line: { fill: 'none', width: 0, style: 'solid' } });
  s.text = content;
  s.text.style = { typeface: font, fontSize: size, bold, color,
    alignment: align, verticalAlignment: 'middle', insets: 0,
    wrap: 'none', autoFit: 'none' };
  return s;
}

function node(slide, id, title, body, x, y, w, h, options = {}) {
  const dark = options.dark ?? false;
  const s = slide.shapes.add({ geometry: options.oval ? 'ellipse' : 'rect', name: id,
    position: { left: x, top: y, width: w, height: h },
    fill: dark ? '#363636' : (options.fill ?? '#FFFFFF'),
    line: { fill: options.dashed ? '#777777' : ink, width: 2,
      style: options.dashed ? 'dashed' : 'solid' } });
  s.text = [
    ...title.split('\n').map(t => ({ runs: [{ run: t, style: { bold: true, fontSize: `${options.titleSize ?? 32}px`, typeface: font } }], spaceAfter: 350 })),
    ...(body ? body.split('\n').map(t => ({ runs: [{ run: t, style: { bold: false, fontSize: `${options.bodySize ?? 27}px`, typeface: font } }], spaceAfter: 150 })) : []),
  ];
  s.text.style = { typeface: font, fontSize: options.bodySize ?? 27, color: dark ? '#FFFFFF' : ink,
    alignment: 'center', verticalAlignment: 'middle', insets: { left: 14, right: 14, top: 12, bottom: 12 },
    wrap: 'none', autoFit: 'none' };
  nodes.set(id, s);
  return s;
}

function connect(slide, from, to, options = {}) {
  const s = slide.shapes.connect(from, to, {
    kind: options.kind ?? 'straight',
    fromSide: options.fromSide ?? 'right', toSide: options.toSide ?? 'left',
    line: { style: options.dashed ? 'dashed' : 'solid', fill: options.dashed ? '#777777' : ink, width: 3 },
    tail: { type: 'triangle', width: 'med', length: 'med' },
    ...(options.both ? { head: { type: 'triangle', width: 'med', length: 'med' } } : {}),
  });
  connections.push({ from: from.id, to: to.id, id: s.id });
  return s;
}

function rule(slide, x, y, width) {
  slide.shapes.add({ geometry: 'line', name: 'section-rule',
    position: { left: x, top: y, width, height: 0 }, fill: 'none',
    line: { fill: '#C6C6C6', width: 1, style: 'solid' } });
}

function heading(slide, title, subtitle, page) {
  slide.background.fill = '#FFFFFF';
  text(slide, 'slide-title', title, 70, 42, 1780, 85, 55, true);
  text(slide, 'slide-subtitle', subtitle, 70, 133, 1780, 52, 30, false, 'left', gray);
  rule(slide, 70, 200, 1780);
  text(slide, 'page-number', String(page).padStart(2, '0'), 1760, 1017, 90, 35, 24, false, 'right', gray);
}

// PHASE 1: no LINE components on this slide.
const s1 = p.slides.add();
heading(s1, 'Phase 1  ระบบเว็บไซต์หลัก', 'จดมิเตอร์ ออกบิล รับเงินสด และใบเสร็จ', 1);
const actor = node(s1, 'p1-operator', 'ผู้ดูแลระบบ / เจ้าหน้าที่', '', 70, 252, 350, 128, { oval: true, dark: true, titleSize: 31 });
const auth = node(s1, 'p1-auth', 'เข้าสู่ระบบ', 'ตรวจตัวตนและสิทธิ์ผู้ใช้', 520, 252, 350, 128);
const app = node(s1, 'p1-app', 'Web App', 'Node.js + Express + EJS', 970, 252, 350, 128, { fill: pale, bodySize: 26 });
const db = node(s1, 'p1-database', 'ฐานข้อมูล', 'PostgreSQL / Supabase\nข้อมูลของระบบทุกส่วน', 1470, 225, 380, 182, { fill: pale, bodySize: 28 });
connect(s1, actor, auth);
connect(s1, auth, app);
connect(s1, app, db, { both: true });
text(s1, 'p1-db-link-label', 'อ่าน / บันทึก', 1325, 262, 140, 40, 25, false, 'center');
const reports = node(s1, 'p1-report', 'ภาพรวม / รายงานค้างชำระ', 'CSV สำหรับ Admin', 1470, 472, 380, 108, { titleSize: 30, bodySize: 26 });
connect(s1, db, reports, { fromSide: 'bottom', toSide: 'top' });
text(s1, 'p1-report-label', 'อ่านข้อมูลสรุป', 1675, 415, 170, 43, 24, false);

text(s1, 'p1-monthly-flow-label', 'ลำดับงานประจำเดือน', 300, 545, 700, 50, 31, true);
const r = node(s1, 'p1-readings', 'จดมิเตอร์น้ำ / ไฟฟ้า', 'ระบุชื่อช่างทุกครั้ง', 70, 625, 300, 170, { titleSize: 31, bodySize: 27 });
const draft = node(s1, 'p1-draft', 'สร้างบิลร่าง', 'Admin สั่งสร้าง\nสถานะ Draft', 440, 625, 300, 170);
const approved = node(s1, 'p1-approval', 'อนุมัติบิล', 'Admin อนุมัติ\nสถานะ Unpaid', 810, 625, 300, 170);
const cash = node(s1, 'p1-cash', 'รับชำระเงินสด', 'Admin รับเต็มยอด\nบิลเป็น Paid', 1180, 625, 300, 170);
const receipt = node(s1, 'p1-receipt', 'แสดง / พิมพ์ใบเสร็จ', 'ระบบสร้างให้อัตโนมัติ\nเมื่อยืนยันรับเงิน', 1550, 625, 300, 170, { titleSize: 30, bodySize: 27 });
connect(s1, app, r, { kind: 'elbow3', fromSide: 'bottom', toSide: 'top' });
text(s1, 'p1-app-flow-label', 'ใช้งานตามสิทธิ์', 620, 442, 300, 43, 26, false, 'center');
connect(s1, r, draft);
connect(s1, draft, approved);
connect(s1, approved, cash);
connect(s1, cash, receipt);
text(s1, 'p1-bill-rule', 'มิเตอร์ครบก่อนสร้างบิล', 445, 807, 290, 45, 25, false, 'center', gray);
text(s1, 'p1-payment-rule', 'รับเงินได้เฉพาะบิล Unpaid', 1160, 807, 340, 45, 25, false, 'center', gray);
rule(s1, 70, 895, 1780);
text(s1, 'p1-staff-role', 'เจ้าหน้าที่: ภาพรวมการจดมิเตอร์ ดูข้อมูลห้องพัก และบันทึกมิเตอร์', 70, 915, 1740, 45, 28);
text(s1, 'p1-admin-role', 'Admin: เข้าถึงทุกส่วน รวมบิล รับเงินสด รายงาน และเมนูประกอบ', 70, 963, 1650, 45, 28);
s1.speakerNotes.text = `Phase 1 ครอบคลุมงานสำนักงานของเว็บไซต์ ตั้งแต่ผู้ใช้งานเข้าสู่ระบบ ตรวจสิทธิ์ จดมิเตอร์ และสั่งสร้างบิล ไปจนถึงรับเงินสดและพิมพ์ใบเสร็จ\n\nการจดมิเตอร์ต้องระบุชื่อช่างทุกครั้ง แต่ไม่ได้สร้างบิลให้อัตโนมัติ Admin ต้องสั่งสร้างบิล Draft หลังมีเลขมิเตอร์ครบ และอนุมัติเป็น Unpaid ก่อนรับเงินได้ การยืนยันเงินสดเต็มยอดจะสร้าง payment และ receipt พร้อมเปลี่ยนบิลเป็น Paid ภายใน transaction เดียว หน้าใบเสร็จเป็นการแสดงหรือพิมพ์เอกสารนั้น\n\nฐานข้อมูล PostgreSQL เป็นข้อมูลส่วนกลางของทุกโมดูล ลูกศรสองหัวหมายถึงอ่านและบันทึกข้อมูล ส่วนภาพรวมและรายงานอ่านข้อมูลสรุปจากฐานข้อมูล เจ้าหน้าที่เข้าถึงภาพรวมเฉพาะห้องและมิเตอร์ ไม่เห็นยอดเงินหรืออัตราค่าบริการ การส่งออก CSV จำกัด Admin\n\nแหล่งโค้ดในโปรเจกต์:\n${root}/app.js\n${root}/lib/permissions.js\n${root}/routes/auth.js\n${root}/services/readings.js\n${root}/services/billing.js\n${root}/services/payment.js\n${root}/routes/payments.js\n${root}/routes/reports.js\n${root}/README.md`;

// PHASE 2: all LINE functions grouped here, with actual readiness distinguished.
const s2 = p.slides.add();
heading(s2, 'Phase 2  เชื่อมต่อผู้พักอาศัยผ่าน LINE', 'ขอบเขตงาน LINE แยกจากระบบเว็บไซต์หลัก', 2);
text(s2, 'p2-binding-section', 'การผูกบัญชีผู้พักอาศัย', 70, 234, 800, 55, 34, true);
text(s2, 'p2-existing-note', 'มีโค้ดรองรับแล้ว', 1460, 235, 390, 52, 29, false, 'right', gray);
const code = node(s2, 'p2-link-code', 'Admin สร้าง', 'รหัสผูกบัญชี', 70, 323, 340, 155);
const submit = node(s2, 'p2-send-code', 'ผู้พักอาศัยส่งรหัส', 'ผ่าน LINE', 550, 323, 340, 155);
const webhook = node(s2, 'p2-webhook', 'LINE Webhook', 'ตรวจลายเซ็นและรหัส', 1030, 323, 340, 155);
const bind = node(s2, 'p2-binding', 'บันทึก LINE User ID', 'ในข้อมูลผู้เช่า', 1510, 323, 340, 155, { titleSize: 31 });
connect(s2, code, submit);
connect(s2, submit, webhook);
connect(s2, webhook, bind);
text(s2, 'p2-code-label', 'รับรหัส', 425, 343, 110, 40, 24, false, 'center');
text(s2, 'p2-message-label', 'ข้อความ', 905, 343, 110, 40, 24, false, 'center');
text(s2, 'p2-binding-label', 'ตรวจสอบผ่าน', 1370, 343, 140, 40, 23, false, 'center');

rule(s2, 70, 536, 1780);
text(s2, 'p2-delivery-section', 'การส่งบิลและข้อความแจ้งเตือน', 70, 561, 1040, 55, 34, true);
text(s2, 'p2-delivery-status', 'ส่วนส่งจริงยังต้องพัฒนาต่อ', 1370, 561, 480, 52, 29, false, 'right', gray);
const unpaid = node(s2, 'p2-unpaid-bills', 'บิล Unpaid', 'และวันครบกำหนด', 70, 674, 340, 176, { fill: pale });
const queue = node(s2, 'p2-reminder-queue', 'งานตรวจรายวัน', 'จัดคิวแจ้งเตือน\nก่อนกำหนด / ค้างชำระ', 550, 674, 340, 176, { fill: pale, bodySize: 26 });
const api = node(s2, 'p2-outbound-api', 'LINE Messaging API', 'ส่งบิล / เตือนชำระ\nกระจายประกาศ', 1030, 674, 340, 176, { dashed: true, titleSize: 30, bodySize: 27 });
const resident = node(s2, 'p2-resident-delivery', 'ผู้พักอาศัย', 'รับข้อความผ่าน LINE OA', 1510, 674, 340, 176, { dashed: true, oval: true, bodySize: 25 });
connect(s2, unpaid, queue);
connect(s2, queue, api, { dashed: true });
connect(s2, api, resident, { dashed: true });
text(s2, 'p2-job-label', 'เมื่อเรียกงาน', 410, 705, 140, 40, 23, false, 'center');
text(s2, 'p2-api-label', 'เชื่อม API', 900, 705, 120, 40, 24, false, 'center');
text(s2, 'p2-deliver-label', 'ส่งข้อความ', 1380, 705, 120, 40, 24, false, 'center');
text(s2, 'p2-scope-note', 'ประกาศบันทึกในเว็บได้แล้ว การส่งบิลและกระจายข้อความผ่าน LINE อยู่ใน Phase 2', 70, 888, 1780, 50, 28);
rule(s2, 70, 956, 1780);
text(s2, 'p2-status-legend', 'เส้นทึบ: มีโค้ดรองรับแล้ว     เส้นประ: ส่วนที่ต้องพัฒนาต่อเพื่อส่งข้อความจริง', 70, 974, 1690, 45, 26, false, 'left', gray);
s2.speakerNotes.text = `งาน LINE ทั้งหมดจัดเป็น Phase 2 ตามขอบเขตการนำเสนอ แม้บางส่วนมีโค้ดรองรับอยู่แล้ว จึงแยกสถานะด้วยเส้นทึบและเส้นประ\n\nส่วนที่มีโค้ดแล้ว: Admin สร้างรหัสผูกบัญชี ผู้พักอาศัยส่งรหัสผ่าน LINE Webhook ตรวจลายเซ็นก่อนใช้รหัสและบันทึก LINE User ID ในข้อมูลผู้เช่า มี audit ของการผูกบัญชี\n\nการเตือนชำระ: งานตรวจรายวันเมื่อถูกเรียกจะใช้บิล Unpaid และวันครบกำหนดจัดคิวเตือนก่อนครบกำหนด 2 วัน และเกินกำหนดวันที่ 1, 8, 15 ไม่มีหลักฐานในโค้ดที่ตรวจว่ามี scheduler ภายนอกทำงานอยู่แล้ว จึงไม่ได้อ้างว่ามีการส่งอัตโนมัติจริง\n\nส่วนส่งจริงยังต้องพัฒนา: เชื่อม LINE Messaging API เพื่อส่งบิล แจ้งเตือน และประกาศ พร้อมตรวจผลจาก API ปัจจุบัน endpoint notification drain เปลี่ยนสถานะในฐานข้อมูล แต่ไม่ได้เรียก API ส่ง LINE ประกาศบันทึกได้แล้วโดยยังไม่กระจายข้อความ\n\nเมนูผู้พักอาศัยเป็นต้นแบบข้อมูลสมมุติ ไม่ใช่บริการที่เชื่อมฐานข้อมูลจริง\n\nแหล่งโค้ดในโปรเจกต์:\n${root}/routes/tenants.js\n${root}/routes/line.js\n${root}/services/linking.js\n${root}/services/jobs.js\n${root}/routes/internal.js\n${root}/routes/notifications.js\n${root}/services/announcements.js\n${root}/README.md`;

await fs.writeFile(path.join(tmp, 'connections.json'), JSON.stringify(connections, null, 2));
await fs.writeFile(path.join(tmp, 'inspect.ndjson'), (await p.inspect({ kind: 'slide,textbox,shape,notes', maxChars: 200000 })).ndjson);
for (const [i, slide] of p.slides.items.entries()) {
  const num = i + 1;
  await fs.writeFile(path.join(tmp, `slide-${num}.layout.json`), await (await slide.export({ format: 'layout' })).text());
  await fs.writeFile(path.join(tmp, `slide-${num}.png`), new Uint8Array(await (await p.export({ slide, format: 'png', scale: 1 })).arrayBuffer()));
}
await (await PresentationFile.exportPptx(p)).save(path.join(tmp, 'candidate.pptx'));
console.log(JSON.stringify({ slides: p.slides.items.length, nodes: nodes.size, attachedConnectors: connections.length, candidate: path.join(tmp, 'candidate.pptx') }));
