import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

export default async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl) {
    console.warn('[tests] TEST_DATABASE_URL not set — integration tests will be skipped');
    return;
  }

  process.env.DATABASE_URL = testDbUrl;

  try {
    execSync('npx prisma migrate deploy', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: testDbUrl },
    });
  } catch (err) {
    console.warn('[tests] Migration deploy failed — integration tests may fail:', (err as Error).message);
  }
}
