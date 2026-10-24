const menuButton = document.querySelector('[data-toggle-nav]');
const sidebar = document.querySelector('#app-sidebar');
const mobileViewport = window.matchMedia('(max-width: 760px)');
function closeNavigation(restoreFocus = false) {
  document.body.classList.remove('nav-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) menuButton?.focus();
}
menuButton?.addEventListener('click', () => {
  const open = document.body.classList.toggle('nav-open');
  menuButton.setAttribute('aria-expanded', String(open));
  if (open) sidebar?.querySelector('a')?.focus();
});
document.querySelector('[data-close-nav]')?.addEventListener('click', () => closeNavigation(true));
document.addEventListener('keydown', (event) => {
  if (!document.body.classList.contains('nav-open')) return;
  if (event.key === 'Escape') closeNavigation(true);
  if (event.key === 'Tab' && mobileViewport.matches && sidebar) {
    const controls = [...sidebar.querySelectorAll('a, button:not([disabled])')];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
mobileViewport.addEventListener('change', () => {
  if (!mobileViewport.matches) closeNavigation();
});

function updateReadingButton(form) {
  if (!form?.matches('[data-reading-form]')) return;
  const fields = [...form.elements].filter((field) =>
    field.matches('[data-meter-input], [data-technician-input]'),
  );
  const button = form.querySelector('button[type="submit"]');
  if (button)
    button.disabled = fields.some((field) => field.value.trim() === '' || !field.validity.valid);
}

function updateMeterInput(input) {
  const previous = Number(input.dataset.previous);
  const invalid = input.value !== '' && Number(input.value) < previous;
  input.setCustomValidity(invalid ? 'เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าเดือนก่อน' : '');
  input.setAttribute('aria-invalid', String(invalid));
  const error = document.getElementById(input.getAttribute('aria-describedby'));
  if (error) error.hidden = !invalid;
  const units = document.querySelector(`[data-units-for="${input.id}"]`);
  if (units) {
    units.textContent =
      input.value !== '' && input.validity.valid
        ? `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(Number(input.value) - previous)} หน่วย`
        : '— หน่วย';
  }
  updateReadingButton(input.form);
}

document.querySelectorAll('[data-meter-input]').forEach((input) => {
  input.addEventListener('input', () => updateMeterInput(input));
  updateMeterInput(input);
});

document.querySelectorAll('[data-technician-input]').forEach((input) => {
  function validateTechnician(showError = false) {
    const length = input.value.trim().length;
    const invalid = length < 2 || length > 100;
    input.setCustomValidity(invalid ? 'กรุณากรอกชื่อช่าง 2–100 ตัวอักษร' : '');
    input.setAttribute('aria-invalid', String(showError && invalid));
    const error = document.getElementById(input.dataset.errorId);
    if (error) error.hidden = !showError || !invalid;
    updateReadingButton(input.form);
  }
  input.addEventListener('input', () => validateTechnician(input.value !== ''));
  input.addEventListener('blur', () => validateTechnician(true));
  validateTechnician(input.value !== '');
});

document.querySelectorAll('[data-reading-form]').forEach((form) => {
  form.addEventListener('submit', () => {
    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = 'กำลังบันทึก…';
    }
  });
});

const meterExample = document.querySelector('[data-meter-example]');
if (meterExample && window.matchMedia('(max-width: 1280px)').matches) meterExample.open = false;

window.addEventListener('pageshow', () => {
  document.querySelectorAll('[data-reading-form]').forEach((form) => {
    const button = form.querySelector('button[type="submit"]');
    if (button) button.textContent = 'บันทึก';
    updateReadingButton(form);
  });
});
