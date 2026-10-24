const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{
const dir=path.resolve('tmp/pdfs/overlays');
const ids=process.argv.slice(2).map(Number);const max=ids.length?Math.max(...ids):37;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-gpu']});const page=await browser.newPage();
let html='<!doctype html><html><head><meta charset="utf-8"><style>@page{size:1190.551pt 841.8898pt;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}.sheet{width:1190.551pt;height:841.8898pt;position:relative;break-after:page;overflow:hidden}.sheet:last-child{break-after:auto}svg{display:block;width:100%;height:100%}</style></head><body>';
const pages=ids.length?ids:Array.from({length:max},(_,i)=>i+1);
for(const i of pages){let file=path.join(dir,`page-${String(i).padStart(2,'0')}.svg`);let svg=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1654 1170"></svg>';html+=`<div class="sheet">${svg}</div>`;}
html+='</body></html>';await page.setContent(html);await page.evaluate(()=>document.fonts.ready);const out=ids.length?'tmp/pdfs/overlay-preview.pdf':'tmp/pdfs/overlays.pdf';await page.pdf({path:out,printBackground:true,preferCSSPageSize:true});await browser.close();console.log(out);
})();
