import { expect, test } from '@playwright/test';

test('E2E-01 · room 205 reading, bill, payment, and receipt', async ({ page }) => {
  test.skip(process.env.E2E_DEMO_MUTATION !== '1', 'Enable only on a freshly reset demo database');
  test.setTimeout(120_000);

  const period = new Date().toISOString().slice(0, 7);
  await page.goto('/login');
  await page.getByLabel('ชื่อผู้ใช้').fill(process.env.E2E_ADMIN_USERNAME ?? 'admin');
  await page.getByLabel('รหัสผ่าน').fill(process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/readings?period=${period}`);
  const readingRow = page.locator('tr[data-room="205"]');
  await expect(readingRow).toContainText('1250.00');
  await expect(readingRow).toContainText('5280.00');
  await readingRow.getByLabel('น้ำ ห้อง 205').fill('1260');
  await readingRow.getByLabel('ไฟฟ้า ห้อง 205').fill('5350');
  await readingRow.getByRole('button', { name: 'บันทึก' }).click();
  await expect(page.getByRole('status')).toHaveText('บันทึกเลขมิเตอร์เรียบร้อย');
  await expect(page.getByLabel('น้ำ ห้อง 205')).toHaveValue('1260.00');
  await expect(page.getByLabel('ไฟฟ้า ห้อง 205')).toHaveValue('5350.00');

  await page.getByRole('link', { name: /ไปหน้าบิลรายเดือน/ }).click();
  await page.getByRole('button', { name: 'สร้าง/อัปเดตบิลฉบับร่าง' }).click();
  const row = page.locator('tr[data-room="205"]');
  await expect(row).toContainText('1790.00');
  await expect(row).toContainText('Draft');
  const billId = await row.getAttribute('data-bill-id');
  expect(billId).toBeTruthy();

  await row.getByRole('button', { name: 'อนุมัติบิล' }).click();
  await expect(page.locator('tr[data-room="205"]')).toContainText('Unpaid');
  const csrf = await page.locator('form[action="/logout"] input[name="_csrf"]').getAttribute('value');
  expect(csrf).toBeTruthy();
  await page.locator('tr[data-room="205"]').getByRole('button', { name: 'รับชำระเงินสด' }).click();
  await expect(page).toHaveURL(/\/receipts\/\d+$/);
  await expect(page.getByText(/REC-\d{6}-\d{6}/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'รวม 1790.00 บาท' })).toBeVisible();
  await expect(page.getByText(/ห้อง 205/)).toBeVisible();
  await expect(page.getByRole('table')).toContainText('ค่าน้ำ');
  await expect(page.getByRole('table')).toContainText('ค่าไฟฟ้า');
  await expect(page.getByRole('table')).toContainText('ค่าส่วนกลาง');
  await page.evaluate(() => {
    window.print = () => document.body.setAttribute('data-print-invoked', 'true');
  });
  await page.getByRole('button', { name: 'พิมพ์ใบเสร็จ' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-invoked', 'true');

  const secondPayment = await page.request.post(`/api/bills/${billId}/confirm-payment`, {
    headers: { 'x-csrf-token': csrf! },
  });
  expect(secondPayment.status()).toBe(409);

  const summary = await page.request.get(`/api/dashboard/summary?period=${period}`);
  expect(summary.status()).toBe(200);
  expect((await summary.json()).data.paid).toBe(1);
});
