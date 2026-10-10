import { test, expect } from '@playwright/test';

const username = process.env.E2E_ADMIN_USERNAME ?? 'admin';
const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;

test.describe('authenticated admin flow', () => {
  test.skip(!password, 'Set SEED_ADMIN_PASSWORD or E2E_ADMIN_PASSWORD to run browser E2E tests');

  test('SMOKE · FR-01 · login reaches the dashboard and preserves the Thai shell', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/เข้าสู่ระบบ/);
    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible();

    await page.getByLabel('ชื่อผู้ใช้').fill(username);
    await page.getByLabel('รหัสผ่าน').fill(password!);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /ยินดีต้อนรับ/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ออกจากระบบ' })).toBeVisible();
  });

  test('SMOKE · FR-02 · unauthenticated protected pages redirect to login', async ({ page }) => {
    await page.goto('/rooms');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible();
  });

  test('SMOKE · FR-28 · authenticated admin can inspect rooms, readings, and bills', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('ชื่อผู้ใช้').fill(username);
    await page.getByLabel('รหัสผ่าน').fill(password!);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();

    await page.goto('/rooms');
    await expect(page.getByRole('heading', { name: 'ห้องพัก' })).toBeVisible();
    await expect(page.getByText('ทั้งหมด')).toBeVisible();

    await page.goto('/readings');
    await expect(page.getByRole('heading', { name: 'จดมิเตอร์' })).toBeVisible();
    await expect(page.getByRole('table')).toContainText('น้ำ');
    await expect(page.getByRole('table')).toContainText('ไฟฟ้า');

    await page.goto('/bills');
    await expect(page.getByRole('heading', { name: 'บิลรายเดือน' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('SMOKE · FR-01 · logout returns to the login screen', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('ชื่อผู้ใช้').fill(username);
    await page.getByLabel('รหัสผ่าน').fill(password!);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
    await page.getByRole('button', { name: 'ออกจากระบบ' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible();
  });
});
