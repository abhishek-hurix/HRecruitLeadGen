import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('TEST_DATABASE_URL required');

execSync('npx prisma migrate deploy', {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testUrl },
});

execSync('npm run prisma:seed', {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testUrl },
});

console.log('Test database migrated and seeded.');
