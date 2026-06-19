import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:4000/api';
const prisma = new PrismaClient();

async function countForVisitorId(visitorId: string) {
  return prisma.visitor.count({ where: { visitorId } });
}

async function main() {
  const visitorId = `dedup_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const payload = {
    visitorId,
    landingPage: 'http://localhost:5173/?utm_source=youtube&utm_medium=video&utm_campaign=dedup_test',
    deviceType: 'DESKTOP',
    utm_source: 'youtube',
    utm_medium: 'video',
    utm_campaign: 'dedup_test',
    heartbeat: false,
    is_test: true,
  };

  // Simulate React StrictMode double-mount + route changes + refresh
  const requests = [
    axios.post(`${API}/visitors/track`, payload),
    axios.post(`${API}/visitors/track`, payload),
    axios.post(`${API}/visitors/track`, { ...payload, landingPage: 'http://localhost:5173/register' }),
    axios.post(`${API}/visitors/track`, { visitorId, landingPage: 'http://localhost:5173/register', heartbeat: true }),
    axios.post(`${API}/visitors/track`, { visitorId, landingPage: 'http://localhost:5173/register', heartbeat: true }),
    axios.post(`${API}/visitors/track`, { visitorId, landingPage: 'http://localhost:5173/ready', heartbeat: true }),
  ];

  await Promise.all(requests);

  const count = await countForVisitorId(visitorId);
  const record = await prisma.visitor.findUnique({ where: { visitorId } });

  console.log('VISITOR_ID:', visitorId);
  console.log('RECORD_COUNT:', count);
  console.log('DEVICE:', record?.deviceType);
  console.log('CAMPAIGN:', record?.lastTouchCampaign);
  console.log('FIRST_AT:', record?.firstVisitedAt.toISOString());
  console.log('LAST_AT:', record?.lastVisitedAt.toISOString());

  if (count !== 1) {
    throw new Error(`Expected 1 record, found ${count}`);
  }

  // Heartbeat must not change device or campaign
  if (record?.deviceType !== 'DESKTOP' || record?.lastTouchCampaign !== 'dedup_test') {
    throw new Error('Heartbeat or duplicate track mutated attribution fields');
  }

  await prisma.visitor.delete({ where: { visitorId } });
  console.log('\nVisitor dedup test PASSED');
}

main()
  .catch((err) => {
    console.error('DEDUP TEST FAILED:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
