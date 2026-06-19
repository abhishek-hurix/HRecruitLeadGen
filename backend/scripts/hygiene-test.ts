import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:4000/api';
const prisma = new PrismaClient();

async function main() {
  const visitorId = `hygiene_${Date.now()}`;

  await axios.post(`${API}/visitors/track`, {
    visitorId,
    landingPage: 'http://localhost:5173/?utm_source=google&utm_campaign=hygiene_test',
    utm_source: 'google',
    utm_campaign: 'hygiene_test',
    is_test: true,
  });

  const record = await prisma.visitor.findUnique({ where: { visitorId } });
  if (!record?.isTest || !record?.isInternal) {
    throw new Error('Localhost test visitor must be is_test and is_internal');
  }

  const login = await axios.post(`${API}/admin/login`, {
    email: 'admin@hurixdigital.com',
    password: 'HurixAdmin@2026',
  });
  const headers = { Authorization: `Bearer ${login.data.token}` };

  const real = await axios.get(`${API}/admin/analytics/sources`, {
    headers,
    params: { source: 'google', campaign: 'hygiene_test' },
  });
  const googleReal = real.data.data.find((s: { source: string }) => s.source === 'google');

  if (googleReal && googleReal.visitors > 0) {
    throw new Error('Localhost test traffic polluted production analytics');
  }

  const withFlags = await axios.get(`${API}/admin/analytics/sources`, {
    headers,
    params: { source: 'google', includeTest: true, includeInternal: true },
  });
  const googleAll = withFlags.data.data.find((s: { source: string }) => s.source === 'google');

  if (!googleAll || googleAll.visitors < 1) {
    throw new Error('Test traffic not visible when include flags enabled');
  }

  await prisma.visitor.delete({ where: { visitorId } });
  console.log('Analytics hygiene test PASSED');
  console.log('- Real report excludes localhost test visitor');
  console.log('- Toggles include test/internal traffic correctly');
}

main()
  .catch((err) => {
    console.error('HYGIENE TEST FAILED:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
