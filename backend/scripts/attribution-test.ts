import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { generateAssessmentToken } from '../src/utils/jwt';

const API = 'http://localhost:4000/api';
const prisma = new PrismaClient();
const pdfPath = path.resolve(__dirname, '../uploads/resumes/resumes/48c6cbc3-94fd-41e3-b519-b15b6c12b811.pdf');

const trackOpts = { is_test: true };

async function getVerificationToken(candidateId: string, email: string) {
  const tokenRecord = await prisma.assessmentToken.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
  });
  if (!tokenRecord) throw new Error('Assessment token not found');
  return generateAssessmentToken(candidateId, email, tokenRecord.jti);
}

async function main() {
  const visitorId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const track1 = await axios.post(`${API}/visitors/track`, {
    visitorId,
    landingPage: 'http://localhost:5173/?utm_source=youtube&utm_medium=video&utm_campaign=ai_hiring_2026',
    referrer: 'https://youtube.com',
    deviceType: 'DESKTOP',
    utm_source: 'youtube',
    utm_medium: 'video',
    utm_campaign: 'ai_hiring_2026',
    ...trackOpts,
  });
  console.log('1. TRACK (YouTube first touch):', track1.data.success, 'isNew:', track1.data.isNew);

  const track2 = await axios.post(`${API}/visitors/track`, {
    visitorId,
    landingPage: 'http://localhost:5173/register?utm_source=facebook&utm_medium=social',
    deviceType: 'DESKTOP',
    utm_source: 'facebook',
    utm_medium: 'social',
    ...trackOpts,
  });
  console.log('2. TRACK (Facebook last touch):', track2.data.success);

  const visitor = await prisma.visitor.findUnique({ where: { visitorId } });
  if (!visitor) throw new Error('Visitor not found');
  if (!visitor.isTest || !visitor.isInternal) {
    throw new Error(`Expected is_test=true and is_internal=true, got test=${visitor.isTest} internal=${visitor.isInternal}`);
  }
  console.log('3. HYGIENE FLAGS:', { isTest: visitor.isTest, isInternal: visitor.isInternal });
  console.log('4. FIRST/LAST TOUCH:', visitor.firstTouchSource, '->', visitor.lastTouchSource);

  const organicId = `organic_${Date.now()}`;
  await axios.post(`${API}/visitors/track`, {
    visitorId: organicId,
    landingPage: 'http://localhost:5173/',
    deviceType: 'MOBILE',
    ...trackOpts,
  });

  const form = new FormData();
  form.append('fullName', 'Attribution Test User');
  const email = `attr.${Date.now()}@hurix.com`;
  form.append('email', email);
  form.append('phone', '9876543210');
  form.append('linkedinUrl', 'https://linkedin.com/in/attrtest');
  form.append('password', 'TestPass123!');
  form.append('visitorId', visitorId);
  form.append('resume', fs.createReadStream(pdfPath), { filename: 'resume.pdf', contentType: 'application/pdf' });

  const reg = await axios.post(`${API}/register`, form, { headers: form.getHeaders() });
  console.log('5. REGISTER:', reg.data.success);

  const verifyToken = await getVerificationToken(reg.data.candidateId, email);
  const verify = await axios.get(`${API}/verify`, { params: { token: verifyToken } });
  const headers = { Authorization: `Bearer ${verify.data.token}` };
  await axios.post(`${API}/assessment/start`, { language: 'PYTHON' }, { headers });

  const login = await axios.post(`${API}/admin/login`, {
    email: 'admin@hurixdigital.com',
    password: 'HurixAdmin@2026',
  });
  const adminHeaders = { Authorization: `Bearer ${login.data.token}` };

  const realOverview = await axios.get(`${API}/admin/analytics/overview`, { headers: adminHeaders });
  const allOverview = await axios.get(`${API}/admin/analytics/overview`, {
    headers: adminHeaders,
    params: { includeTest: true, includeInternal: true },
  });

  const realBefore = realOverview.data.data.visitors;
  const allCount = allOverview.data.data.visitors;
  console.log('6. REAL OVERVIEW (excludes test/internal):', realOverview.data.data);
  console.log('7. ALL OVERVIEW (includes test/internal):', allOverview.data.data);

  const created = await prisma.visitor.findUnique({ where: { visitorId } });
  if (!created?.isTest) throw new Error('Test visitor not flagged');

  if (allCount <= realBefore) {
    throw new Error('Expected test/internal traffic to be excluded from real overview by default');
  }

  console.log('\nAttribution E2E PASSED (hygiene verified)');
}

main()
  .catch((err) => {
    console.error('ATTRIBUTION E2E FAILED:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
