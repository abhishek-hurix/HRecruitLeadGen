/**
 * Security verification script for admin RBAC
 * Run: npm run test:security (from backend/)
 */
import axios from 'axios';
import { generateAdminToken, generateCandidatePortalToken } from '../src/utils/jwt';
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:4000/api';
const prisma = new PrismaClient();

async function expectStatus(promise: Promise<{ status: number }>, expected: number, label: string) {
  try {
    await promise;
    console.error(`FAIL: ${label} — expected ${expected}, got 2xx`);
    return false;
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === expected) {
      console.log(`PASS: ${label} (${status})`);
      return true;
    }
    console.error(`FAIL: ${label} — expected ${expected}, got ${status}`);
    return false;
  }
}

async function main() {
  let passed = 0;
  let total = 0;
  const check = async (ok: boolean) => { total++; if (ok) passed++; };

  // Anonymous access blocked
  await check(await expectStatus(axios.get(`${API}/admin/dashboard`), 401, 'Anonymous cannot access dashboard'));
  await check(await expectStatus(axios.get(`${API}/admin/candidates`), 401, 'Anonymous cannot access candidates'));
  await check(await expectStatus(axios.get(`${API}/admin/users`), 401, 'Anonymous cannot access users'));

  const superAdmin = await prisma.adminUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!superAdmin) throw new Error('No SUPER_ADMIN in database');

  const superToken = generateAdminToken(superAdmin.id, superAdmin.email, 'SUPER_ADMIN');
  const superHeaders = { Authorization: `Bearer ${superToken}` };

  const dash = await axios.get(`${API}/admin/dashboard`, { headers: superHeaders });
  console.log('PASS: Super admin can access dashboard');
  total++; passed++;
  if (dash.data.totalAdmins !== undefined) {
    console.log('PASS: Super admin sees totalAdmins analytics');
    total++; passed++;
  }

  const me = await axios.get(`${API}/admin/me`, { headers: superHeaders });
  if (me.data.role === 'SUPER_ADMIN') {
    console.log('PASS: /admin/me returns role');
    total++; passed++;
  }

  // Candidate portal token blocked from admin
  const fakeCandidateToken = generateCandidatePortalToken('fake-id', 'test@test.com');
  await check(await expectStatus(
    axios.get(`${API}/admin/dashboard`, { headers: { Authorization: `Bearer ${fakeCandidateToken}` } }),
    403,
    'Candidate JWT cannot access admin dashboard'
  ));

  // Create ADMIN user for role test
  const adminEmail = `rbac-admin-${Date.now()}@hurix.com`;
  await axios.post(`${API}/admin/users`, {
    email: adminEmail,
    password: 'TestAdmin123!',
    role: 'ADMIN',
  }, { headers: superHeaders });

  const adminUser = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
  if (!adminUser) throw new Error('Failed to create test admin');

  const adminToken = generateAdminToken(adminUser.id, adminUser.email, 'ADMIN');
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  await axios.get(`${API}/admin/candidates`, { headers: adminHeaders });
  console.log('PASS: ADMIN role can view candidates');
  total++; passed++;

  await check(await expectStatus(
    axios.get(`${API}/admin/users`, { headers: adminHeaders }),
    403,
    'ADMIN role cannot access /admin/users'
  ));

  await check(await expectStatus(
    axios.get(`${API}/admin/settings`, { headers: adminHeaders }),
    403,
    'ADMIN role cannot access /admin/settings'
  ));

  await check(await expectStatus(
    axios.get(`${API}/admin/candidates/export`, { headers: adminHeaders }),
    403,
    'ADMIN role cannot export candidates'
  ));

  // Admin JWT blocked from candidate portal
  await check(await expectStatus(
    axios.get(`${API}/candidate/dashboard`, { headers: superHeaders }),
    403,
    'Admin JWT cannot access candidate dashboard API'
  ));

  // Cleanup test admin
  await prisma.adminUser.delete({ where: { id: adminUser.id } });

  console.log(`\nSecurity tests: ${passed}/${total} passed`);
  if (passed < total) process.exit(1);
}

main()
  .catch((e) => {
    console.error('Security test error:', e.response?.data || e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
