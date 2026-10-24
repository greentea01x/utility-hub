import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base='http://127.0.0.1:3000/resident-preview/';
const output=`${process.cwd()}/docs/mockups/resident-preview`;
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
const results=[];
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const go=async file=>{const res=await page.goto(base+file);assert.equal(res.status(),200);await page.evaluate(()=>document.fonts.ready);await page.locator('#page-content h1').waitFor();};
  for(const [size,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
    await page.setViewportSize(viewport);
    for(const file of ['index','bills','history','receipts','room','announcements','contact','decision']){
      await go(`${file}.html`);
      const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,broken:[...document.images].filter(image=>!image.complete||image.naturalWidth===0).length,font:document.fonts.check('14px ResidentThai')}));
      assert.ok(metrics.scrollWidth<=metrics.width,`${size}/${file} horizontal overflow ${JSON.stringify(metrics)}`);
      assert.equal(metrics.broken,0,`${size}/${file} image broken`);assert.ok(metrics.font);
      await page.screenshot({path:`${output}/${size}-${file}.png`,fullPage:true});
      results.push(`${size}/${file}: rendered`);
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await go('index.html');
  assert.equal(await page.locator('.menu-card').count(),6);
  for(const file of ['bills','history','receipts','room','announcements','contact']){
    await go('index.html');await page.locator(`.menu-card[href="${file}.html"]`).click();
    await page.waitForURL(`**/${file}.html`);assert.ok(await page.locator('#page-content h1').isVisible());
  }
  results.push('Six home menu destinations open');
  await go('bills.html');assert.match(await page.locator('.amount').first().textContent(),/1,790/);
  assert.equal(await page.locator('a.button.primary[href^="receipts.html"]').count(),0);
  await page.locator('#bill-period').selectOption('2026-08');assert.match(await page.locator('.amount').first().textContent(),/1,732/);
  assert.equal(await page.locator('a.button.primary[href^="receipts.html"]').count(),1);
  await page.locator('#bill-period').selectOption('2026-09');await page.locator('summary').click();assert.ok(await page.getByText('กำหนดชำระเดือนนี้ตรงกับวันเสาร์', {exact:false}).isVisible());
  results.push('Bill period changes, amounts, cash instructions, receipt availability');
  await go('history.html');
  await page.locator('[data-history-filter="paid"]').click();assert.equal(await page.locator('tbody tr').count(),3);
  await page.locator('[data-history-filter="pending"]').click();assert.equal(await page.locator('tbody tr').count(),1);
  await page.locator('[data-history-filter="all"]').click();await page.locator('#history-search').fill('ไม่มีรายการนี้');assert.equal(await page.locator('.empty-state').count(),1);
  await page.locator('#history-search').fill('สิงหาคม');assert.equal(await page.locator('tbody tr').count(),1);
  const downloadPromise=page.waitForEvent('download');await page.locator('[data-action="export-history"]').click();const download=await downloadPromise;const filePath=await download.path();const csv=await fs.readFile(filePath,'utf8');assert.equal(csv.split('\r\n').length,2);assert.ok(csv.includes('1732'));assert.ok(!csv.includes('1790'));
  results.push('History status/search/empty state and filtered UTF-8 CSV');
  await go('receipts.html');assert.equal(await page.locator('.receipt-list article').count(),3);
  await page.locator('.receipt-list a').first().click();await page.waitForURL('**/receipts.html?id=*');
  assert.match(await page.locator('.receipt-paper').textContent(),/1,732/);
  await page.evaluate(()=>{window.__printCalls=0;window.print=()=>{window.__printCalls++;};});
  await page.locator('[data-action="print-receipt"]').click();assert.equal(await page.evaluate(()=>window.__printCalls),1);
  await page.emulateMedia({media:'print'});assert.ok(await page.locator('.receipt-paper').isVisible());assert.equal(await page.locator('.topbar').isVisible(),false);
  await page.screenshot({path:`${output}/receipt-print.png`,fullPage:true});
  await page.emulateMedia({media:'screen'});
  await go('receipts.html?id=missing');assert.match(await page.locator('h1').textContent(),/ไม่พบใบเสร็จ/);
  results.push('Past receipt detail, print action/print layout and missing receipt state');
  await go('announcements.html');await page.locator('[data-announcement-category="maintenance"]').click();assert.equal(await page.locator('.announcement-card').count(),1);
  await page.locator('[data-action="announcement"]').click();assert.ok(await page.locator('dialog').isVisible());assert.match(await page.locator('#announcement-dialog-title').textContent(),/หยุดจ่ายน้ำ/);
  await page.locator('[data-action="mark-read"]').click();assert.equal(await page.locator('dialog').isVisible(),false);assert.ok(await page.locator('.announcement-card').getByText('อ่านแล้ว',{exact:true}).isVisible());
  await page.reload();assert.ok(await page.locator('.announcement-card').first().getByText('อ่านแล้ว',{exact:true}).isVisible());
  await go('announcements.html?announcement=water-20260904');assert.ok(await page.locator('dialog').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').isVisible(),false);
  results.push('Announcement filtering, deep link, dialog, keyboard close and read persistence');
  await go('room.html');await page.getByRole('link',{name:'ติดต่อแก้ไขข้อมูล'}).click();await page.waitForURL('**/contact.html?topic=room');assert.equal(await page.locator('#contact-topic').inputValue(),'room');
  await page.locator('#contact-message').fill('ขอสอบถามข้อมูลห้องค่ะ <ข้อความตัวอย่าง>');await page.locator('button[type="submit"]').click();assert.match(await page.locator('#contact-result').textContent(),/<ข้อความตัวอย่าง>/);assert.equal(await page.locator('#contact-result script').count(),0);
  await page.reload();assert.match(await page.locator('#contact-result').textContent(),/ยังไม่ได้ส่งถึงสำนักงาน/);
  await page.locator('[data-action="clear-inquiry"]').click();assert.equal(await page.locator('#contact-result').textContent(),'');
  results.push('Room-to-contact topic, local sample inquiry save/reload/clear');
  const decision=JSON.parse(await fs.readFile(`${process.cwd()}/public/resident-preview/design-decision.json`,'utf8'));assert.equal(decision.status,'selected_for_future_development');assert.equal(decision.menus.length,6);
  assert.equal(errors.length,0,errors.join('\n'));
  await fs.writeFile(`${output}/verification.json`,JSON.stringify({testedAt:new Date().toISOString(),browser:'Chrome',base,results,errors},null,2));
  console.log(JSON.stringify({passed:results.length,errors,screenshots:output},null,2));
}finally{await browser.close();}
