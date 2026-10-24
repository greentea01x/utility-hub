import fs from 'node:fs/promises';
const root=process.cwd();
const dir=`${root}/public/resident-preview`;
const pages={index:['home','บริการลูกบ้าน'],bills:['bills','บิลประจำเดือน'],history:['history','ประวัติชำระเงิน'],receipts:['receipts','ใบเสร็จรับเงิน'],room:['room','ข้อมูลห้องพัก'],announcements:['announcements','ข่าวสารคอนโด'],contact:['contact','ติดต่อนิติบุคคล'],decision:['decision','บันทึกแบบที่เลือกใช้']};
for(const [file,[id,title]] of Object.entries(pages)){
  await fs.writeFile(`${dir}/${file}.html`,`<!doctype html>\n<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#196b53"><meta name="robots" content="noindex,nofollow"><meta name="description" content="ต้นแบบเว็บบริการลูกบ้านจากเมนู LINE สำหรับพัฒนาต่อไป ใช้ข้อมูลตัวอย่างห้อง 205"><title>${title} | ศุภาลัย เรสซิเดนซ์ · ต้นแบบ</title><link rel="icon" href="assets/residence.svg" type="image/svg+xml"><link rel="stylesheet" href="styles.css"><script src="data.js" defer></script><script src="pages.js" defer></script><script src="app.js" defer></script></head><body data-page="${id}"><div id="app"></div><noscript><p>โปรดเปิด JavaScript เพื่อทดลองหน้าบริการลูกบ้าน</p></noscript></body></html>\n`);
}
const mockup=await fs.readFile(`${root}/docs/mockups/line-chat/05-condo-rich-menu-redesign.html`,'utf8');
const svg=mockup.match(/<svg class="residence-art"[\s\S]*?<\/svg>/)?.[0];
if(!svg)throw new Error('Approved residence illustration missing');
await fs.writeFile(`${dir}/assets/residence.svg`,svg.replace(' class="residence-art"',''));
console.log(`Created ${Object.keys(pages).length} HTML entry points and illustration.`);
