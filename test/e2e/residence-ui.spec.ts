import { expect, test } from '@playwright/test';

const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
test.describe('Residence interface', () => {
  test.skip(!password, 'Requires the configured admin test account');
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('ชื่อผู้ใช้').fill(process.env.E2E_ADMIN_USERNAME ?? 'admin');
    await page.getByLabel('รหัสผ่าน').fill(password!);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
  test('desktop dashboard follows the reference and each specification menu opens', async ({
    page,
  }) => {
    await page.goto('/dashboard?period=2026-09');
    await expect(page).toHaveTitle(/สุขธารา เรสซิเดนซ์/);
    await expect(page.locator('.kpi')).toHaveCount(10);
    await expect(page.locator('.usage-chart')).toHaveCount(2);
    await expect(page.locator('.usage-chart').first().locator('rect.chart-bar')).toHaveCount(12);
    await expect(page.locator('.donut-chart')).toBeVisible();
    await page.getByRole('link', { name: 'เดือนก่อนหน้า', exact: true }).click();
    await expect(page).toHaveURL(/period=2026-08/);
    await page.getByRole('link', { name: 'เดือนถัดไป', exact: true }).click();
    await expect(page).toHaveURL(/period=2026-09/);
    const nav = page.getByRole('navigation', { name: 'เมนูหลัก', exact: true });
    await expect(nav.getByRole('link')).toHaveCount(10);
    for (const name of [
      'จดมิเตอร์',
      'บิลประจำเดือน',
      'รับชำระเงิน',
      'ห้องพัก',
      'ผู้เช่า',
      'ประกาศ',
      'รายงาน',
      'ตั้งค่า',
      'ผู้ใช้งานระบบ',
      'ภาพรวม',
    ]) {
      await nav.getByRole('link', { name, exact: true }).click();
      await expect(page.locator('.topbar-title')).toContainText(name);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
  test('mobile meter cards, validation, room search and menu remain usable at 390px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/readings?period=2026-09&q=205');
    await expect(page.getByRole('navigation', { name: 'เมนูบนมือถือ' })).toBeVisible();
    const row = page.locator('tr[data-room="205"]');
    await expect(row).toBeVisible();
    const water = row.getByLabel('น้ำ ห้อง 205');
    await water.fill('1249');
    await expect(water).toHaveAttribute('aria-invalid', 'true');
    await expect(row.locator('.field-error').first()).toBeVisible();
    expect(await water.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);
    await water.fill('1260');
    await expect(water).toHaveAttribute('aria-invalid', 'false');
    await page.getByRole('button', { name: 'เปิดเมนู', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'เมนูหลัก', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'เปิดเมนู', exact: true })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await page.getByRole('textbox', { name: 'ค้นหาห้อง', exact: true }).fill('000');
    await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    await expect(page.getByText('ไม่พบห้องตามเงื่อนไขที่เลือก')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/dashboard?period=2026-09');
    await expect(page.locator('.kpi')).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
});
