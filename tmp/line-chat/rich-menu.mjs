import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const dir = `${process.cwd()}/docs/mockups/line-chat`;
const base = await fs.readFile(`${dir}/02-monthly-bill.html`, 'utf8');
const paths = {
  bill: '<path d="M7 3h10l3 3v15l-4-2-4 2-4-2-4 2V3h3Z"/><path d="M8 8h8M8 12h8M8 16h4"/>',
  history: '<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v5l3 2"/>',
  receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="m8 9 2.5 2.5L16 6M8 15h8"/>',
  room: '<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/><path d="M11 8h2"/>',
  announcement: '<path d="m4 10 15-6v16L4 14v-4ZM4 14l2 7h4l-2-6M19 9l3-1M19 15l3 1"/>',
  contact: '<path d="M4 12a8 8 0 0 1 16 0M4 11H2v7h5v-7H4ZM20 11h2v7h-5v-7h3ZM20 18c0 3-4 3-7 3"/><path d="M11 21h3"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h1M5 12h1m3 0h1m3 0h1m3 0h1M7 16h10"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  building: '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M3 21h18M9 6h1M14 6h1M9 9h1M14 9h1M9 12h1M14 12h1M10 21v-5h4v5"/>',
};
const icon = (key, size=32) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
const avatar = `<div class="avatar">${icon('building', 23)}</div>`;
const bubble = (who, paragraphs, time) => `<div class="message ${who}">${who==='incoming'?avatar:''}<div class="bubble">${paragraphs.map(s=>`<p>${s.replaceAll('\n','<br>')}</p>`).join('')}</div><div class="meta">${who==='outgoing'?'<span>อ่านแล้ว</span>':''}<span>${time}</span></div></div>`;
const messages = [
  bubble('incoming', ['สวัสดีค่ะ ลูกบ้านห้อง 205\nเลือกบริการจากเมนูด้านล่างได้เลยค่ะ'], '09:15'),
  bubble('outgoing', ['บิลประจำเดือน'], '09:16'),
  bubble('incoming', ['🧾 บิลประจำเดือน กันยายน 2026\nห้อง 205', 'ค่าน้ำ 180 บาท\nค่าไฟฟ้า 560 บาท\nค่าส่วนกลาง 1,050 บาท', 'ยอดรวม 1,790 บาท\nชำระภายในวันที่ 5 กันยายน 2026', 'ชำระเงินสดที่สำนักงานนิติบุคคล'], '09:16'),
].join('');
const items = [
  ['bill','บิลประจำเดือน','ตรวจสอบยอดค่าใช้จ่าย','selected'],
  ['history','ประวัติชำระเงิน','ดูรายการย้อนหลัง',''],
  ['receipt','ใบเสร็จรับเงิน','ดูหลักฐานการชำระ',''],
  ['room','ข้อมูลห้องพัก','ห้องและบัญชีของคุณ',''],
  ['announcement','ประกาศคอนโด','ข่าวสารสำหรับลูกบ้าน',''],
  ['contact','ติดต่อนิติบุคคล','ช่องทางและเวลาทำการ',''],
];
const menu = `<section class="richmenu" aria-label="เมนูบริการคอนโด"><div class="menu-brand"><span class="brand-emblem">${icon('building', 25)}</span><div><strong>บริการสำหรับลูกบ้าน</strong><span>ศุภาลัย เรสซิเดนซ์</span></div><span class="room-tag">ห้อง 205</span></div><div class="menu-grid">${items.map(([key,title,sub,cls])=>`<div class="menu-tile ${cls}" data-action="${key}"><span class="tile-icon">${icon(key,33)}</span><strong>${title}</strong><span class="tile-subtitle">${sub}</span></div>`).join('')}</div></section>`;
const bottom = `${menu}<div class="menu-control"><span class="keyboard">${icon('keyboard',22)}</span><span>เมนูบริการคอนโด</span>${icon('down',19)}</div><div class="safe-area"><span></span></div>`;
const extraCSS = `
.stage{height:1234px}.phone{height:1114px}.caption{font-size:20px}
.chat{padding:15px 12px 15px}.date{margin-bottom:15px}
.message{margin-bottom:13px}.bubble{font-size:16.5px;line-height:1.56;padding:11px 15px}.bubble p+p{margin-top:11px}
.richmenu{flex:0 0 auto;background:#d9e6df;border-top:1px solid #c3d6cb;color:#244f43}
.menu-brand{height:58px;background:#f4f7ed;display:flex;align-items:center;gap:10px;padding:0 17px;border-bottom:1px solid #d9e6df}
.brand-emblem{color:#38725d}.menu-brand div{display:flex;flex-direction:column;line-height:1.4}.menu-brand strong{font-size:15px;font-weight:650}.menu-brand div>span{font-size:10px;color:#6e8174}
.room-tag{margin-left:auto;font-size:11px;border:1px solid #b4c9b8;background:#e9f0e4;border-radius:20px;padding:4px 10px;color:#52705d}
.menu-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px}
.menu-tile{height:124px;background:#f4faf6;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 4px;color:#285c4b}
.menu-tile:nth-child(2),.menu-tile:nth-child(6){background:#edf5f0}.menu-tile:nth-child(5){background:#f7f7ed}
.tile-icon{height:44px;display:flex;align-items:center;justify-content:center;margin-bottom:4px}
.menu-tile strong{font-size:15px;line-height:1.55;font-weight:650;white-space:nowrap}.tile-subtitle{font-size:10px;line-height:1.7;color:#72877b;white-space:nowrap}
.menu-tile.selected{background:#19745c;color:#fff}.menu-tile.selected .tile-subtitle{color:#d1e9de}
.menu-control{flex:0 0 auto;height:45px;background:#fff;display:flex;align-items:center;justify-content:center;gap:8px;position:relative;color:#41564c;font-size:13px;border-top:1px solid #d9e6df}
.keyboard{position:absolute;left:16px;top:11px;color:#7b8b82;border-right:1px solid #e2e7e3;padding-right:15px;height:23px}
.safe-area{height:19px;flex:0 0 auto;background:#fff;display:flex;justify-content:center;align-items:center}.safe-area span{display:block;height:4px;width:123px;border-radius:4px;background:#212e35}
`;

let html = base
  .replace('<title>แจ้งบิลประจำเดือน — LINE OA mockup</title>', '<title>เมนูบริการคอนโดผ่าน LINE — ภาพจำลอง</title>')
  .replace('</style>', `${extraCSS}</style>`)
  .replace('<span class="number">02</span>แจ้งบิลประจำเดือน', '<span class="number">LINE OA</span>เมนูบริการคอนโด')
  .replace('<span>09:20</span>', '<span>09:16</span>')
  .replace(/<section class="chat">.*?<\/section><div class="bottom">.*?<\/div><\/div><\/section>/s,
    `<section class="chat"><div class="date">1 กันยายน 2026</div>${messages}</section>${bottom}</section>`);
await fs.writeFile(`${dir}/04-condo-rich-menu.html`, html);

const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page = await browser.newPage({viewport:{width:560,height:1234},deviceScaleFactor:2});
  await page.route('**/*',r=>r.abort());
  await page.setContent(html);
  await page.evaluate(()=>document.fonts.ready);
  const check = await page.evaluate(()=>{
    const chat = document.querySelector('.chat').getBoundingClientRect();
    const last = [...document.querySelectorAll('.message')].at(-1).getBoundingClientRect();
    const menu = document.querySelector('.richmenu').getBoundingClientRect();
    const footer = document.querySelector('.footnote').getBoundingClientRect();
    return {messagesEnd:last.bottom,chatEnd:chat.bottom,menuStart:menu.top,menuButtons:document.querySelectorAll('.menu-tile').length,footerBottom:footer.bottom,overflow:last.bottom>chat.bottom||footer.bottom>innerHeight};
  });
  if (check.overflow || check.menuButtons!==6) throw new Error(JSON.stringify(check));
  await page.screenshot({path:`${dir}/04-condo-rich-menu.png`});
  await page.locator('.richmenu').screenshot({path:`${dir}/condo-rich-menu-panel.png`});
  console.log(JSON.stringify(check));
} finally {await browser.close();}
