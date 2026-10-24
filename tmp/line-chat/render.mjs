import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const out = path.join(root, 'docs/mockups/line-chat');
await fs.mkdir(out, { recursive: true });
const font = (await fs.readFile(path.join(root, 'public/fonts/NotoSansThai-Variable.ttf'))).toString('base64');

const icon = (type, size = 24) => {
  const paths = {
    back: '<path d="m15 5-7 7 7 7"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14.5c2 2.5 6 2.5 8 0"/><circle cx="8.5" cy="9" r=".7" fill="currentColor"/><circle cx="15.5" cy="9" r=".7" fill="currentColor"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3M9 21h6"/>',
    building: '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M3 21h18M9 6h1M14 6h1M9 9h1M14 9h1M9 12h1M14 12h1M10 21v-5h4v5"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[type]}</svg>`;
};
const avatar = `<div class="avatar">${icon('building', 23)}</div>`;
const p = s => `<p>${s.replaceAll('\n', '<br>')}</p>`;
const message = (who, chunks, time, cls = '') => `<div class="message ${who} ${cls}">${who === 'incoming' ? avatar : ''}<div class="bubble">${chunks.map(p).join('')}</div><div class="meta">${who === 'outgoing' ? '<span>อ่านแล้ว</span>' : ''}<span>${time}</span></div></div>`;

const scenes = [
  {
    slug: '01-link-account', title: 'ผูกบัญชีห้องพัก', number: '01', time: '09:15', date: '31 สิงหาคม 2026',
    messages: [
      message('outgoing', ['R4XTP9'], '09:14', 'code'),
      message('incoming', ['✅ ผูกบัญชีสำเร็จ\nห้อง 205\nคุณจะได้รับบิลและประกาศของห้องนี้\nผ่าน LINE'], '09:14'),
      message('outgoing', ['ขอสอบถามบิลเดือนที่แล้วค่ะ\nค่าน้ำสูงกว่าปกติ'], '09:15'),
      message('incoming', ['บัญชีนี้ใช้ส่งบิลและประกาศอัตโนมัติ\nไม่มีเจ้าหน้าที่ตอบในแชทนี้', 'หากต้องการสอบถาม กรุณาติดต่อ\nสำนักงานนิติบุคคล\nจันทร์–ศุกร์ 09:00–17:00 น.'], '09:15'),
    ],
  },
  {
    slug: '02-monthly-bill', title: 'แจ้งบิลประจำเดือน', number: '02', time: '09:20', date: '1 กันยายน 2026',
    messages: [
      message('incoming', [
        '🔔 ค่าใช้จ่ายประจำเดือน\nกันยายน 2026 · ห้อง 205',
        '💧 ค่าน้ำ\n10 หน่วย × 18 บาท = 180 บาท',
        '⚡ ค่าไฟฟ้า\n70 หน่วย × 8 บาท = 560 บาท',
        '🏢 ค่าส่วนกลาง\n30 ตร.ม. × 35 บาท = 1,050 บาท',
        '💰 ยอดรวม 1,790 บาท\n📅 ชำระภายในวันที่ 5 กันยายน 2026',
        'ชำระเงินสดที่สำนักงานนิติบุคคล\nจันทร์–ศุกร์ 09:00–17:00 น.',
      ], '09:12', 'bill'),
      message('outgoing', ['รับทราบค่ะ'], '09:20'),
    ],
  },
  {
    slug: '03-payment-confirmation', title: 'แจ้งเตือนและยืนยันรับชำระ', number: '03', time: '14:33', date: '3 กันยายน 2026',
    messages: [
      message('incoming', [
        '⏰ แจ้งเตือนก่อนครบกำหนด\nห้อง 205 · ยอดค้างชำระ 1,790 บาท',
        'ครบกำหนด 5 กันยายน 2026\nเหลือเวลาอีก 2 วัน',
        'ชำระเงินสดที่สำนักงานนิติบุคคล',
      ], '09:00'),
      message('incoming', [
        '✅ ยืนยันรับชำระเงิน\nห้อง 205\nรับชำระเงินสด 1,790 บาท\nเรียบร้อยแล้ว',
        'วันที่ 3 กันยายน 2026\nเลขที่ใบเสร็จ\nREC-202609-000852',
        'ขอบคุณที่ชำระค่าใช้จ่าย',
      ], '14:30'),
      message('outgoing', ['ขอบคุณค่ะ'], '14:33'),
    ],
  },
];

const css = `
@font-face { font-family: Thai; src: url(data:font/ttf;base64,${font}) format('truetype'); font-weight: 100 900; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Thai, sans-serif; color: #1f2e36; background: #f8faf9; -webkit-font-smoothing: antialiased; }
.stage { width: 560px; height: 1160px; padding: 20px 22px 0; }
.caption { display: flex; align-items: center; gap: 12px; height: 46px; padding: 0 5px 10px; font-size: 20px; font-weight: 650; color: #24433b; }
.number { font-size: 13px; font-weight: 700; letter-spacing: 1px; color: #638b7d; border-right: 1px solid #c8d8d2; padding-right: 12px; }
.phone { border: 6px solid #fff; border-radius: 35px; height: 1040px; width: 516px; overflow: hidden; background: #8cabc9; box-shadow: 0 0 0 1px #dfe6e3; display: flex; flex-direction: column; }
.header { background: #06c755; color: white; flex: 0 0 auto; }
.status { height: 33px; display: flex; align-items: center; justify-content: space-between; padding: 2px 21px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 600; }
.signals { display: flex; align-items: center; gap: 6px; }
.signals svg { display: block; }
.toolbar { height: 71px; display: flex; align-items: center; padding: 0 16px 6px 10px; gap: 9px; }
.toolbar .avatar { width: 38px; height: 38px; color: #fff; background: #ffffff35; }
.account { font-size: 19px; font-weight: 650; white-space: nowrap; }
.official { font-family: Arial, sans-serif; font-size: 10px; font-weight: 700; background: #ffffff35; border-radius: 12px; padding: 4px 7px; margin-left: auto; }
.chat { flex: 1; min-height: 0; padding: 19px 12px 22px; }
.date { width: fit-content; border-radius: 18px; margin: 0 auto 23px; padding: 4px 13px; background: #597a9d70; color: white; font-size: 12px; font-weight: 500; }
.message { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 20px; }
.avatar { width: 30px; height: 30px; display: flex; flex: 0 0 auto; justify-content: center; align-items: center; border-radius: 50%; color: #316c61; background: #e8f2ed; }
.bubble { position: relative; background: #fff; border-radius: 15px; padding: 13px 16px; max-width: 364px; font-size: 17.5px; line-height: 1.66; overflow-wrap: normal; word-break: normal; color: #172d34; }
.bubble:before { content: ''; position: absolute; top: 9px; left: -6px; border-top: 8px solid #fff; border-left: 9px solid transparent; }
.bubble p { margin: 0; }
.bubble p + p { margin-top: 13px; }
.meta { align-self: flex-end; display: flex; flex-direction: column; font-family: Thai, sans-serif; font-size: 10px; line-height: 1.45; color: #344f67; padding-bottom: 3px; white-space: nowrap; min-width: 28px; }
.outgoing { flex-direction: row-reverse; }
.outgoing .bubble { background: #79e856; max-width: 345px; }
.outgoing .bubble:before { left: auto; right: -6px; border-top-color: #79e856; border-left: none; border-right: 9px solid transparent; }
.outgoing .meta { text-align: right; }
.code .bubble { font-family: Thai, sans-serif; font-size: 19px; letter-spacing: .7px; }
.bill .bubble { font-size: 17px; padding: 14px 15px; }
.composer { height: 75px; background: white; display: flex; align-items: center; gap: 12px; padding: 0 15px 11px; color: #65727c; flex: 0 0 auto; }
.input { flex: 1; height: 40px; background: #f3f4f6; border: 1px solid #e6e9ed; border-radius: 24px; display: flex; align-items: center; justify-content: space-between; padding: 0 13px; color: #9ca4ac; font-size: 15px; }
.input svg { color: #7e8993; }
.bottom { position: relative; }
.home { position: absolute; width: 123px; height: 4px; background: #212e35; border-radius: 5px; bottom: 6px; left: calc(50% - 61.5px); }
.footnote { text-align: center; color: #71827b; font-size: 12px; letter-spacing: .1px; padding-top: 15px; }
`;

const statusIcons = `<div class="signals"><svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="4.5" y="5.5" width="3" height="6.5" rx=".7"/><rect x="9" y="3" width="3" height="9" rx=".7"/><rect x="13.5" y="0" width="3" height="12" rx=".7"/></svg><svg width="16" height="13" viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 4a13 13 0 0 1 16 0M5 8a8 8 0 0 1 10 0M8 12a3 3 0 0 1 4 0"/><circle cx="10" cy="15" r=".6" fill="currentColor" stroke="none"/></svg><svg width="25" height="13" viewBox="0 0 28 14" fill="none" stroke="currentColor"><rect x=".6" y=".6" width="23" height="12" rx="2.5"/><rect x="3" y="3" width="17" height="7.2" rx="1" fill="currentColor" stroke="none"/><path d="M26 4v5" stroke-width="2.4"/></svg></div>`;

const renderHTML = (scene) => `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${scene.title} — LINE OA mockup</title><style>${css}</style></head><body><main class="stage"><div class="caption"><span class="number">${scene.number}</span>${scene.title}</div><section class="phone"><header class="header"><div class="status"><span>${scene.time}</span>${statusIcons}</div><div class="toolbar">${icon('back', 22)}${avatar}<div class="account">ศุภาลัย เรสซิเดนซ์</div><span class="official">Official</span></div></header><section class="chat"><div class="date">${scene.date}</div>${scene.messages.join('')}</section><div class="bottom"><div class="composer">${icon('plus', 24)}<div class="input"><span>ข้อความ</span>${icon('smile', 22)}</div>${icon('mic', 23)}</div><div class="home"></div></div></section><footer class="footnote">ภาพจำลอง • แนวทางพัฒนาต่อไป</footer></main></body></html>`;

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 560, height: 1160 }, deviceScaleFactor: 2 });
  await page.route('**/*', r => r.abort());
  for (const scene of scenes) {
    const html = renderHTML(scene);
    await fs.writeFile(path.join(out, `${scene.slug}.html`), html);
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => {
      const chat = document.querySelector('.chat').getBoundingClientRect();
      const messages = [...document.querySelectorAll('.message')].map(el => {
        const r = el.getBoundingClientRect();
        return { bottom: r.bottom, right: r.right, text: el.textContent };
      });
      return { chatBottom: chat.bottom, lastMessageBottom: messages.at(-1).bottom, overflow: messages.some(m => m.bottom > chat.bottom || m.right > chat.right), fontsReady: document.fonts.check('18px Thai') };
    });
    if (metrics.overflow || !metrics.fontsReady) throw new Error(`${scene.slug} invalid: ${JSON.stringify(metrics)}`);
    await page.screenshot({ path: path.join(out, `${scene.slug}.png`) });
    console.log(scene.slug, JSON.stringify(metrics));
  }
} finally {
  await browser.close();
}
