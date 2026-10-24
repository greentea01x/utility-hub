(function () {
  'use strict';

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const money = (value) => Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  const date = (value) => value ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z')) : '—';
  const icon = (value) => `<span aria-hidden="true">${value}</span>`;
  const status = (bill) => `<span class="badge ${bill.status === 'paid' ? 'paid' : 'pending'}">${bill.status === 'paid' ? 'ชำระแล้ว' : 'รอชำระ'}</span>`;
  const heading = (eyebrow, title, description) => `<header class="page-heading"><p class="eyebrow">${esc(eyebrow)}</p><h1 class="page-title">${esc(title)}</h1><p class="page-description">${esc(description)}</p></header>`;
  const selectedBill = (data, state) => data.bills.find((bill) => bill.period === state.billPeriod) || data.bills[0];
  const receiptURL = (id) => `receipts.html?id=${encodeURIComponent(id)}`;
  const billLines = (bill) => `<div class="bill-lines">
    <div><span>${icon('💧')} ค่าน้ำ <small class="muted">${money(bill.water.units)} หน่วย × ${money(bill.water.rate)} บาท</small></span><strong>${money(bill.water.amount)} บาท</strong></div>
    <div><span>${icon('⚡')} ค่าไฟฟ้า <small class="muted">${money(bill.electricity.units)} หน่วย × ${money(bill.electricity.rate)} บาท</small></span><strong>${money(bill.electricity.amount)} บาท</strong></div>
    <div><span>${icon('🏢')} ค่าส่วนกลาง <small class="muted">${money(bill.common.area)} ตร.ม. × ${money(bill.common.rate)} บาท</small></span><strong>${money(bill.common.amount)} บาท</strong></div>
  </div>`;
  const empty = (symbol, title, description) => `<div class="empty-state">${icon(symbol)}<h2 class="section-title">${esc(title)}</h2><p class="muted">${esc(description)}</p></div>`;

  function bills(data, state = {}) {
    const bill = selectedBill(data, state);
    return `${heading('ค่าใช้จ่ายของคุณ', 'บิลประจำเดือน', 'ดูยอดค่าใช้จ่ายและรายละเอียดมิเตอร์ของห้อง ' + data.resident.room)}
      <div class="filter-row"><div class="field"><label for="bill-period">เลือกเดือน</label><select id="bill-period">${data.bills.map((item) => `<option value="${esc(item.period)}"${item.period === bill.period ? ' selected' : ''}>${esc(item.label)}</option>`).join('')}</select></div>${status(bill)}</div>
      <div class="two-column">
        <section class="panel stack"><div class="panel-heading"><div><p class="eyebrow">ห้อง ${esc(data.resident.room)} · ${esc(bill.label)}</p><h2 class="section-title">ยอดค่าใช้จ่ายรวม</h2></div>${icon('🧾')}</div><p class="amount">${money(bill.total)} <small>บาท</small></p><p class="muted">${bill.status === 'paid' ? 'รับชำระแล้วเมื่อ ' + date(bill.paidDate) : 'กำหนดชำระ ' + date(bill.dueDate)}</p>
        ${billLines(bill)}
        ${bill.receiptId ? `<a class="button primary" href="${receiptURL(bill.receiptId)}">${icon('📄')} ดูใบเสร็จรับเงิน</a>` : `<details class="notice"><summary>วิธีชำระค่าใช้จ่าย</summary><p>ชำระเงินสดที่${esc(data.office.name)} ${esc(data.office.location)} ${esc(data.office.days)} เวลา ${esc(data.office.hours)}</p><p>แจ้งเลขห้อง ${esc(data.resident.room)} และเดือนที่ต้องการชำระ เจ้าหน้าที่จะยืนยันรับเงินและออกใบเสร็จให้</p><p>กำหนดชำระเดือนนี้ตรงกับวันเสาร์ กรุณาติดต่อในวันทำการภายในวันที่ 4 กันยายน</p></details>`}
        </section>
        <section class="panel stack"><div class="panel-heading"><h2 class="section-title">${icon('📊')} รายละเอียดมิเตอร์</h2></div>
          <div class="table-wrap"><table class="data-table"><caption class="muted">เลขมิเตอร์และจำนวนหน่วยที่ใช้ในเดือนนี้</caption><thead><tr><th scope="col">รายการ</th><th scope="col">ครั้งก่อน</th><th scope="col">ครั้งนี้</th><th scope="col">ใช้ไป</th></tr></thead><tbody><tr><th scope="row">น้ำ</th><td>${money(bill.water.previous)}</td><td>${money(bill.water.current)}</td><td>${money(bill.water.units)} หน่วย</td></tr><tr><th scope="row">ไฟฟ้า</th><td>${money(bill.electricity.previous)}</td><td>${money(bill.electricity.current)}</td><td>${money(bill.electricity.units)} หน่วย</td></tr></tbody></table></div>
          <dl class="details-list"><div><dt>เลขที่บิล</dt><dd>${esc(bill.id)}</dd></div><div><dt>วันที่ออกบิล</dt><dd>${date(bill.issueDate)}</dd></div><div><dt>พื้นที่ห้องพัก</dt><dd>${money(data.resident.area)} ตร.ม.</dd></div></dl>
          <div class="notice"><strong>มีข้อสงสัยเกี่ยวกับยอดบิล?</strong><p>เตรียมเลขห้องและเดือนของบิล เพื่อให้เจ้าหน้าที่ตรวจสอบได้สะดวก</p><a class="button secondary" href="contact.html?topic=bill">ติดต่อเรื่องบิล</a></div>
        </section>
      </div>`;
  }

  function history(data, state = {}) {
    const filter = state.historyFilter || 'all';
    const search = String(state.historySearch || '').trim().toLocaleLowerCase('th-TH');
    const items = data.bills.filter((bill) => (filter === 'all' || bill.status === filter) && (!search || `${bill.label} ${bill.id} ${bill.total}`.toLocaleLowerCase('th-TH').includes(search)));
    const paid = data.bills.filter((bill) => bill.status === 'paid');
    const unpaid = data.bills.filter((bill) => bill.status === 'pending');
    return `${heading('ย้อนหลังทุกเดือน', 'ประวัติค่าใช้จ่าย', 'ตรวจสอบยอดบิล สถานะการชำระ และเปิดใบเสร็จย้อนหลัง')}
      <div class="summary-grid"><div class="summary-card"><span class="muted">บิลทั้งหมด</span><strong>${data.bills.length} <small>รายการ</small></strong></div><div class="summary-card"><span class="muted">ชำระแล้ว ${paid.length} รายการ</span><strong>${money(paid.reduce((sum, bill) => sum + bill.total, 0))} <small>บาท</small></strong></div><div class="summary-card"><span class="muted">รอชำระ ${unpaid.length} รายการ</span><strong>${money(unpaid.reduce((sum, bill) => sum + bill.total, 0))} <small>บาท</small></strong></div></div>
      <section class="panel stack"><div class="filter-row"><div role="group" aria-label="กรองสถานะบิล">${[['all', 'ทั้งหมด'], ['paid', 'ชำระแล้ว'], ['pending', 'รอชำระ']].map(([value, label]) => `<button type="button" class="filter-chip${value === filter ? ' active' : ''}" data-history-filter="${value}" aria-pressed="${value === filter}">${label}</button>`).join('')}</div><button type="button" class="button secondary" data-action="export-history">${icon('↓')} ดาวน์โหลด CSV</button></div>
      <div class="field"><label for="history-search">ค้นหาเดือนหรือเลขที่บิล</label><input id="history-search" type="search" value="${esc(state.historySearch || '')}" placeholder="เช่น สิงหาคม หรือ 202608" autocomplete="off"></div>
      <p class="muted" aria-live="polite">พบ ${items.length} รายการ</p>
      ${items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">ประจำเดือน</th><th scope="col">ยอดรวม</th><th scope="col">สถานะ</th><th scope="col">วันที่ชำระ</th><th scope="col">ใบเสร็จ</th></tr></thead><tbody>${items.map((bill) => `<tr><th scope="row">${esc(bill.label)}<small class="muted">${esc(bill.id)}</small></th><td>${money(bill.total)} บาท</td><td>${status(bill)}</td><td>${date(bill.paidDate)}</td><td>${bill.receiptId ? `<a class="button ghost" href="${receiptURL(bill.receiptId)}" aria-label="ดูใบเสร็จ ${esc(bill.label)}">ดูใบเสร็จ</a>` : '<span class="muted">ยังไม่ออกใบเสร็จ</span>'}</td></tr>`).join('')}</tbody></table></div>` : empty('🔎', 'ไม่พบรายการที่ค้นหา', 'ลองเปลี่ยนคำค้นหรือเลือกสถานะทั้งหมด')}
      <p class="muted">ไฟล์ CSV จะมีเฉพาะรายการที่ตรงกับตัวกรองและคำค้นปัจจุบัน</p></section>`;
  }

  function receipts(data, state = {}) {
    if (state.receiptId) return receiptDetail(data, state.receiptId);
    return `${heading('เอกสารของคุณ', 'ใบเสร็จรับเงิน', 'เปิดดูและพิมพ์ใบเสร็จของรายการที่เจ้าหน้าที่ยืนยันรับชำระแล้ว')}
      <div class="notice">${icon('ℹ️')} บิลเดือนกันยายนยังรอชำระ จึงยังไม่มีใบเสร็จของเดือนนี้</div>
      <div class="receipt-list">${data.receipts.map((receipt) => {
        const bill = data.bills.find((item) => item.id === receipt.billId);
        return `<article class="panel"><div class="panel-heading"><div><p class="eyebrow">${esc(receipt.id)}</p><h2 class="section-title">${icon('📄')} ${esc(bill ? bill.label : '')}</h2></div><span class="badge paid">รับชำระแล้ว</span></div><p class="amount">${money(receipt.amount)} <small>บาท</small></p><p class="muted">ชำระ${esc(receipt.method)} · ${date(receipt.date)}</p><a class="button secondary" href="${receiptURL(receipt.id)}">ดูรายละเอียดใบเสร็จ</a></article>`;
      }).join('')}</div>`;
  }

  function receiptDetail(data, id) {
    const receipt = data.receipts.find((item) => item.id === id);
    const bill = receipt && data.bills.find((item) => item.id === receipt.billId);
    if (!receipt || !bill) return `${heading('เอกสารของคุณ', 'ไม่พบใบเสร็จ', 'ตรวจสอบเลขที่ใบเสร็จ หรือกลับไปเลือกรายการอีกครั้ง')}<a class="button secondary" href="receipts.html">กลับไปหน้าใบเสร็จ</a>`;
    return `${heading('เอกสารของคุณ', 'รายละเอียดใบเสร็จ', 'รายการรับชำระประจำเดือน' + bill.label)}<div class="filter-row"><a class="button ghost" href="receipts.html">← ใบเสร็จทั้งหมด</a><button type="button" class="button primary" data-action="print-receipt">${icon('🖨️')} พิมพ์ / บันทึก PDF</button></div>
      <article class="receipt-paper"><header class="panel-heading"><div><p class="eyebrow">${esc(data.brand)}</p><h2 class="page-title">ใบเสร็จรับเงิน</h2><p class="muted">เอกสารตัวอย่างสำหรับต้นแบบ</p></div><span class="badge paid">รับชำระแล้ว</span></header><dl class="details-list"><div><dt>เลขที่ใบเสร็จ</dt><dd>${esc(receipt.id)}</dd></div><div><dt>วันที่รับเงิน</dt><dd>${date(receipt.date)}</dd></div><div><dt>รับเงินจาก</dt><dd>${esc(data.resident.name)}</dd></div><div><dt>ห้องพัก</dt><dd>${esc(data.resident.room)} · อาคาร ${esc(data.resident.building)}</dd></div><div><dt>ประจำเดือน</dt><dd>${esc(bill.label)}</dd></div><div><dt>เลขที่บิล</dt><dd>${esc(bill.id)}</dd></div></dl>${billLines(bill)}<div class="panel-heading"><strong>รวมรับชำระทั้งสิ้น</strong><p class="amount">${money(receipt.amount)} <small>บาท</small></p></div><p>วิธีชำระ: ${esc(receipt.method)}ที่${esc(data.office.name)}</p><p class="muted">ข้อมูลจำลอง ไม่ใช่หลักฐานการชำระเงินจริง</p></article>`;
  }

  function room(data) {
    const resident = data.resident;
    return `${heading('บ้านของคุณ', 'ข้อมูลห้องพัก', 'ตรวจสอบข้อมูลห้องและสถานะการผูกบัญชี LINE ของคุณ')}
      <div class="two-column"><section class="panel stack"><div class="panel-heading"><div><p class="eyebrow">${esc(data.brand)}</p><h2 class="page-title">${icon('🏠')} ห้อง ${esc(resident.room)}</h2></div><span class="badge paid">${esc(resident.occupancy)}</span></div><dl class="details-list"><div><dt>ผู้อยู่อาศัย</dt><dd>${esc(resident.name)}</dd></div><div><dt>อาคาร</dt><dd>${esc(resident.building)}</dd></div><div><dt>ชั้น</dt><dd>${esc(resident.floor)}</dd></div><div><dt>พื้นที่ห้อง</dt><dd>${money(resident.area)} ตารางเมตร</dd></div></dl></section>
      <section class="panel stack"><div class="panel-heading"><h2 class="section-title">${icon('💬')} บัญชี LINE</h2><span class="badge ${resident.lineLinked ? 'paid' : 'pending'}">${resident.lineLinked ? 'ผูกบัญชีแล้ว' : 'ยังไม่ผูกบัญชี'}</span></div><p>บัญชีนี้เชื่อมกับห้อง ${esc(resident.room)} เพื่อดูบิล ใบเสร็จ และประกาศสำหรับผู้อยู่อาศัย</p><dl class="details-list"><div><dt>วันที่ผูกบัญชี</dt><dd>${date(resident.linkedAt)}</dd></div><div><dt>บัญชีทางการ</dt><dd>${esc(data.brand)}</dd></div></dl><div class="notice"><strong>ต้องการแก้ไขข้อมูลห้อง?</strong><p>ให้เจ้าหน้าที่ตรวจสอบข้อมูลก่อนแก้ไขหรือเปลี่ยนห้องที่ผูกกับบัญชี</p><a class="button secondary" href="contact.html?topic=room">ติดต่อแก้ไขข้อมูล</a></div></section></div>`;
  }

  function announcements(data, state = {}) {
    const category = state.announcementCategory || 'all';
    const readIds = state.readAnnouncements || [];
    const items = data.announcements.filter((item) => category === 'all' || item.category === category);
    return `${heading('ข่าวสารจากนิติบุคคล', 'ประกาศคอนโด', 'ติดตามข่าวส่วนกลาง การดูแลอาคาร และกำหนดการสำคัญ')}
      <div class="filter-row" role="group" aria-label="กรองหมวดประกาศ">${[['all', 'ทั้งหมด'], ['maintenance', 'ซ่อมบำรุง'], ['payment', 'ค่าใช้จ่าย'], ['general', 'ทั่วไป']].map(([value, label]) => `<button type="button" class="filter-chip${value === category ? ' active' : ''}" data-announcement-category="${value}" aria-pressed="${value === category}">${label}</button>`).join('')}</div>
      <div class="announcement-grid">${items.map((item) => `<article class="panel announcement-card"><div class="panel-heading"><span class="badge neutral">${icon(item.icon)} ${esc(item.categoryLabel)}</span><span class="badge ${readIds.includes(item.id) ? 'neutral' : 'pending'}">${readIds.includes(item.id) ? 'อ่านแล้ว' : 'ยังไม่อ่าน'}</span></div><p class="muted">${date(item.date)}</p><h2 class="section-title">${esc(item.title)}</h2><p>${esc(item.summary)}</p><button type="button" class="button secondary" data-action="announcement" data-id="${esc(item.id)}" aria-label="อ่านประกาศ ${esc(item.title)}">อ่านรายละเอียด →</button></article>`).join('')}</div>`;
  }

  function announcementDetail(data, id) {
    const item = data.announcements.find((announcement) => announcement.id === id);
    if (!item) return '<h2 class="section-title">ไม่พบประกาศ</h2><p>กรุณาเลือกประกาศอีกครั้ง</p>';
    return `<div class="stack"><span class="badge neutral">${icon(item.icon)} ${esc(item.categoryLabel)}</span><h2 class="page-title" id="announcement-dialog-title">${esc(item.title)}</h2><p class="muted">ประกาศวันที่ ${date(item.date)}</p>${item.paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}${item.category === 'payment' ? '<a class="button primary" href="bills.html">ดูบิลประจำเดือน</a>' : ''}<a class="button secondary" href="contact.html?topic=other">ติดต่อสอบถาม</a></div>`;
  }

  function contact(data, state = {}) {
    const topic = state.contactTopic || 'bill';
    return `${heading('พร้อมช่วยดูแล', 'ติดต่อนิติบุคคล', 'ดูเวลาทำการและเตรียมคำถามก่อนติดต่อเจ้าหน้าที่')}
      <div class="two-column"><section class="panel contact-card stack"><h2 class="section-title">${icon('🏢')} ${esc(data.office.name)}</h2><p>${esc(data.brand)}</p><dl class="details-list"><div><dt>สถานที่</dt><dd>${esc(data.office.location)}</dd></div><div><dt>วันทำการ</dt><dd>${esc(data.office.days)}</dd></div><div><dt>เวลา</dt><dd>${esc(data.office.hours)}</dd></div><div><dt>การชำระเงิน</dt><dd>รับเงินสดที่สำนักงาน</dd></div></dl><div class="notice"><strong>เตรียมข้อมูลก่อนติดต่อ</strong><p>แจ้งห้อง ${esc(data.resident.room)} พร้อมเดือนของบิล หรือเลขที่ใบเสร็จที่ต้องการให้ตรวจสอบ</p></div><p class="muted">ต้นแบบนี้ยังไม่ได้ตั้งค่าหมายเลขโทรศัพท์หรือส่งข้อความถึงเจ้าหน้าที่</p></section>
      <section class="panel stack"><h2 class="section-title">${icon('✍️')} เตรียมคำถามของคุณ</h2><p class="muted">บันทึกคำถามตัวอย่างไว้ในเบราว์เซอร์นี้ เพื่อทดลองการใช้งาน ยังไม่มีการส่งถึงนิติบุคคล</p><form id="contact-form" class="stack"><div class="field"><label for="contact-topic">เรื่องที่ต้องการติดต่อ</label><select id="contact-topic" name="topic">${[['bill', 'สอบถามค่าใช้จ่าย / บิล'], ['receipt', 'สอบถามใบเสร็จ'], ['room', 'แก้ไขข้อมูลห้องพัก'], ['other', 'เรื่องอื่น ๆ']].map(([value, label]) => `<option value="${value}"${value === topic ? ' selected' : ''}>${label}</option>`).join('')}</select></div><div class="field"><label for="contact-message">รายละเอียดคำถาม</label><textarea id="contact-message" name="message" rows="6" required maxlength="1000" placeholder="เช่น ต้องการสอบถามเลขมิเตอร์น้ำของบิลเดือนกันยายน" aria-describedby="contact-message-help">${esc(state.contactMessage || '')}</textarea><small id="contact-message-help" class="muted">ไม่เกิน 1,000 ตัวอักษร · ไม่ต้องใส่ข้อมูลส่วนตัวที่อ่อนไหว</small></div><button type="submit" class="button primary">บันทึกคำถามตัวอย่าง</button><div id="contact-result" aria-live="polite" role="status"></div></form></section></div>`;
  }

  window.ResidentViews = { bills, history, receipts, receiptDetail, room, announcements, announcementDetail, contact };
}());
