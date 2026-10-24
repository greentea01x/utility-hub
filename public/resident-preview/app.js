(function () {
  'use strict';
  const data = window.ResidentData;
  const views = window.ResidentViews;
  const page = document.body.dataset.page || 'home';
  const params = new URLSearchParams(location.search);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => Number(value).toLocaleString('th-TH');
  const storageKey = 'juristic.residentPreview.';
  const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(storageKey + key)); return Array.isArray(value) ? value : fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(storageKey + key, JSON.stringify(value)); return true; } catch { return false; } };
  const menu = [
    {id:'bills',emoji:'💰',label:'ดูบิลเดือนนี้',description:'ยอดและวันครบกำหนด',color:'mint'},
    {id:'history',emoji:'🗓️',label:'ประวัติชำระเงิน',description:'รายการย้อนหลัง',color:'blue'},
    {id:'receipts',emoji:'🧾',label:'ใบเสร็จรับเงิน',description:'หลักฐานการชำระ',color:'cream'},
    {id:'room',emoji:'🏢',label:'ข้อมูลห้องพัก',description:'ห้องและบัญชีของคุณ',color:'lavender'},
    {id:'announcements',emoji:'📣',label:'ข่าวสารคอนโด',description:'ประกาศสำหรับลูกบ้าน',color:'peach'},
    {id:'contact',emoji:'🎧',label:'ติดต่อนิติบุคคล',description:'ช่องทางติดต่อสำนักงาน',color:'sage'}
  ];
  const nav = [{id:'home',emoji:'🏡',label:'หน้าหลัก'},...menu];
  const href = id => id === 'home' ? 'index.html' : `${id}.html`;
  const state = {
    billPeriod: params.get('period') || '2026-09', historyFilter:'all', historySearch:'',
    announcementCategory:'all', readAnnouncements:read('readAnnouncements',[]),
    receiptId:params.get('id'),contactTopic:['bill','receipt','room','other'].includes(params.get('topic')) ? params.get('topic') : 'bill'
  };

  const header = `<a href="#page-content" class="skip-link">ข้ามไปยังเนื้อหา</a><div class="prototype-banner"><span class="prototype-dot" aria-hidden="true"></span><span>ต้นแบบที่เลือกใช้สำหรับพัฒนาต่อไป · ข้อมูลตัวอย่าง</span><a href="decision.html">ดูบันทึกแบบที่เลือก</a></div><header class="topbar"><a class="brand-link" href="index.html"><span class="brand-logo" aria-hidden="true">🏢</span><span><span class="brand-name">${esc(data.brand)}</span><span class="brand-subtitle">บริการสำหรับลูกบ้าน</span></span></a><div class="topbar-right"><span class="room-pill">ห้อง ${esc(data.resident.room)}</span><span class="avatar-letter" aria-hidden="true">พ</span></div></header>`;
  const sidebar = `<aside class="sidebar"><p class="nav-label">บริการของคุณ</p><nav class="side-nav" aria-label="เมนูบริการลูกบ้าน">${nav.map(item=>`<a class="nav-link${page===item.id?' active':''}" href="${href(item.id)}"${page===item.id?' aria-current="page"':''}><span class="nav-emoji" aria-hidden="true">${item.emoji}</span>${item.label}</a>`).join('')}</nav><div class="sidebar-help"><strong>มีเรื่องให้เราช่วยดูแล?</strong>นิติบุคคลพร้อมให้ข้อมูล<br>จันทร์–ศุกร์ 09:00–17:00 น.<a href="contact.html">ติดต่อสำนักงาน <span aria-hidden="true">↗</span></a></div></aside>`;
  const mobile = `<nav class="mobile-nav" aria-label="เมนูหลักบนมือถือ">${[nav[0],menu[0],menu[4],menu[5]].map(item=>`<a href="${href(item.id)}" class="${page===item.id?'active':''}"${page===item.id?' aria-current="page"':''}><span aria-hidden="true">${item.emoji}</span>${{home:'หน้าหลัก',bills:'ดูบิล',announcements:'ข่าวสาร',contact:'ติดต่อ'}[item.id]}</a>`).join('')}</nav>`;
  document.getElementById('app').innerHTML = `${header}<div class="app-layout">${sidebar}<main id="page-content" class="content" tabindex="-1"></main></div>${mobile}<dialog id="announcement-dialog" aria-labelledby="announcement-dialog-title"><div class="dialog-top"><span>ข่าวสารจากนิติบุคคล</span><button type="button" class="dialog-close" data-action="close-dialog" aria-label="ปิดประกาศ">×</button></div><div class="dialog-body"></div><div class="dialog-actions"><button type="button" class="button primary" data-action="mark-read">รับทราบแล้ว</button></div></dialog><div class="toast" role="status" aria-live="polite"></div>`;
  const main = document.getElementById('page-content');
  const dialog = document.getElementById('announcement-dialog');
  let dialogId = null;
  let dialogSource = null;
  let toastTimer;
  const toast = text => { const el=document.querySelector('.toast'); el.textContent=text; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{el.textContent='';},3600); };
  const footer = `<footer class="page-footer"><span>ข้อมูลจำลอง ณ 1 กันยายน 2026</span><span aria-hidden="true">·</span><a href="decision.html">แบบที่เลือกใช้สำหรับพัฒนาต่อไป</a></footer>`;

  function home() {
    const current = data.bills.find(bill=>bill.period==='2026-09');
    return `<section class="home-greeting"><div><h1>สวัสดีค่ะ ${esc(data.resident.name)}</h1><p>ห้อง ${esc(data.resident.room)} · อาคาร ${esc(data.resident.building)} · บ้านของคุณดูแลง่ายขึ้น</p></div><span class="linked-badge">✓ ผูกบัญชีแล้ว</span></section><section class="hero"><div class="hero-copy"><p class="eyebrow">บริการลูกบ้าน</p><h2>เรื่องคอนโด<br>สะดวกในที่เดียว</h2><p>ดูบิล ใบเสร็จ และข่าวสารของคุณ</p></div><img class="hero-art" src="assets/residence.svg" alt=""></section><section class="home-bill" aria-label="บิลที่รอชำระ"><div class="home-bill-copy"><span class="home-bill-icon" aria-hidden="true">🧾</span><div><h3>ค่าใช้จ่ายเดือนกันยายน <span class="badge pending">รอชำระ</span></h3><p>กำหนดชำระ 5 กันยายน 2026</p></div></div><div class="home-bill-right"><span class="home-total">${money(current.total)}<small>บาท</small></span><a class="button primary" href="bills.html">ดูรายละเอียด <span aria-hidden="true">→</span></a></div></section><section aria-labelledby="services-title"><div class="section-heading"><h2 id="services-title">เลือกบริการที่ต้องการ</h2><span>6 เมนูสำหรับลูกบ้าน</span></div><div class="menu-grid">${menu.map(item=>`<a class="menu-card ${item.color}" href="${href(item.id)}"><span class="menu-arrow" aria-hidden="true">↗</span><span class="menu-icon" aria-hidden="true">${item.emoji}</span><strong>${item.label}</strong><small>${item.description}</small></a>`).join('')}</div></section><div class="home-lower"><section class="panel mini-story"><span class="story-icon" aria-hidden="true">💧</span><div><p class="eyebrow">ข่าวสารล่าสุด</p><h3>แจ้งหยุดจ่ายน้ำชั่วคราว</h3><p>4 กันยายน · 10:00–12:00 น. · อาคาร A</p><a class="text-link" href="announcements.html?announcement=water-20260904">อ่านรายละเอียด →</a></div></section><section class="panel mini-story office-mini"><span class="story-icon" aria-hidden="true">🎧</span><div><h3>ติดต่อนิติบุคคล</h3><p>จันทร์–ศุกร์ 09:00–17:00 น.<br>อาคาร A ชั้น 1</p><a class="text-link" href="contact.html">ดูช่องทางติดต่อ →</a></div></section></div>`;
  }

  function decision() {
    return `<header class="page-heading"><p class="eyebrow">บันทึกการเลือกแบบ · 16 ตุลาคม 2026</p><h1 class="page-title">แบบที่เลือกใช้สำหรับลูกบ้าน</h1><p class="page-description">เก็บต้นแบบนี้ไว้เป็นแนวทางสำหรับพัฒนาระบบผู้พักอาศัยผ่าน LINE ต่อไป</p></header><div class="notice success"><strong>สถานะ: เลือกใช้เป็นแบบสำหรับพัฒนาต่อไป</strong><p>ใช้เมนูสีพาสเทล 6 ช่อง พร้อมภาพอาคารและอิโมจิ โดยเน้นใช้งานผ่านมือถือ</p></div><section class="panel"><h2>เมื่อกดแต่ละเมนู จะพบอะไร</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>เมนู</th><th>เนื้อหาและการทำงานในต้นแบบ</th></tr></thead><tbody>${[
      ['bills','💰 ดูบิลเดือนนี้','ยอดรวม รายการค่าน้ำ ค่าไฟ ค่าส่วนกลาง เลขมิเตอร์ และวิธีชำระเงินสด'],
      ['history','🗓️ ประวัติชำระเงิน','ค้นหาเดือน กรองสถานะ เปิดใบเสร็จ และดาวน์โหลดข้อมูลตัวอย่างเป็น CSV'],
      ['receipts','🧾 ใบเสร็จรับเงิน','เลือกใบเสร็จย้อนหลัง เปิดรายละเอียด และพิมพ์หรือบันทึก PDF ผ่านเบราว์เซอร์'],
      ['room','🏢 ข้อมูลห้องพัก','ข้อมูลห้อง 205 พื้นที่ อาคาร ชั้น และสถานะการผูกบัญชีตัวอย่าง'],
      ['announcements','📣 ข่าวสารคอนโด','กรองหมวดประกาศ อ่านรายละเอียด และทำเครื่องหมายรับทราบ'],
      ['contact','🎧 ติดต่อนิติบุคคล','ดูเวลาทำการ ที่ตั้งสำนักงาน และบันทึกคำถามตัวอย่างในเบราว์เซอร์']
    ].map(([id,label,detail])=>`<tr><td><a href="${id}.html">${label}</a></td><td>${detail}</td></tr>`).join('')}</tbody></table></div></section><div class="two-column"><section class="panel"><h2>ขอบเขตภาคเรียนนี้</h2><p>เน้นระบบภายในสำนักงานที่พัฒนาแล้ว ตั้งแต่เข้าสู่ระบบ ดูข้อมูลห้อง จดมิเตอร์ จัดการบิล รับชำระเงินสด และออกใบเสร็จ</p></section><section class="panel"><h2>ส่วนที่จะพัฒนาต่อไป</h2><p>เว็บสำหรับลูกบ้านและเมนู LINE ตามต้นแบบนี้ การยืนยันตัวตน การจำกัดข้อมูลตามห้อง และการเชื่อมข้อมูลจริงกับระบบสำนักงาน</p></section></div><p class="notice">ต้นแบบใช้ข้อมูลสมมติ ไม่มีการส่งข้อความ LINE รับชำระเงิน หรือส่งคำถามถึงเจ้าหน้าที่ ชื่อคอนโดในต้นแบบอ้างอิงจากภาพเมนูที่เลือก</p><div class="button-row"><a class="button primary" href="index.html">ลองใช้งานต้นแบบ</a><a class="button secondary" href="design-decision.json" download>ดาวน์โหลดบันทึกแบบ JSON</a><a class="button ghost" href="README.md">เปิดรายละเอียดสำหรับพัฒนาต่อ</a></div>`;
  }

  function render() {
    main.innerHTML = (page==='home'?home():page==='decision'?decision():views[page]?views[page](data,state):home()) + footer;
    if(page==='history') {
      const headers=[...main.querySelectorAll('.data-table thead th')].map(cell=>cell.textContent);
      main.querySelectorAll('.data-table tbody tr').forEach(row=>[...row.children].forEach((cell,index)=>{if(index>0)cell.dataset.label=headers[index];}));
    }
    if(page==='contact') showSavedQuestion();
  }
  function showSavedQuestion() {
    const saved = read('inquiries',[]);
    const target = document.getElementById('contact-result');
    if(!target || !saved.length) return;
    const item = saved[saved.length-1];
    target.innerHTML = `<div class="saved-question"><strong>คำถามตัวอย่างล่าสุดที่บันทึกไว้</strong><p>${esc(item.message)}</p><p class="muted">${esc(item.label)} · เก็บไว้เฉพาะเบราว์เซอร์นี้ ยังไม่ได้ส่งถึงสำนักงาน</p><button class="button ghost" type="button" data-action="clear-inquiry">ลบคำถามตัวอย่าง</button></div>`;
  }
  function openAnnouncement(id, source) {
    if(!data.announcements.some(item=>item.id===id)) return;
    dialogId=id; dialogSource=source || null;
    dialog.querySelector('.dialog-body').innerHTML=views.announcementDetail(data,id);
    dialog.showModal();
  }
  function filteredBills() {
    const q=state.historySearch.trim().toLocaleLowerCase('th-TH');
    return data.bills.filter(bill=>(state.historyFilter==='all'||bill.status===state.historyFilter)&&(!q||`${bill.label} ${bill.id} ${bill.total}`.toLocaleLowerCase('th-TH').includes(q)));
  }
  function exportHistory() {
    const rows=[['เดือน','เลขที่บิล','ยอดรวม (บาท)','สถานะ','วันที่ชำระ','เลขที่ใบเสร็จ'],...filteredBills().map(bill=>[bill.label,bill.id,bill.total,bill.status==='paid'?'ชำระแล้ว':'รอชำระ',bill.paidDate||'',bill.receiptId||''])];
    const csv='\uFEFF'+rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='room-205-payment-history-demo.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('ดาวน์โหลดข้อมูลตัวอย่างตามตัวกรองแล้ว');
  }

  document.addEventListener('click', event=>{
    const trigger=event.target.closest('button[data-action],button[data-history-filter],button[data-announcement-category]');
    if(!trigger) return;
    if(trigger.dataset.historyFilter){state.historyFilter=trigger.dataset.historyFilter;render();main.querySelector(`[data-history-filter="${state.historyFilter}"]`).focus({preventScroll:true});return;}
    if(trigger.dataset.announcementCategory){state.announcementCategory=trigger.dataset.announcementCategory;render();main.querySelector(`[data-announcement-category="${state.announcementCategory}"]`).focus({preventScroll:true});return;}
    switch(trigger.dataset.action){
      case 'export-history':exportHistory();break;
      case 'print-receipt':window.print();break;
      case 'announcement':openAnnouncement(trigger.dataset.id,trigger);break;
      case 'close-dialog':dialog.close();break;
      case 'mark-read':{
        if(!state.readAnnouncements.includes(dialogId)) state.readAnnouncements.push(dialogId);
        const persisted=save('readAnnouncements',state.readAnnouncements);
        const id=dialogId;dialog.close();render();main.querySelector(`[data-action="announcement"][data-id="${id}"]`)?.focus({preventScroll:true});toast(persisted?'ทำเครื่องหมายว่าอ่านแล้ว':'ทำเครื่องหมายว่าอ่านแล้วในหน้านี้');break;
      }
      case 'clear-inquiry':{
        if(save('inquiries',[])){document.getElementById('contact-result').replaceChildren();toast('ลบคำถามตัวอย่างแล้ว');}else toast('เบราว์เซอร์ไม่อนุญาตให้แก้ไขข้อมูลที่บันทึก');break;
      }
    }
  });
  dialog.addEventListener('close',()=>{if(dialogSource?.isConnected)dialogSource.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  document.addEventListener('change',event=>{if(event.target.id==='bill-period'){state.billPeriod=event.target.value;render();document.getElementById('bill-period').focus({preventScroll:true});}});
  document.addEventListener('input',event=>{if(event.target.id==='history-search'){const caret=event.target.selectionStart;state.historySearch=event.target.value;render();const input=document.getElementById('history-search');input.focus({preventScroll:true});if(caret!==null)input.setSelectionRange(caret,caret);}});
  document.addEventListener('submit',event=>{
    if(event.target.id!=='contact-form')return;event.preventDefault();
    const form=event.target;const message=form.elements.message.value.trim();
    if(!message){form.elements.message.setCustomValidity('กรุณาระบุคำถามก่อนบันทึก');form.elements.message.reportValidity();form.elements.message.addEventListener('input',()=>form.elements.message.setCustomValidity(''),{once:true});return;}
    if(!form.checkValidity())return;
    const topic=form.elements.topic;const entries=read('inquiries',[]).slice(-4);
    entries.push({topic:topic.value,label:topic.selectedOptions[0].textContent,message,createdAt:new Date().toISOString(),room:'205'});
    if(save('inquiries',entries)){form.elements.message.value='';showSavedQuestion();toast('บันทึกคำถามตัวอย่างแล้ว ยังไม่ได้ส่งถึงสำนักงาน');}else toast('เบราว์เซอร์ไม่อนุญาตให้บันทึก กรุณาคัดลอกข้อความเก็บไว้');
  });
  render();
  if(page==='announcements'&&params.has('announcement'))openAnnouncement(params.get('announcement'),null);
}());
