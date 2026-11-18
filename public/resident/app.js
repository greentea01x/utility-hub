(function () {
  'use strict';

  const app = document.getElementById('app');
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const present = value => value !== null && value !== undefined && value !== '';
  const money = value => present(value) && Number.isFinite(Number(value)) ? Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—';
  const date = value => {
    if (!value) return '—';
    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T12:00:00Z` : value);
    return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(parsed);
  };
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    bill: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 7h6M9 11h6M9 15h3"/>',
    history: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M7 17h3M14 14h3"/>',
    receipt: '<path d="M5 3h10l4 4v14H5Z"/><path d="M14 3v5h5M8 12h8M8 16h5"/>',
    room: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-6h4v6"/>',
    news: '<path d="m3 10 14-5v14L3 14Z"/><path d="m6 15 2 6h3l-2-5M21 8v8"/>',
    contact: '<path d="M4 13v-1a8 8 0 0 1 16 0v1M4 12H3v6h4v-6Zm16 0h1v6h-4v-6ZM20 18c0 3-4 3-7 3"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    water: '<path d="M12 3c-2 4-7 8-7 12a7 7 0 0 0 14 0c0-4-5-8-7-12Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
    electric: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
    phone: '<path d="m5 3 4 1 1 5-3 2a14 14 0 0 0 6 6l2-3 5 1 1 4c-1 3-7 3-12-2S2 4 5 3Z"/>'
  };
  const icon = name => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.room}</svg>`;
  const menu = [
    { id: 'bills', icon: 'bill', label: 'ดูบิลเดือนนี้', description: 'ยอดและกำหนดชำระ', color: 'mint' },
    { id: 'history', icon: 'history', label: 'ประวัติชำระเงิน', description: 'ตรวจสอบย้อนหลัง', color: 'blue' },
    { id: 'receipts', icon: 'receipt', label: 'ใบเสร็จรับเงิน', description: 'ดูและบันทึกเอกสาร', color: 'cream' },
    { id: 'room', icon: 'room', label: 'ข้อมูลห้องพัก', description: 'ข้อมูลบ้านของคุณ', color: 'lavender' },
    { id: 'announcements', icon: 'news', label: 'ข่าวสารคอนโด', description: 'ไม่พลาดเรื่องสำคัญ', color: 'peach' },
    { id: 'contact', icon: 'contact', label: 'ติดต่อนิติบุคคล', description: 'ให้เราช่วยดูแลคุณ', color: 'sage' }
  ];
  const nav = [{ id: 'home', icon: 'home', label: 'หน้าหลัก' }, ...menu];
  const href = (page = 'home', id) => `/resident/${page === 'home' ? '' : `?page=${encodeURIComponent(page)}${id ? `&id=${encodeURIComponent(id)}` : ''}`}`;
  let data = null;
  let starting = false;
  let state = { page: 'home', id: null, billId: null, filter: 'all', search: '', category: 'all' };
  const readNews = new Set();

  function routeFromLocation() {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    state.page = nav.some(item => item.id === page) ? page : 'home';
    state.id = ['receipts', 'announcements'].includes(state.page) ? params.get('id') : null;
  }

  function accessScreen(title, description, options = {}) {
    data = null;
    document.title = `${title} · Condo one`;
    document.body.dataset.page = 'access';
    app.innerHTML = `<main class="access-screen"><img class="access-logo" src="/images/condo-one-logo.svg" alt="Condo one"><p class="eyebrow">RESIDENT SERVICES</p><h1>${esc(title)}</h1><p role="${options.loading ? 'status' : 'alert'}">${esc(description)}</p>${options.linkedInstructions ? '<ol><li>ติดต่อสำนักงานนิติบุคคลเพื่อรับรหัสผูกบัญชีแบบใช้ครั้งเดียว</li><li>ส่งรหัสนั้นในแชต LINE Official Account ของคอนโด</li><li>หลังส่งรหัสแล้ว กลับมากด “ตรวจสอบอีกครั้ง”</li></ol>' : ''}${options.office ? '<div class="access-note"><strong>สำนักงานนิติบุคคล Condo one</strong><span>เจ้าหน้าที่นิติบุคคล</span><a href="tel:0812345678">081-234-5678</a></div>' : ''}${options.retry ? `<button class="button primary" type="button" data-action="retry">${options.linkedInstructions ? 'ตรวจสอบอีกครั้ง' : 'ลองอีกครั้ง'}</button>` : ''}</main>`;
  }

  async function request(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
    let body = {};
    try { body = await response.json(); } catch { /* The status remains authoritative if the server is unavailable. */ }
    if (!response.ok) {
      const error = new Error('Resident request failed');
      error.status = response.status;
      error.code = body.error?.code || body.code;
      throw error;
    }
    return body;
  }

  function unlinked() {
    accessScreen('เชื่อม LINE กับห้องพักของคุณ', 'บัญชี LINE นี้ยังไม่ได้ผูกกับข้อมูลห้องพัก จึงยังเปิดดูบิลและข้อมูลส่วนตัวไม่ได้', { linkedInstructions: true, retry: true, office: true });
  }

  async function start() {
    if (starting) return;
    starting = true;
    accessScreen('กำลังเปิดบริการลูกบ้าน', 'กำลังตรวจสอบบัญชี LINE ของคุณ', { loading: true });
    try {
      const config = await request('/api/resident/config');
      if (!config.enabled || !config.liffId) {
        accessScreen('บริการ LINE ยังไม่พร้อมใช้งาน', 'สำนักงานยังตั้งค่าการเชื่อมต่อไม่ครบ กรุณาติดต่อสำนักงานนิติบุคคลเพื่อตรวจสอบการเปิดบริการ', { retry: true, office: true });
        return;
      }
      if (!window.liff) throw new Error('LIFF_SDK_UNAVAILABLE');
      await window.liff.init({ liffId: config.liffId });
      // LIFF resolves liff.state and its redirect before the application reads navigation parameters.
      routeFromLocation();
      if (!window.liff.isLoggedIn()) {
        window.liff.login({ redirectUri: new URL(href(state.page, state.id), window.location.origin).href });
        return;
      }
      const idToken = window.liff.getIDToken();
      if (!idToken) {
        accessScreen('ยังยืนยันบัญชี LINE ไม่สำเร็จ', 'กรุณาให้สำนักงานตรวจสอบสิทธิ์ openid ของแอป LINE แล้วเปิดเมนูนี้อีกครั้ง', { retry: true, office: true });
        return;
      }
      const session = await request('/api/resident/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': config.csrfToken || '' },
        body: JSON.stringify({ idToken })
      });
      if (!session.linked) { unlinked(); return; }
      const incoming = await request('/api/resident/data');
      data = {
        ...incoming,
        brand: incoming.brand || 'Condo one',
        resident: incoming.resident || {},
        office: incoming.office || {},
        rates: incoming.rates || {},
        commonIncludedServices: Array.isArray(incoming.commonIncludedServices) ? incoming.commonIncludedServices : [],
        bills: Array.isArray(incoming.bills) ? incoming.bills : [],
        receipts: Array.isArray(incoming.receipts) ? incoming.receipts : [],
        announcements: Array.isArray(incoming.announcements) ? incoming.announcements : []
      };
      state.billId = data.bills[0]?.id || null;
      render();
    } catch (error) {
      if (error.status === 403 && error.code === 'NOT_LINKED') unlinked();
      else if (error.status === 401) accessScreen('กรุณาเปิดเมนูจาก LINE อีกครั้ง', 'การยืนยันตัวตนหมดอายุหรือไม่สำเร็จ กรุณาปิดหน้านี้และเปิดใหม่จากเมนูบริการลูกบ้าน', { retry: true, office: true });
      else if (error.status === 503) accessScreen('บริการยังไม่พร้อมใช้งาน', 'ระบบกำลังรอการตั้งค่าหรือไม่สามารถเชื่อมข้อมูลได้ กรุณาลองอีกครั้งหรือติดต่อสำนักงาน', { retry: true, office: true });
      else accessScreen('เปิดบริการลูกบ้านไม่สำเร็จ', 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองเปิดใหม่อีกครั้ง หากยังใช้งานไม่ได้ โปรดติดต่อสำนักงาน', { retry: true, office: true });
    } finally { starting = false; }
  }

  const heading = (eyebrow, title, description) => `<header class="page-heading"><p class="eyebrow">${esc(eyebrow)}</p><h1 class="page-title">${esc(title)}</h1><p class="page-description">${esc(description)}</p></header>`;
  const empty = (symbol, title, description) => `<section class="empty-state">${icon(symbol)}<h2>${esc(title)}</h2><p>${esc(description)}</p></section>`;
  const label = bill => bill.label || bill.period || 'รายการบิล';
  const status = bill => {
    const statuses = { paid: ['paid', 'ชำระแล้ว'], pending: ['pending', 'รอชำระ'], unpaid: ['pending', 'รอชำระ'], overdue: ['pending', 'เกินกำหนดชำระ'], cancelled: ['neutral', 'ยกเลิก'], canceled: ['neutral', 'ยกเลิก'] };
    const item = statuses[bill.status] || ['neutral', 'ตรวจสอบสถานะ'];
    return `<span class="badge ${item[0]}">${item[1]}</span>`;
  };
  const details = rows => `<dl class="details-list">${rows.map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(present(value) ? value : 'ยังไม่มีข้อมูล')}</dd></div>`).join('')}</dl>`;
  const commonPeriod = () => data.rates.commonPeriod === 'year' ? 'ปี' : data.rates.commonPeriod === 'month' ? 'เดือน' : 'รอบเรียกเก็บ';
  function billLines(bill) {
    const water = bill.water || {}, electricity = bill.electricity || {}, common = bill.common || {};
    return `<div class="bill-lines"><div><span>${icon('water')} ค่าน้ำ<small class="muted">${money(water.units)} หน่วย × ${money(water.rate)} บาท</small></span><strong>${money(water.amount)} บาท</strong></div><div><span>${icon('electric')} ค่าไฟฟ้า<small class="muted">${money(electricity.units)} หน่วย × ${money(electricity.rate)} บาท</small></span><strong>${money(electricity.amount)} บาท</strong></div><div><span>${icon('room')} ค่าส่วนกลาง<small class="muted">${money(common.area)} ตร.ม. × ${money(common.rate)} บาท/ตร.ม./${commonPeriod()}</small></span><strong>${money(common.amount)} บาท</strong></div></div>`;
  }

  function home() {
    const bill = data.bills[0];
    const news = data.announcements[0];
    return `<section class="live-home-intro"><span class="live-badge">เชื่อมต่อบัญชี LINE แล้ว</span><h1>เรื่องในคอนโด<br>ดูแลได้จากที่นี่</h1><p>บริการสำหรับห้อง ${esc(data.resident.room || 'ของคุณ')}</p>${bill ? `<div class="live-links"><div><p class="amount">${money(bill.total)} <small>บาท</small></p><small>${esc(label(bill))} · ${bill.status === 'paid' ? 'ชำระแล้ว' : 'ดูรายละเอียดสถานะและกำหนดชำระ'}</small></div><a class="button primary" data-page="bills" href="${href('bills')}">ดูรายละเอียดบิล ${icon('arrow')}</a></div>` : '<p class="live-session-note">ยังไม่มีบิลในระบบสำหรับห้องของคุณ</p>'}</section><section aria-labelledby="menu-title"><div class="section-heading"><h2 id="menu-title">บริการลูกบ้าน</h2><span>เลือกเมนูที่ต้องการ</span></div><div class="menu-grid">${menu.map(item => `<a class="menu-card ${item.color}" href="${href(item.id)}" data-page="${item.id}"><span class="menu-arrow">${icon('arrow')}</span><span class="menu-icon">${icon(item.icon)}</span><strong>${item.label}</strong><small>${item.description}</small></a>`).join('')}</div></section>${news ? `<section class="panel live-home-news"><p class="eyebrow">ข่าวสารล่าสุด</p><h2>${esc(news.title)}</h2><p class="muted">${esc(news.summary)}</p><a class="button secondary" href="${href('announcements', news.id)}" data-page="announcements" data-id="${esc(news.id)}">อ่านประกาศ ${icon('arrow')}</a></section>` : ''}`;
  }

  function bills() {
    const title = heading('ค่าใช้จ่ายของคุณ', 'บิลของฉัน', `ดูยอดค่าใช้จ่ายและรายละเอียดมิเตอร์ของห้อง ${data.resident.room || 'ของคุณ'}`) + (data.historyNotice ? `<p class="notice">${esc(data.historyNotice)}</p>` : '');
    if (!data.bills.length) return title + empty('bill', 'ยังไม่มีบิล', 'เมื่อสำนักงานออกบิลแล้ว รายการและกำหนดชำระจะแสดงที่นี่');
    const bill = data.bills.find(item => String(item.id) === String(state.billId)) || data.bills[0];
    const meters = [['ค่าน้ำ', bill.water || {}], ['ค่าไฟฟ้า', bill.electricity || {}]];
    return `${title}<div class="filter-row"><div class="field"><label for="bill-period">เลือกรอบบิล</label><select id="bill-period">${data.bills.map(item => `<option value="${esc(item.id)}"${item.id === bill.id ? ' selected' : ''}>${esc(label(item))}</option>`).join('')}</select></div></div><div class="two-column"><section class="panel bill-overview"><div class="panel-heading"><p class="eyebrow">${esc(label(bill))}</p>${status(bill)}</div><p class="amount">${money(bill.total)} <small>บาท</small></p><p class="muted">${bill.status === 'paid' ? `ชำระเมื่อ ${date(bill.paidDate)}` : `กำหนดชำระ ${date(bill.dueDate)}`}</p>${billLines(bill)}${bill.receiptId ? `<a class="button primary" href="${href('receipts', bill.receiptId)}" data-page="receipts" data-id="${esc(bill.receiptId)}">ดูใบเสร็จรับเงิน ${icon('arrow')}</a>` : `<a class="button primary" href="${href('contact')}" data-page="contact">สอบถามวิธีชำระเงิน ${icon('arrow')}</a>`}${data.commonIncludedServices.length ? `<div class="notice common-services"><strong>ค่าส่วนกลางรวมบริการแล้ว</strong><p>${data.commonIncludedServices.map(esc).join(' · ')}</p></div>` : ''}</section><div><section class="panel"><h2 class="section-title">รายละเอียดมิเตอร์</h2><table class="meter-table"><thead><tr><th scope="col">รายการ</th><th scope="col">ครั้งก่อน</th><th scope="col">ครั้งนี้</th><th scope="col">ใช้ไป</th></tr></thead><tbody>${meters.map(([name, meter]) => `<tr><th scope="row">${name}</th><td>${money(meter.previous)}</td><td>${money(meter.current)}</td><td>${money(meter.units)}</td></tr>`).join('')}</tbody></table>${details([['เลขที่บิล', bill.id], ['วันที่ออกบิล', date(bill.issueDate)]])}</section><section class="panel"><h2 class="section-title">การชำระเงิน</h2><p>${esc(data.office.paymentMethod || 'ติดต่อสำนักงานนิติบุคคลเพื่อสอบถามช่องทางชำระเงิน')}</p><p class="muted">สถานะการชำระและใบเสร็จจะอัปเดตหลังสำนักงานบันทึกการรับเงิน</p></section></div></div>`;
  }

  function filteredBills() {
    const query = state.search.trim().toLocaleLowerCase('th-TH');
    return data.bills.filter(bill => (state.filter === 'all' || (state.filter === 'paid' ? bill.status === 'paid' : ['pending', 'unpaid', 'overdue'].includes(bill.status))) && `${label(bill)} ${bill.period || ''} ${bill.id}`.toLocaleLowerCase('th-TH').includes(query));
  }

  function historyResults() {
    const items = filteredBills();
    return `<p class="muted" aria-live="polite">พบ ${items.length} รายการ</p>${items.length ? `<div class="history-list">${items.map(bill => `<article class="history-item"><div class="panel-heading"><div><h2>${esc(label(bill))}</h2><p class="bill-id">${esc(bill.id)}</p></div>${status(bill)}</div><p class="amount">${money(bill.total)} <small>บาท</small></p><p>${bill.status === 'paid' ? `วันที่ชำระ ${date(bill.paidDate)}` : `กำหนดชำระ ${date(bill.dueDate)}`}</p>${bill.receiptId ? `<a class="button secondary" href="${href('receipts', bill.receiptId)}" data-page="receipts" data-id="${esc(bill.receiptId)}">ดูใบเสร็จ ${icon('arrow')}</a>` : '<p class="muted">ยังไม่มีใบเสร็จของรายการนี้</p>'}</article>`).join('')}</div>` : empty('history', 'ไม่พบรายการ', data.bills.length ? 'ลองเปลี่ยนคำค้นหรือเลือกสถานะทั้งหมด' : 'ประวัติการชำระจะแสดงเมื่อมีการออกบิลและบันทึกข้อมูลในระบบ')}`;
  }

  function historyView() {
    return `${heading('ย้อนหลังทุกการชำระ', 'ประวัติชำระเงิน', 'ตรวจสอบยอด สถานะ และใบเสร็จของห้องคุณ')}${data.historyNotice ? `<p class="notice">${esc(data.historyNotice)}</p>` : ''}<section class="panel"><div class="filter-row" role="group" aria-label="กรองสถานะการชำระ">${[['all', 'ทั้งหมด'], ['paid', 'ชำระแล้ว'], ['pending', 'รอชำระ']].map(([value, text]) => `<button class="filter-chip${state.filter === value ? ' active' : ''}" type="button" data-filter="${value}" aria-pressed="${state.filter === value}">${text}</button>`).join('')}</div><div class="field"><label for="history-search">ค้นหาเดือนหรือเลขที่บิล</label><input id="history-search" type="search" value="${esc(state.search)}" placeholder="เดือน ปี หรือเลขที่บิล" autocomplete="off"></div></section><div id="history-results">${historyResults()}</div>`;
  }

  function receipts() {
    if (state.id) return receiptDetail();
    const title = heading('เอกสารของคุณ', 'ใบเสร็จรับเงิน', 'เปิดดูสำเนาใบเสร็จที่สำนักงานออกให้แล้ว');
    if (!data.receipts.length) return title + empty('receipt', 'ยังไม่มีใบเสร็จ', 'ใบเสร็จจะแสดงหลังสำนักงานบันทึกการรับชำระและออกเอกสาร');
    return `${title}<div class="receipt-list">${data.receipts.map(receipt => {
      const bill = data.bills.find(item => String(item.id) === String(receipt.billId));
      return `<article class="panel"><div class="panel-heading"><div><p class="eyebrow">${esc(receipt.id)}</p><h2 class="section-title">${esc(bill ? label(bill) : 'ใบเสร็จรับเงิน')}</h2></div><span class="badge paid">ชำระแล้ว</span></div><p class="amount">${money(receipt.amount)} <small>บาท</small></p><p class="muted">${date(receipt.date)}${receipt.method ? ` · ${esc(receipt.method)}` : ''}</p><a class="button secondary" href="${href('receipts', receipt.id)}" data-page="receipts" data-id="${esc(receipt.id)}">เปิดใบเสร็จ ${icon('arrow')}</a></article>`;
    }).join('')}</div>`;
  }

  function receiptDetail() {
    const receipt = data.receipts.find(item => String(item.id) === String(state.id));
    if (!receipt) return heading('เอกสารของคุณ', 'ไม่พบใบเสร็จ', 'ตรวจสอบรายการใบเสร็จของห้องคุณอีกครั้ง') + `<a class="button secondary" href="${href('receipts')}" data-page="receipts">กลับไปหน้าใบเสร็จ</a>`;
    const bill = data.bills.find(item => String(item.id) === String(receipt.billId));
    return `${heading('เอกสารของคุณ', 'รายละเอียดใบเสร็จ', 'สำเนารายการรับชำระจากระบบสำนักงาน')}<div class="filter-row no-print"><a class="button ghost" href="${href('receipts')}" data-page="receipts">← ใบเสร็จทั้งหมด</a><button type="button" class="button primary" data-action="print">พิมพ์ / บันทึก PDF</button></div><p class="live-session-note no-print">หากเบราว์เซอร์ใน LINE ไม่รองรับการพิมพ์ ให้เปิดหน้านี้ในเบราว์เซอร์ภายนอกแล้วเข้าสู่ระบบด้วยบัญชี LINE เดิม</p><article class="receipt-paper"><header class="panel-heading"><div><p class="eyebrow">${esc(data.office.name || data.brand)}</p><h2 class="page-title">ใบเสร็จรับเงิน</h2></div><span class="badge paid">ชำระแล้ว</span></header><p class="receipt-copy-note">สำเนาใบเสร็จจากระบบ</p>${details([['เลขที่ใบเสร็จ', receipt.id], ['วันที่รับเงิน', date(receipt.date)], ['รับเงินจาก', receipt.payerName || data.resident.name], ['ห้องพัก', data.resident.room], ['ประจำเดือน', bill ? label(bill) : null], ['เลขที่บิล', receipt.billId]])}${bill ? billLines(bill) : '<p class="notice">ไม่พบรายละเอียดรายการบิลที่เกี่ยวข้อง กรุณาสอบถามสำนักงานนิติบุคคล</p>'}<div class="panel-heading"><strong>รวมรับชำระ</strong><p class="amount">${money(receipt.amount)} <small>บาท</small></p></div><p>วิธีชำระ: ${esc(receipt.method || 'ยังไม่มีข้อมูล')}</p><p class="muted">หากต้องการเอกสารต้นฉบับหรือพบข้อมูลไม่ตรง กรุณาติดต่อสำนักงานนิติบุคคล</p></article>`;
  }

  function room() {
    return `${heading('บ้านของคุณ', 'ข้อมูลห้องพัก', 'ข้อมูลห้องที่เชื่อมกับบัญชี LINE นี้')}<section class="panel"><div class="panel-heading"><h2 class="section-title">${icon('room')} ห้อง ${esc(data.resident.room || 'ยังไม่มีข้อมูล')}</h2><span class="badge paid">ผูกบัญชีแล้ว</span></div>${details([['ผู้พักอาศัย', data.resident.name], ['อาคาร', data.resident.building], ['ชั้น', data.resident.floor], ['พื้นที่ห้อง', present(data.resident.area) ? `${money(data.resident.area)} ตร.ม.` : null], ['สถานะการพักอาศัย', data.resident.occupancy], ['วันที่ผูกบัญชี LINE', data.resident.linkedAt ? date(data.resident.linkedAt) : null]])}</section><section class="panel"><h2 class="section-title">อัตราค่าบริการ</h2><div class="live-rates"><div><span>ค่าน้ำ</span><strong>${money(data.rates.water)}</strong><small>บาท / หน่วย</small></div><div><span>ค่าไฟฟ้า</span><strong>${money(data.rates.electricity)}</strong><small>บาท / หน่วย</small></div><div><span>ค่าส่วนกลาง</span><strong>${money(data.rates.common)}</strong><small>บาท / ตร.ม. / ${commonPeriod()}</small></div></div>${data.commonIncludedServices.length ? `<p class="muted">บริการที่รวมในค่าส่วนกลาง</p><div class="services-list">${data.commonIncludedServices.map(item => `<span>${esc(item)}</span>`).join('')}</div>` : ''}<p class="live-session-note">รายละเอียดการเรียกเก็บแต่ละรอบให้ตรวจสอบจากบิลของรอบนั้น</p></section><section class="panel"><h2 class="section-title">ต้องการแก้ไขข้อมูล?</h2><p class="muted">ติดต่อสำนักงานนิติบุคคลเพื่อให้เจ้าหน้าที่ตรวจสอบข้อมูลและปรับปรุงอย่างถูกต้อง</p><a class="button secondary" href="${href('contact')}" data-page="contact">ติดต่อสำนักงาน ${icon('arrow')}</a></section>`;
  }

  function announcements() {
    if (state.id) {
      const news = data.announcements.find(item => String(item.id) === String(state.id));
      if (!news) return heading('ข่าวสารคอนโด', 'ไม่พบประกาศ', 'ประกาศนี้อาจไม่ได้เปิดแสดงแล้ว') + `<a class="button secondary" href="${href('announcements')}" data-page="announcements">กลับไปดูข่าวสารทั้งหมด</a>`;
      const paragraphs = Array.isArray(news.paragraphs) ? news.paragraphs : [news.body || news.content || news.summary || ''];
      return `${heading(news.categoryLabel || 'ข่าวสารจากสำนักงาน', news.title, date(news.date))}<a class="button ghost news-back" href="${href('announcements')}" data-page="announcements">← ข่าวสารทั้งหมด</a><article class="panel">${paragraphs.map(paragraph => `<p class="announcement-full">${esc(paragraph)}</p>`).join('')}<button type="button" class="button secondary" data-action="read-news"${readNews.has(String(news.id)) ? ' disabled' : ''}>${readNews.has(String(news.id)) ? 'อ่านแล้ว' : 'ทำเครื่องหมายว่าอ่านแล้ว'}</button><p class="live-session-note">สถานะอ่านแล้วแสดงเฉพาะระหว่างการเปิดใช้งานครั้งนี้</p></article>`;
    }
    const title = heading('ข่าวสารจากสำนักงาน', 'ข่าวสารคอนโด', 'ประกาศและเรื่องสำคัญสำหรับผู้พักอาศัย');
    if (!data.announcements.length) return title + empty('news', 'ยังไม่มีข่าวสาร', 'ประกาศจากสำนักงานนิติบุคคลจะแสดงที่นี่เมื่อมีการเผยแพร่');
    const categories = [...new Map(data.announcements.filter(item => item.category).map(item => [item.category, item.categoryLabel || item.category])).entries()];
    const items = data.announcements.filter(item => state.category === 'all' || item.category === state.category);
    return `${title}<div class="filter-row" role="group" aria-label="หมวดข่าวสาร">${[['all', 'ทั้งหมด'], ...categories].map(([value, text]) => `<button type="button" class="filter-chip${value === state.category ? ' active' : ''}" data-category="${esc(value)}" aria-pressed="${value === state.category}">${esc(text)}</button>`).join('')}</div><div class="announcement-grid">${items.map(news => `<article class="panel announcement-card"><div class="panel-heading"><span class="badge neutral">${esc(news.categoryLabel || 'ประกาศ')}</span><span class="muted">${readNews.has(String(news.id)) ? 'อ่านแล้ว' : ''}</span></div><p class="muted">${date(news.date)}</p><h2 class="section-title">${esc(news.title)}</h2><p>${esc(news.summary)}</p><a class="button secondary" href="${href('announcements', news.id)}" data-page="announcements" data-id="${esc(news.id)}">อ่านรายละเอียด ${icon('arrow')}</a></article>`).join('')}</div>`;
  }

  function contact() {
    const office = data.office;
    const phone = office.phone ? String(office.phone).replace(/[^0-9+]/g, '') : '';
    return `${heading('ให้เราช่วยดูแลคุณ', 'ติดต่อนิติบุคคล', 'สอบถามบิล ใบเสร็จ และข้อมูลห้องพัก')}<div class="two-column"><section class="panel office-profile"><p class="eyebrow">RESIDENT CARE</p><h2 class="office-title-live">${esc(office.name || `สำนักงานนิติบุคคล ${data.brand}`)}</h2>${phone ? `<a class="live-phone" href="tel:${esc(phone)}">${esc(office.phone)}</a>` : '<p class="notice">สำนักงานยังไม่ได้ระบุเบอร์โทรศัพท์</p>'}<div class="office-role"><p class="eyebrow">ผู้ติดต่อ</p><h3>${esc(office.contactName || 'เจ้าหน้าที่นิติบุคคล')}</h3>${office.contactNameStatus ? `<p class="muted">${esc(office.contactNameStatus)}</p>` : ''}</div>${phone ? `<a class="button primary" href="tel:${esc(phone)}">${icon('phone')} โทรติดต่อสำนักงาน</a>` : ''}</section><section class="panel"><h2 class="section-title">ข้อมูลสำนักงาน</h2>${details([['ที่ตั้งสำนักงาน', office.location], ['วันทำการ', office.days], ['เวลาทำการ', office.hours]])}<p class="notice">กรุณาแจ้งเลขห้อง ${esc(data.resident.room || 'ของคุณ')} และเลขที่บิลหรือใบเสร็จที่ต้องการสอบถาม เพื่อให้เจ้าหน้าที่ตรวจสอบได้สะดวก</p></section></div>`;
  }

  function render(focus = false) {
    if (!data) return;
    document.body.dataset.page = state.page;
    const current = nav.find(item => item.id === state.page) || nav[0];
    document.title = `${current.label} · ${data.brand}`;
    const views = { home, bills, history: historyView, receipts, room, announcements, contact };
    app.innerHTML = `<a href="#page-content" class="skip-link">ข้ามไปยังเนื้อหา</a><header class="topbar"><a class="brand-link" href="${href()}" data-page="home"><img class="brand-logo" src="/images/condo-one-logo.svg" alt=""><span><span class="brand-name">${esc(data.brand)}</span><span class="brand-subtitle">RESIDENT SERVICES</span></span></a><span class="room-pill">${icon('room')} ห้อง ${esc(data.resident.room || 'ของคุณ')}</span></header><div class="app-layout"><aside class="sidebar"><p class="nav-label">บ้านของคุณ ดูแลง่ายขึ้น</p><nav class="side-nav" aria-label="เมนูบริการลูกบ้าน">${nav.map(item => `<a class="nav-link${state.page === item.id ? ' active' : ''}" href="${href(item.id)}" data-page="${item.id}"${state.page === item.id ? ' aria-current="page"' : ''}>${icon(item.icon)}${item.label}</a>`).join('')}</nav><div class="sidebar-help">${icon('contact')}<strong>มีเรื่องให้เราช่วยดูแล?</strong><a href="${href('contact')}" data-page="contact">ติดต่อสำนักงาน ${icon('arrow')}</a></div></aside><main id="page-content" class="content" tabindex="-1">${views[state.page]()}<footer class="live-footer"><span class="live-badge">ข้อมูลจากระบบสำนักงาน · เฉพาะห้องที่ผูกบัญชี</span><button type="button" class="session-refresh" data-action="retry">โหลดข้อมูลล่าสุด</button></footer></main></div><nav class="mobile-nav" aria-label="เมนูหลักบนมือถือ">${[nav[0], menu[0], menu[4], menu[5]].map(item => `<a href="${href(item.id)}" data-page="${item.id}" class="${state.page === item.id ? 'active' : ''}"${state.page === item.id ? ' aria-current="page"' : ''}>${icon(item.icon)}<span>${({ home: 'หน้าหลัก', bills: 'บิลของฉัน', announcements: 'ข่าวสาร', contact: 'ติดต่อ' })[item.id]}</span></a>`).join('')}</nav>`;
    if (focus) document.getElementById('page-content').focus({ preventScroll: true });
  }

  app.addEventListener('click', event => {
    const target = event.target.closest('a[data-page],button[data-action],button[data-filter],button[data-category]');
    if (!target) return;
    if (target.dataset.page && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      state.page = target.dataset.page;
      state.id = target.dataset.id || null;
      window.history.pushState(null, '', href(state.page, state.id));
      render(true);
      window.scrollTo(0, 0);
    } else if (target.dataset.action === 'retry') start();
    else if (target.dataset.action === 'print') window.print();
    else if (target.dataset.action === 'read-news') { readNews.add(String(state.id)); render(true); }
    else if (target.dataset.filter) { state.filter = target.dataset.filter; render(); }
    else if (target.dataset.category) { state.category = target.dataset.category; render(); }
  });
  app.addEventListener('change', event => {
    if (event.target.id === 'bill-period') { state.billId = event.target.value; render(); }
  });
  app.addEventListener('input', event => {
    if (event.target.id === 'history-search') {
      state.search = event.target.value;
      document.getElementById('history-results').innerHTML = historyResults();
    }
  });
  window.addEventListener('popstate', () => { routeFromLocation(); render(true); });
  start();
})();
