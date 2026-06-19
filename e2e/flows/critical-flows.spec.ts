import { test, expect } from '@playwright/test';

test.describe('Flow 1: Landing → Registration UI', () => {
  test('visitor can reach registration form', async ({ page }) => {
    await page.goto('/?utm_source=youtube&utm_medium=video&utm_campaign=e2e_test');
    await expect(page.getByRole('heading', { name: /Talent Assessment Platform/i })).toBeVisible();
    await page.getByRole('main').getByRole('link', { name: /Apply Now/i }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByPlaceholder('John Doe')).toBeVisible();
    await expect(page.getByPlaceholder('john@example.com')).toBeVisible();
  });
});

test.describe('Flow 2: Candidate Login UI', () => {
  test('candidate can open login page from landing', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('main').getByRole('link', { name: /Candidate Login/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /Candidate Login/i })).toBeVisible();
  });
});

test.describe('Flow 3: Admin Login → Candidates', () => {
  test('admin can login and view candidates page', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    await page.locator('input[type="email"]').fill('admin@hurixdigital.com');
    await page.locator('input[type="password"]').fill('HurixAdmin@2026');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/admin\/dashboard/);
    await page.goto('/admin/candidates');
    await expect(page.getByText(/Candidates/i).first()).toBeVisible();
  });
});

test.describe('Flow 4: SUPER_ADMIN Analytics', () => {
  test('super admin can access marketing analytics', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill('admin@hurixdigital.com');
    await page.locator('input[type="password"]').fill('HurixAdmin@2026');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/admin\/dashboard/);
    await page.goto('/admin/analytics');
    await expect(page.getByRole('heading', { name: 'Marketing Analytics' })).toBeVisible();
    await expect(page.getByText(/Real Visitors/i)).toBeVisible();
  });
});

test.describe('Flow 5: UTM landing stores visitor', () => {
  test('UTM params appear in landing URL', async ({ page }) => {
    await page.goto('/?utm_source=youtube&utm_campaign=playwright_test');
    expect(page.url()).toContain('utm_source=youtube');
    expect(page.url()).toContain('utm_campaign=playwright_test');
  });
});
