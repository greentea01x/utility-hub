const printButton = document.querySelector('[data-print-receipt]');
if (printButton) {
  printButton.addEventListener('click', () => window.print());
  printButton.disabled = false;
}
