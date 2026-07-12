import { test, expect } from '@playwright/test';

/**
 * Candidate Management E2E (HP) — uses API route mocks so tests do not depend on live data.
 * Run from repo root: npx playwright test e2e/flows/candidate-management.spec.ts
 */

type AdminFixture = {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  permissions: string[];
};

const superAdmin: AdminFixture = {
  id: 'admin-1',
  email: 'admin@hurixdigital.com',
  role: 'SUPER_ADMIN',
  permissions: [
    'view_dashboard',
    'view_candidates',
    'manage_candidates',
    'export_candidates',
    'view_deleted_candidates',
    'permanently_delete_candidates',
    'view_job_roles',
  ],
};

const normalAdmin: AdminFixture = {
  id: 'admin-2',
  email: 'hr@hurixdigital.com',
  role: 'ADMIN',
  permissions: ['view_dashboard', 'view_candidates', 'manage_candidates', 'export_candidates'],
};

async function seedAdminSession(page: import('@playwright/test').Page, admin: AdminFixture = superAdmin) {
  await page.addInitScript((token) => {
    localStorage.setItem('admin_token', token);
  }, 'e2e-token');

  await page.route('**/api/admin/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, ...admin }),
    });
  });
}

const listFixture = {
  data: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      applicationId: '11111111',
      fullName: 'Alice AdminTest',
      email: 'alice@example.com',
      phone: '+919876543210',
      phoneCountry: 'India',
      experienceLabel: '2-3 Years',
      appliedRole: 'Engineer',
      journeyStatus: 'VERIFIED',
      assessmentStatus: 'NOT_STARTED',
      score: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      applicationId: '22222222',
      fullName: 'Bob AdminTest',
      email: 'bob@example.com',
      phone: '+919876543211',
      phoneCountry: 'India',
      experienceLabel: '2-3 Years',
      appliedRole: 'Engineer',
      journeyStatus: 'REGISTERED',
      assessmentStatus: 'NOT_STARTED',
      score: null,
      createdAt: new Date().toISOString(),
    },
  ],
  roleFilters: [],
  pagination: {
    page: 1,
    limit: 25,
    pageSize: 25,
    total: 52,
    totalPages: 3,
    hasNextPage: true,
    hasPreviousPage: false,
  },
  meta: {
    page: 1,
    pageSize: 25,
    total: 52,
    totalPages: 3,
    hasNextPage: true,
    hasPreviousPage: false,
  },
};

test.describe('Candidate Management UI', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page, superAdmin);

    await page.route('**/api/admin/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'e2e-token',
          admin: superAdmin,
        }),
      });
    });

    await page.route('**/api/admin/dashboard**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalCandidates: 52,
          registered: 10,
          emailSent: 10,
          verified: 10,
          started: 10,
          submitted: 10,
          expired: 2,
        }),
      });
    });

    await page.route('**/api/admin/candidates?**', async (route) => {
      const url = new URL(route.request().url());
      const pageNum = Number(url.searchParams.get('page') || '1');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...listFixture,
          meta: {
            ...listFixture.meta,
            page: pageNum,
            hasPreviousPage: pageNum > 1,
            hasNextPage: pageNum < 3,
          },
          pagination: {
            ...listFixture.pagination,
            page: pageNum,
            hasPreviousPage: pageNum > 1,
            hasNextPage: pageNum < 3,
          },
        }),
      });
    });

    await page.route('**/api/admin/job-roles**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ id: 'role-1', title: 'Engineer', status: 'ACTIVE' }],
        }),
      });
    });

    await page.route('**/api/admin/reminder-templates**', async (route) => {
      const url = route.request().url();
      if (url.includes('/preview') || route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { subject: 'Please continue', bodyHtml: '<p>Hello</p>' },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ id: 'tpl-1', name: 'Default Reminder', subject: 'Please continue', bodyHtml: '<p>Hello</p>' }],
        }),
      });
    });

    await page.route('**/api/admin/calendar/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { connected: true, googleEmail: 'cal@hurix.com', mockMode: true } }),
      });
    });

    await page.route('**/api/admin/candidates/bulk/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          operationId: 'op-1',
          summary: { requested: 1, succeeded: 1, failed: 0, skipped: 0 },
          errors: [],
        }),
      });
    });

    await page.route('**/api/admin/candidates/bulk/reminders', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          operationId: 'op-rem',
          summary: { requested: 1, succeeded: 1, failed: 0, skipped: 0 },
          errors: [],
        }),
      });
    });

    await page.route('**/api/admin/candidates/bulk/delete', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          operationId: 'op-del',
          summary: { requested: 1, succeeded: 1, failed: 0, skipped: 0 },
          errors: [],
        }),
      });
    });

    await page.route('**/api/admin/candidates/bulk/schedule-interview', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          operationId: 'op-int',
          summary: { requested: 1, succeeded: 1, failed: 0, skipped: 0 },
          errors: [],
          meetUrl: 'https://meet.google.com/abc-defg-hij',
          calendarEventLinks: ['https://calendar.google.com/event?eid=1'],
        }),
      });
    });

    await page.route('**/api/admin/candidates/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        body: 'id,name\n1,Alice\n',
        headers: { 'Content-Disposition': 'attachment; filename="candidates.csv"' },
      });
    });

    await page.route('**/api/admin/deleted-candidates/**/restore', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/admin/deleted-candidates/**/permanent', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/admin/deleted-candidates**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: '33333333-3333-3333-3333-333333333333',
                applicationId: '33333333',
                fullName: 'Deleted Person',
                email: 'deleted@example.com',
                deletedAt: new Date().toISOString(),
                deletedBy: { name: 'Super Admin', email: 'admin@hurixdigital.com' },
              },
            ],
            meta: {
              page: 1,
              pageSize: 25,
              total: 1,
              totalPages: 1,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
  });

  test('admin can open candidates, select rows, and open bulk toolbar', async ({ page }) => {
    await page.goto('/admin/candidates');
    await expect(page.getByRole('heading', { name: 'Candidates' })).toBeVisible();
    await expect(page.getByText(/52 candidates/i)).toBeVisible();

    const firstCheckbox = page.getByRole('checkbox', { name: /Select Alice/i });
    await firstCheckbox.check();
    await expect(page.getByText(/1 candidate selected/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Change Status/i })).toBeVisible();
  });

  test('cross-page selection persists while paging', async ({ page }) => {
    await page.goto('/admin/candidates');
    await page.getByRole('checkbox', { name: /Select Alice/i }).check();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText(/1 candidate selected/i)).toBeVisible();
  });

  test('select-all confirmation activates matching selection', async ({ page }) => {
    await page.goto('/admin/candidates');
    await page.getByLabel('Select all matching candidates').click();
    await expect(page.getByRole('heading', { name: /Select All Matching/i })).toBeVisible();
    await page.getByRole('button', { name: /Confirm Select All/i }).click();
    await expect(page.getByText(/52 candidates selected/i)).toBeVisible();
  });

  test('bulk status modal validates and submits', async ({ page }) => {
    await page.goto('/admin/candidates');
    await page.getByRole('checkbox', { name: /Select Alice/i }).check();
    await page.getByRole('button', { name: /Change Status/i }).click();
    await expect(page.getByRole('heading', { name: /Change Journey Status/i })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText(/succeeded/i)).toBeVisible();
  });

  test('reminder modal loads templates and sends', async ({ page }) => {
    await page.goto('/admin/candidates');
    await page.getByRole('checkbox', { name: /Select Alice/i }).check();
    await page.getByRole('button', { name: /Send Reminder/i }).click();
    await expect(page.getByRole('heading', { name: /Send Reminder Email/i })).toBeVisible();
    await expect(page.getByLabel('Reminder template')).toBeVisible();
    await page.getByRole('button', { name: /^Send Reminder$/ }).last().click();
    await expect(page.getByText(/succeeded/i)).toBeVisible();
  });

  test('export download modal works', async ({ page }) => {
    await page.goto('/admin/candidates');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Export$/ }).first().click();
    await expect(page.getByRole('heading', { name: /Export Candidates/i })).toBeVisible();
    await page.getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/candidates/i);
  });

  test('soft delete clears selection after success', async ({ page }) => {
    await page.goto('/admin/candidates');
    await page.getByRole('checkbox', { name: /Select Alice/i }).check();
    await page.getByRole('button', { name: /^Delete$/ }).click();
    await expect(page.getByRole('heading', { name: /Soft Delete/i })).toBeVisible();
    await page.getByRole('button', { name: /Confirm Delete/i }).click();
    await expect(page.getByText(/succeeded/i)).toBeVisible();
    await expect(page.getByText(/candidate selected/i)).toHaveCount(0);
  });

  test('interview scheduling modal submits', async ({ page }) => {
    await page.goto('/admin/candidates');
    await page.getByRole('checkbox', { name: /Select Alice/i }).check();
    await page.getByRole('button', { name: /Schedule Interview/i }).click();
    await expect(page.getByRole('heading', { name: /Schedule Interview/i })).toBeVisible();
    await page.getByLabel('Interview date').fill('2030-01-15');
    await page.getByRole('button', { name: /Confirm Schedule/i }).click();
    await expect(page.getByText(/succeeded/i)).toBeVisible();
  });

  test('super admin can restore deleted candidate', async ({ page }) => {
    await page.goto('/admin/deleted-candidates');
    await expect(page.getByRole('heading', { name: /Deleted Candidates/i })).toBeVisible();
    await expect(page.getByText('Deleted Person')).toBeVisible();
    await page.getByRole('button', { name: /^Restore$/ }).click();
    await page.getByRole('button', { name: /Confirm Restore/i }).click();
    await expect(page.getByText(/restored successfully/i)).toBeVisible();
  });

  test('super admin can permanently delete', async ({ page }) => {
    await page.goto('/admin/deleted-candidates');
    await page.getByRole('button', { name: /Permanent Delete/i }).click();
    await expect(page.getByRole('heading', { name: /Permanently Delete/i })).toBeVisible();
    await page.getByRole('button', { name: /Permanently Delete/i }).last().click();
    await expect(page.getByText(/permanently deleted/i)).toBeVisible();
  });

  test('normal admin is denied deleted candidates route', async ({ page }) => {
    await seedAdminSession(page, normalAdmin);
    await page.goto('/admin/deleted-candidates');
    await expect(page).toHaveURL(/access-denied/);
  });
});
