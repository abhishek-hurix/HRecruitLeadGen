import dotenv from 'dotenv';
import path from 'path';

const testEnv = path.resolve(__dirname, '../.env.test');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: testEnv, override: true });

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

process.env.NODE_ENV = 'test';
process.env.EMAIL_MOCK_MODE = 'true';
process.env.SANDBOX_MOCK_MODE = 'true';
process.env.JWT_ASSESSMENT_SECRET = process.env.JWT_ASSESSMENT_SECRET || 'test-assessment-secret-key-32chars!!';
process.env.JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || 'test-admin-secret-key-32chars!!!!';

// Force Prisma to reconnect with test DATABASE_URL
const globalForPrisma = globalThis as { prisma?: { $disconnect: () => Promise<void> } };
if (globalForPrisma.prisma) {
  void globalForPrisma.prisma.$disconnect();
  delete globalForPrisma.prisma;
}
