document.querySelectorAll('[data-line-link-form]').forEach((form) => {
  const button = form.querySelector('button[type="submit"]');
  const result = form.querySelector('[data-line-link-result]');
  const codeOutput = form.querySelector('[data-line-link-code]');
  const errorOutput = form.querySelector('[data-line-link-error]');
  let busy = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const csrfToken = form.querySelector('input[name="_csrf"]')?.value;
    errorOutput.hidden = true;
    errorOutput.textContent = '';
    result.hidden = true;
    codeOutput.textContent = '';
    if (!csrfToken) {
      errorOutput.textContent = 'ไม่พบข้อมูลยืนยันคำขอ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง';
      errorOutput.hidden = false;
      return;
    }

    busy = true;
    button.disabled = true;
    button.textContent = 'กำลังสร้างรหัส…';
    button.setAttribute('aria-busy', 'true');
    form.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'x-csrf-token': csrfToken },
      });
      if (response.redirected || response.status === 401) {
        throw new Error('กรุณาเข้าสู่ระบบใหม่ แล้วกลับมาสร้างรหัสผูก LINE');
      }
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error('ยังยืนยันการสร้างรหัสไม่ได้ กรุณาลองอีกครั้งเพื่อสร้างรหัสใหม่'); }
      if (!response.ok) {
        const message = typeof payload?.error?.message === 'string' ? payload.error.message : response.status === 403 ? 'คำขอหมดอายุหรือไม่มีสิทธิ์ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง' : 'สร้างรหัสไม่สำเร็จ กรุณาลองอีกครั้ง';
        throw new Error(message);
      }
      const code = payload?.data?.code;
      if (typeof code !== 'string' || !/^[A-F0-9]{6}$/.test(code)) {
        throw new Error('รูปแบบรหัสที่ได้รับไม่ถูกต้อง กรุณาลองอีกครั้งเพื่อสร้างรหัสใหม่');
      }
      codeOutput.textContent = code;
      result.hidden = false;
      button.textContent = 'สร้างรหัสใหม่';
    } catch (error) {
      errorOutput.textContent = error instanceof TypeError ? 'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้งเพื่อสร้างรหัสใหม่' : error.message;
      errorOutput.hidden = false;
      button.textContent = 'สร้างรหัสผูก LINE';
    } finally {
      busy = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      form.removeAttribute('aria-busy');
    }
  });
});
