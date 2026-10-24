import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const dir = `${process.cwd()}/docs/mockups/line-chat`;
const base = await fs.readFile(`${dir}/04-condo-rich-menu.html`, 'utf8');
const windows = (x, y, cols, rows, color, gap=10) => Array.from({length: rows}, (_, row) => Array.from({length: cols}, (_, col) => `<rect x="${x+col*gap}" y="${y+row*12}" width="4.5" height="6" rx="1" fill="${color}"/>`).join('')).join('');
const residence = `<svg class="residence-art" viewBox="0 0 180 106" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="105" cy="97" rx="71" ry="8" fill="#145a48" opacity=".45"/><circle cx="129" cy="36" r="35" fill="#d1e7c4" opacity=".16"/><circle cx="155" cy="20" r="10" fill="#f9dc91"/><path d="M112 30h38v62h-38z" fill="#afd0c8"/><path d="M150 30h11v62h-11z" fill="#6ca399"/><path d="M114 26h45v7h-45z" fill="#d7e7df"/>${windows(119,40,3,4,'#4f8b80',10)}<rect x="65" y="10" width="50" height="84" rx="3" fill="#f0e8cf"/><path d="M115 14h13v80h-13z" fill="#c4ceb6"/><rect x="72" y="5" width="35" height="8" rx="2" fill="#d5dec7"/>${windows(73,21,4,5,'#75a899',10)}<rect x="84" y="78" width="15" height="16" rx="1.5" fill="#317b67"/><rect x="41" y="47" width="30" height="48" rx="2" fill="#c4ddd0"/><path d="M40 46h33v7H40z" fill="#e5ede1"/>${windows(47,60,2,2,'#5c9585',12)}<path d="M25 94h142" stroke="#c3d8b2" stroke-width="3" stroke-linecap="round"/><path d="M37 92V69M151 93V69" stroke="#99af87" stroke-width="3"/><ellipse cx="37" cy="66" rx="11" ry="17" fill="#91b694"/><ellipse cx="151" cy="70" rx="10" ry="14" fill="#83af8c"/><path d="M37 82V65M151 84V68" stroke="#4e896d" stroke-width="2" stroke-linecap="round"/></svg>`;
const menuItems = [
  ['bill', '💰', 'ดูบิลเดือนนี้', 'mint', 'ยอดและวันครบกำหนด'],
  ['history', '🗓️', 'ประวัติชำระเงิน', 'blue', 'รายการย้อนหลัง'],
  ['receipt', '🧾', 'ใบเสร็จรับเงิน', 'cream', 'หลักฐานการชำระ'],
  ['room', '🏢', 'ข้อมูลห้องพัก', 'lavender', 'ห้องและบัญชีของคุณ'],
  ['announcement', '📣', 'ข่าวสารคอนโด', 'peach', 'ประกาศสำหรับลูกบ้าน'],
  ['contact', '🎧', 'ติดต่อนิติบุคคล', 'sage', 'ช่องทางติดต่อสำนักงาน'],
];
const panel = `<section class="richmenu redesigned" aria-label="เมนูบริการคอนโด"><div class="menu-hero"><div class="hero-copy"><span class="hero-eyebrow">ศุภาลัย เรสซิเดนซ์</span><strong>บริการลูกบ้าน</strong><span class="hero-sub">เลือกเมนูที่ต้องการได้เลย</span></div>${residence}</div><div class="menu-grid">${menuItems.map(([key,emoji,label,color,description])=>`<div class="menu-tile ${color}" data-action="${key}"><span class="tile-corner" aria-hidden="true">↗</span><span class="emoji-halo"><span class="menu-emoji">${emoji}</span>${key==='history'?'<span class="check-badge">✓</span>':''}</span><strong>${label}</strong><span class="tile-subtitle">${description}</span></div>`).join('')}</div></section>`;
const style = `
.chat{background:#91afcb}.caption .number{font-size:11px;letter-spacing:.6px}
.richmenu.redesigned{padding:12px;background:#f2f3ee;border-top:1px solid #e3e8de;color:#203f37}
.menu-hero{height:88px;position:relative;overflow:hidden;border-radius:16px;background:linear-gradient(110deg,#145f4c 0%,#267b60 100%);margin-bottom:10px;color:#fff}
.hero-copy{position:relative;z-index:1;padding:11px 17px;display:flex;flex-direction:column;align-items:flex-start;line-height:1.4}
.hero-eyebrow{font-size:10px;letter-spacing:.2px;color:#cde4d7}.hero-copy strong{font-size:23px;font-weight:650;line-height:1.45;letter-spacing:-.4px}.hero-sub{font-size:11px;color:#d7ebe0}
.residence-art{position:absolute;right:6px;top:-1px;height:99px;width:168px}
.redesigned .menu-grid{gap:8px;grid-template-columns:repeat(3,minmax(0,1fr))}
.redesigned .menu-tile{height:137px;position:relative;border-radius:15px;background:#fff;display:flex;align-items:center;justify-content:flex-start;padding:10px 3px 6px;box-shadow:0 2px 4px #294e3810;border:1px solid #e1e7dc;color:#213e35}
.redesigned .menu-tile.mint{background:#e2f4e5;border-color:#a5ceb1;color:#174f3c}
.redesigned .menu-tile.blue{background:#e9f2fb;border-color:#d7e4f0}
.redesigned .menu-tile.cream{background:#fff3db;border-color:#eee1c7}
.redesigned .menu-tile.lavender{background:#f0eefa;border-color:#e1dff0}
.redesigned .menu-tile.peach{background:#ffede5;border-color:#f1ded4}
.redesigned .menu-tile.sage{background:#e8f3ed;border-color:#d5e5dc}
.emoji-halo{display:flex;align-items:center;justify-content:center;position:relative;width:69px;height:69px;border-radius:50%;background:#ffffff70;flex:0 0 auto;margin-bottom:5px}
.menu-emoji{font-family:'Apple Color Emoji','Noto Color Emoji',sans-serif;font-size:49px;line-height:1;filter:drop-shadow(0 3px 2px #244f3a13);transform:translateY(1px)}
.check-badge{position:absolute;right:-1px;bottom:3px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;background:#278566;border:2px solid #e9f2fb;border-radius:50%;color:white;font-family:Arial,sans-serif;font-size:12px;font-weight:bold}
.tile-corner{position:absolute;right:9px;top:6px;font-family:Arial,sans-serif;font-size:13px;color:#647e7070}
.redesigned .menu-tile strong{font-size:15px;font-weight:650;line-height:1.7;letter-spacing:-.2px;white-space:nowrap}
.redesigned .tile-subtitle{font-size:9px;line-height:1.7;color:#64776d;white-space:nowrap}
.menu-control{border-top:0;color:#516359;font-size:12px}.footnote{font-size:12px}
`;

const html = base
  .replace('<title>เมนูบริการคอนโดผ่าน LINE — ภาพจำลอง</title>', '<title>LINE OA คอนโด — เมนูภาพและอิโมจิ</title>')
  .replace('</style>', `${style}</style>`)
  .replace(/<section class="richmenu".*?<\/section>/s, panel)
  .replace('<div class="bubble"><p>บิลประจำเดือน</p></div>', '<div class="bubble"><p>ดูบิลเดือนนี้</p></div>');
await fs.writeFile(`${dir}/05-condo-rich-menu-redesign.html`, html);

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
    const labels = [...document.querySelectorAll('.menu-tile strong,.tile-subtitle')].map(el=>({text:el.textContent,overflow:el.scrollWidth>el.clientWidth}));
    return {messagesEnd:last.bottom,chatEnd:chat.bottom,menuHeight:menu.height,labels,overflow:last.bottom>chat.bottom||labels.some(el=>el.overflow)};
  });
  if (check.overflow) throw new Error(JSON.stringify(check));
  await page.screenshot({path:`${dir}/05-condo-rich-menu-redesign.png`});
  await page.locator('.richmenu').screenshot({path:`${dir}/condo-rich-menu-redesign-panel.png`});
  // A larger standalone menu makes the text and icons usable in presentation slides.
  await page.setViewportSize({width:560,height:1234});
  console.log(JSON.stringify(check));
} finally {await browser.close();}
