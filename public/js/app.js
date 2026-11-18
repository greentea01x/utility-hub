const menuButtons = [...document.querySelectorAll('[data-toggle-nav]')];
const sidebar = document.querySelector('#app-sidebar');
const workspace = document.querySelector('.workspace');
const bottomNavigation = document.querySelector('.mobile-bottom-nav');
const mobileViewport = window.matchMedia('(max-width: 760px)');
let navigationOpener;

function setNavigationState(open) {
  const isOpen = open && mobileViewport.matches && Boolean(sidebar);
  document.body.classList.toggle('nav-open', isOpen);
  menuButtons.forEach((button) => button.setAttribute('aria-expanded', String(isOpen)));
  if (sidebar) {
    sidebar.inert = mobileViewport.matches && !isOpen;
    if (mobileViewport.matches && !isOpen) sidebar.setAttribute('aria-hidden', 'true');
    else sidebar.removeAttribute('aria-hidden');
    if (isOpen) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
    }
  }
  if (workspace) workspace.inert = isOpen;
  if (bottomNavigation) bottomNavigation.inert = isOpen;
}

function closeNavigation(restoreFocus = false) {
  if (restoreFocus) {
    if (workspace) workspace.inert = false;
    if (bottomNavigation) bottomNavigation.inert = false;
    navigationOpener?.focus();
  }
  setNavigationState(false);
}

menuButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (document.body.classList.contains('nav-open')) {
      closeNavigation(true);
      return;
    }
    navigationOpener = button;
    setNavigationState(true);
    sidebar?.querySelector('[data-close-nav]')?.focus();
  });
});
document.querySelectorAll('[data-close-nav]').forEach((button) => {
  button.addEventListener('click', () => closeNavigation(true));
});
document.addEventListener('keydown', (event) => {
  if (!document.body.classList.contains('nav-open')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeNavigation(true);
  }
  if (event.key === 'Tab' && mobileViewport.matches && sidebar) {
    const controls = [...sidebar.querySelectorAll('a[href], button:not([disabled])')].filter(
      (control) => control.getClientRects().length > 0,
    );
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
  const focusWasInSidebar = sidebar?.contains(document.activeElement);
  if (mobileViewport.matches && focusWasInSidebar) {
    if (workspace) workspace.inert = false;
    menuButtons[0]?.focus();
  } else if (focusWasInSidebar && document.activeElement?.matches('[data-close-nav]')) {
    sidebar.querySelector('.nav-link.is-active, .brand')?.focus();
  }
  closeNavigation();
});
setNavigationState(false);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) closeNavigation();
});

const passwordToggle = document.querySelector('[data-toggle-password]');
const passwordInput =
  passwordToggle && document.getElementById(passwordToggle.getAttribute('aria-controls'));
if (passwordToggle && passwordInput) {
  passwordToggle.hidden = false;
  passwordToggle.addEventListener('click', () => {
    const showPassword = passwordInput.type === 'password';
    passwordInput.type = showPassword ? 'text' : 'password';
    passwordToggle.setAttribute('aria-pressed', String(showPassword));
    passwordToggle.setAttribute('aria-label', showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
    passwordToggle.textContent = showPassword ? 'ซ่อน' : 'แสดง';
  });
}

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
