import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
const root='/Users/initia-army/Documents/juristic-platform';
const tmp=path.join(root,'tmp/block-diagram-combined-20261017');
const p=Presentation.create({slideSize:{width:1920,height:1080}});
const s=p.slides.add(); s.background.fill='#FFFFFF';
const font='Thonburi', ink='#252525', gray='#666666', pale='#F1F1F1';
function text(id,value,x,y,w,h,size=26,bold=false,align='left',color=ink){
 const q=s.shapes.add({geometry:'textbox',name:id,position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 q.text=value; q.text.style={typeface:font,fontSize:size,bold,color,alignment:align,verticalAlignment:'middle',insets:0,wrap:'none',autoFit:'none'};return q;
}
function box(id,title,body,x,y,w,h,o={}){
 const q=s.shapes.add({geometry:o.oval?'ellipse':'rect',name:id,position:{left:x,top:y,width:w,height:h},fill:o.dark?'#363636':(o.fill??'#FFFFFF'),line:{fill:o.dashed?'#777777':ink,width:2,style:o.dashed?'dashed':'solid'}});
 q.text=[...title.split('\n').map(t=>({runs:[{run:t,style:{bold:true,fontSize:`${o.titleSize??29}px`,typeface:font}}],spaceAfter:250})),...(body?body.split('\n').map(t=>({runs:[{run:t,style:{fontSize:`${o.bodySize??25}px`,typeface:font}}],spaceAfter:120})):[])];
 q.text.style={typeface:font,fontSize:o.bodySize??25,color:o.dark?'#FFFFFF':ink,alignment:'center',verticalAlignment:'middle',insets:{left:10,right:10,top:10,bottom:10},wrap:'none',autoFit:'none'};return q;
}
function arrow(a,b,o={}){return s.shapes.connect(a,b,{kind:o.kind??'straight',fromSide:o.from??'right',toSide:o.to??'left',line:{fill:o.dashed?'#777777':ink,width:2.7,style:o.dashed?'dashed':'solid'},tail:{type:'triangle',width:'med',length:'med'},...(o.both?{head:{type:'triangle',width:'med',length:'med'}}:{})});}
function line(x,y,w,h=0){s.shapes.add({geometry:'line',name:'divider',position:{left:x,top:y,width:w,height:h},line:{fill:'#C5C5C5',width:1.2}});}

text('title','ระบบจัดการห้องพักและค่าสาธารณูปโภค',60,32,1510,82,49,true);
text('diagram-label','Block Diagram',1580,50,280,52,29,false,'right',gray);
line(60,128,1800); line(1260,150,0,870);
text('phase1-title','Phase 1  ระบบเว็บไซต์หลัก',60,155,1160,65,38,true);
text('phase2-title','Phase 2  งาน LINE',1320,155,540,65,38,true);

const actor=box('operator','ผู้ดูแลระบบ /\nเจ้าหน้าที่','',60,270,240,120,{oval:true,dark:true,titleSize:28});
const auth=box('auth','เข้าสู่ระบบ','ตรวจตัวตนและสิทธิ์',350,270,240,120,{titleSize:29,bodySize:24});
const app=box('app','Web App','Node.js + Express\n+ EJS',640,270,240,120,{fill:pale,titleSize:30,bodySize:24});
const db=box('database','ฐานข้อมูล','PostgreSQL\nSupabase',960,245,260,170,{fill:pale,titleSize:29,bodySize:27});
arrow(actor,auth);arrow(auth,app);arrow(app,db,{both:true});
text('db-link-label','อ่าน /\nบันทึก',884,252,72,60,22,false,'center');
const report=box('reports','ภาพรวม / รายงาน','ข้อมูลสรุปจากระบบ',960,480,260,100,{titleSize:27,bodySize:24});
arrow(db,report,{from:'bottom',to:'top'});

text('monthly-title','ลำดับงานประจำเดือน',275,600,430,52,30,true);
const readings=box('readings','จดมิเตอร์\nน้ำ / ไฟฟ้า','ระบุชื่อช่างทุกครั้ง',60,700,200,165,{titleSize:27,bodySize:23});
const draft=box('draft','สร้างบิลร่าง','Admin สั่งสร้าง\nสถานะ Draft',300,700,200,165,{titleSize:27,bodySize:24});
const approval=box('approval','อนุมัติบิล','Admin อนุมัติ\nสถานะ Unpaid',540,700,200,165,{titleSize:27,bodySize:24});
const cash=box('cash','รับเงินสด','Admin รับเต็มยอด\nบิลเป็น Paid',780,700,200,165,{titleSize:27,bodySize:23});
const receipt=box('receipt','แสดง / พิมพ์\nใบเสร็จ','สร้างอัตโนมัติ\nเมื่อยืนยันรับเงิน',1020,700,200,165,{titleSize:27,bodySize:24});
arrow(app,readings,{kind:'elbow3',from:'bottom',to:'top'});
text('work-label','ใช้งานตามสิทธิ์',350,425,320,42,25,false,'center');
arrow(readings,draft);arrow(draft,approval);arrow(approval,cash);arrow(cash,receipt);
line(60,915,1160);
text('staff-role','เจ้าหน้าที่: ภาพรวมการจดมิเตอร์ ดูห้อง และจดมิเตอร์',60,936,1160,43,26);
text('admin-role','Admin: เข้าถึงทุกส่วน รวมบิล รับเงินสด และรายงาน',60,982,1160,43,26);

text('binding-heading','การผูกบัญชี: มีโค้ดรองรับแล้ว',1320,236,540,43,27,true);
const residentInput=box('resident-code','ผู้พักอาศัย','ส่งรหัสผ่าน LINE',1320,310,220,120,{titleSize:28,bodySize:24});
const webhook=box('webhook','LINE Webhook','ตรวจรหัสและลายเซ็น\nผูกบัญชีผู้เช่า',1620,310,240,120,{titleSize:28,bodySize:23});
arrow(residentInput,webhook);
text('code-label','ส่งรหัส',1540,326,80,34,22,false,'center');
text('code-source','Admin เป็นผู้สร้างรหัสผูกบัญชี',1320,444,540,40,25,false,'left',gray);

text('delivery-heading','การส่งข้อความ: พัฒนาต่อ',1320,510,540,45,27,true);
const queue=box('queue','จัดคิวแจ้งเตือน','เมื่อเรียกงานตรวจรายวัน\nมีโค้ดรองรับแล้ว',1460,580,340,115,{fill:pale,titleSize:28,bodySize:24});
const api=box('api','LINE Messaging API','เชื่อมการส่งข้อความจริง',1460,745,340,100,{dashed:true,titleSize:28,bodySize:24});
const recipient=box('resident-output','ผู้พักอาศัย','รับข้อความผ่าน LINE OA',1460,925,340,100,{dashed:true,oval:true,titleSize:28,bodySize:24});
arrow(approval,queue,{from:'top',to:'left',kind:'elbow2'});
text('phase2-data-link','บิล Unpaid และวันครบกำหนด',840,628,555,40,24,false,'center');
arrow(queue,api,{from:'bottom',to:'top',dashed:true});
text('api-label','เชื่อม API',1648,698,212,40,24);
arrow(api,recipient,{from:'bottom',to:'top',dashed:true});
text('message-label','ส่งผ่าน LINE OA',1648,862,212,40,23);
text('future-note','เส้นประ: ยังไม่ส่งข้อความจริง',1320,1032,540,30,22,false,'left',gray);

s.speakerNotes.text=`ภาพรวมแบ่งขอบเขต Phase 1 และ Phase 2 ไว้ในหน้าเดียว\n\nPhase 1 คือระบบเว็บไซต์หลัก เจ้าหน้าที่ดูภาพรวมที่ไม่มีข้อมูลการเงิน ดูห้อง และบันทึกมิเตอร์ได้ การบันทึกมิเตอร์ต้องระบุชื่อช่างทุกครั้ง หลังเลขมิเตอร์ครบ Admin ต้องสั่งสร้างบิล Draft จากค่าน้ำ ค่าไฟ และค่าส่วนกลาง จากนั้นอนุมัติเป็น Unpaid จึงรับเงินสดเต็มยอดได้ ระบบสร้างรายการรับเงินและใบเสร็จ พร้อมเปลี่ยนบิลเป็น Paid ใน transaction เดียวกัน\n\nฐานข้อมูล PostgreSQL ใช้ร่วมกันทุกโมดูล เส้นสองหัวระหว่าง Web App และฐานข้อมูลคืออ่านและบันทึกข้อมูล รายงานอ่านข้อมูลสรุปจากฐานข้อมูล\n\nPhase 2 รวบรวมงาน LINE ทั้งหมด แม้มีโค้ดบางส่วนเตรียมไว้แล้ว Admin สร้างรหัสผูกบัญชีและผู้พักอาศัยส่งรหัสผ่าน LINE จากนั้น Webhook ตรวจลายเซ็นและรหัสก่อนบันทึก LINE User ID\n\nเส้นจากบิลที่อนุมัติไปคิวแจ้งเตือนหมายถึงบิล Unpaid และวันครบกำหนดเป็นข้อมูลสำหรับงานตรวจรายวันเมื่อถูกเรียก ไม่ใช่ส่งข้อความทันทีเมื่ออนุมัติ มีโค้ดจัดคิวก่อนครบกำหนดและค้างชำระแล้ว แต่ยังต้องเชื่อมการส่งจริงกับ LINE Messaging API\n\nประกาศบันทึกในเว็บไซต์ได้แล้ว การส่งบิล แจ้งเตือน และกระจายประกาศผ่าน LINE อยู่ใน Phase 2 ส่วนส่งจริงใช้เส้นประ\n\nแหล่งโค้ด:\n${root}/app.js\n${root}/lib/permissions.js\n${root}/services/readings.js\n${root}/services/billing.js\n${root}/services/payment.js\n${root}/routes/reports.js\n${root}/routes/line.js\n${root}/services/linking.js\n${root}/services/jobs.js\n${root}/routes/notifications.js\n${root}/services/announcements.js`;
await fs.writeFile(path.join(tmp,'slide.layout.json'),await(await s.export({format:'layout'})).text());
await fs.writeFile(path.join(tmp,'slide.png'),new Uint8Array(await(await p.export({slide:s,format:'png',scale:1})).arrayBuffer()));
await(await PresentationFile.exportPptx(p)).save(path.join(tmp,'candidate.pptx'));
console.log('Exported single-slide editable diagram');
