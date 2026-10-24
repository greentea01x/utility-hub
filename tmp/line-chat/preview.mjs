import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const dir = `${process.cwd()}/docs/mockups/line-chat`;
const names = ['01-link-account', '02-monthly-bill', '03-payment-confirmation'];
const pictures = await Promise.all(names.map(async name => `<img src="data:image/png;base64,${(await fs.readFile(`${dir}/${name}.png`)).toString('base64')}" alt="${name}">`));
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page = await browser.newPage({viewport:{width:1680,height:1160},deviceScaleFactor:1});
  await page.route('**/*', r=>r.abort());
  await page.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;display:flex;background:#f8faf9}img{display:block;width:560px;height:1160px}</style></head><body>${pictures.join('')}</body></html>`);
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:`${dir}/three-chat-preview.png`});
} finally {await browser.close();}
console.log(`${dir}/three-chat-preview.png`);
