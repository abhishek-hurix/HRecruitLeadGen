import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { generateAssessmentToken } from '../src/utils/jwt';

const API = 'http://localhost:4000/api';
const prisma = new PrismaClient();
const pdfPath = path.resolve(__dirname, '../uploads/resumes/resumes/48c6cbc3-94fd-41e3-b519-b15b6c12b811.pdf');

async function getVerificationToken(candidateId: string, email: string) {
  const tokenRecord = await prisma.assessmentToken.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
  });
  if (!tokenRecord) throw new Error('Assessment token not found in database');
  return generateAssessmentToken(candidateId, email, tokenRecord.jti);
}

async function main() {
  const form = new FormData();
  form.append('fullName', 'E2E Test User');
  const email = `e2e.${Date.now()}@hurix.com`;
  form.append('email', email);
  form.append('phoneCountryIso', 'IN');
  form.append('phoneNumber', '9876543210');
  form.append('experienceCategory', 'FRESHER');
  form.append('linkedinUrl', 'https://linkedin.com/in/e2etest');
  form.append('password', 'TestPass123!');
  form.append('resume', fs.createReadStream(pdfPath), { filename: 'resume.pdf', contentType: 'application/pdf' });

  const reg = await axios.post(`${API}/register`, form, { headers: form.getHeaders() });
  console.log('1. REGISTER:', reg.data.success, reg.data.candidateName, reg.data.email);

  const verifyToken = await getVerificationToken(reg.data.candidateId, email);
  const verify = await axios.get(`${API}/verify`, { params: { token: verifyToken } });
  console.log('2. VERIFY:', verify.data.success, verify.data.candidateName);

  const token = verify.data.token;
  const headers = { Authorization: `Bearer ${token}` };

  const ready = await axios.get(`${API}/assessment/ready`, { headers });
  console.log('3. READY:', ready.data.candidateName, 'hasCompleted:', ready.data.hasCompleted);

  const start = await axios.post(`${API}/assessment/start`, { language: 'PYTHON' }, { headers });
  console.log('4. START:', start.data.questions.length, 'questions');

  const session = await axios.get(`${API}/assessment/session`, { headers });
  console.log('5. SESSION: persisted IDs match:', start.data.questions[0].id === session.data.questions[0].id);

  const answers = start.data.questions.map((q: { id: string; starterCode: string }) => ({
    questionId: q.id,
    code: q.starterCode,
  }));
  const submit = await axios.post(`${API}/assessment/submit`, { answers }, { headers });
  console.log('6. SUBMIT:', submit.data.status, submit.data.candidateName);

  const ready2 = await axios.get(`${API}/assessment/ready`, { headers });
  console.log('7. READY AFTER:', 'hasCompleted:', ready2.data.hasCompleted);

  try {
    await axios.post(`${API}/assessment/start`, { language: 'PYTHON' }, { headers });
    console.log('8. RETAKE: FAILED - should have been blocked');
    process.exit(1);
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    console.log('8. RETAKE BLOCKED:', err.response?.data?.message);
  }

  const thank = await axios.get(`${API}/assessment/thank-you`, { headers });
  console.log('9. THANK YOU:', thank.data.candidateName);

  console.log('\nE2E flow PASSED');
}

main()
  .catch((err) => {
    console.error('E2E FAILED:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
