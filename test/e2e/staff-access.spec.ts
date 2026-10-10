import { expect, test } from '@playwright/test';

test('E2E · staff meter workflow and financial access restrictions', async ({ page }) => {
  test.skip(
    !process.env.E2E_STAFF_PASSWORD,
    'Set E2E_STAFF_PASSWORD for a dedicated staff test account',
  );
  test.skip(
    process.env.E2E_DEMO_MUTATION !== '1',
    'Run meter mutations only in the isolated schema',
  );
  await page.goto('/login');
  await page.getByLabel('ชื่อผู้ใช้').fill(process.env.E2E_STAFF_USERNAME ?? 'staff');
  await page.getByLabel('รหัสผ่าน').fill(process.env.E2E_STAFF_PASSWORD!);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/\/readings$/);
  await expect(page.getByRole('link', { name: /ไปหน้าบิลรายเดือน/ })).toHaveCount(0);

  await page.goto('/dashboard');
  await expect(page.getByRole('status')).toContainText('รอจดมิเตอร์');
  await expect(page.getByRole('link', { name: 'ห้องพัก', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'จดมิเตอร์', exact: true })).toBeVisible();
  await expect(page.locator('a[href="/bills"], a[href^="/reports"]')).toHaveCount(0);

  const period = '2099-12';
  await page.goto(`/readings?period=${period}`);
  const row = page.locator('tr[data-room="206"]');
  const previousWater = Number(await row.locator('td').nth(1).textContent());
  const previousElectric = Number(await row.locator('td').nth(3).textContent());
  await row.getByLabel('น้ำ ห้อง 206').fill(String(previousWater + 10));
  await row.getByLabel('ไฟฟ้า ห้อง 206').fill(String(previousElectric + 70));
  await row.getByRole('button', { name: 'บันทึก' }).click();
  await expect(page.getByRole('status')).toHaveText('บันทึกเลขมิเตอร์เรียบร้อย');

  const response = await page.request.get(`/api/dashboard/summary?period=${period}`);
  expect(response.status()).toBe(200);
  expect((await response.json()).data).toEqual({
    period,
    rooms_total: 80,
    rooms_occupied: 67,
    readings_complete: 1,
    readings_remaining: 66,
  });
  for (const path of [
    '/api/dashboard/charts',
    '/reports/arrears?format=csv',
    '/bills',
    '/receipts/1',
    '/settings',
    '/tenants',
  ]) {
    expect((await page.request.get(path)).status(), path).toBe(403);
  }
  const denied = await page.goto('/bills');
  expect(denied?.status()).toBe(403);
  await expect(page.getByText('คุณไม่มีสิทธิ์เข้าถึงหน้านี้')).toBeVisible();
});
