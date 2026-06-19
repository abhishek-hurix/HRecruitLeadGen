import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const baseUrl = process.env.DATABASE_URL || 'postgresql://hurix:hurix_secret@localhost:5432/hurix_talent';
  const testUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://hurix:hurix_secret@localhost:5432/hurix_talent_test?schema=public';

  const dbName = testUrl.match(/\/([^/?]+)(\?|$)/)?.[1] || 'hurix_talent_test';
  const adminUrl = baseUrl.replace(/\/([^/?]+)(\?|$)/, '/postgres$2');

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database: ${dbName}`);
  } else {
    console.log(`Database already exists: ${dbName}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
