// PRINT OS — Schema Deployer
// Connects to Supabase dan run semua SQL files dalam urutan

import { Client } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONNECTION_STRING = process.argv[2];

if (!CONNECTION_STRING) {
  console.error('Usage: node deploy-schema.js <connection_string>');
  process.exit(1);
}

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

async function runSQL(client, label, sql) {
  console.log(`\n========================================`);
  console.log(`  ${label}`);
  console.log(`========================================`);

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✓ ${label} — OK`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`✗ ${label} — FAILED`);
    console.error(`  Error: ${err.message}`);
    throw err;
  }
}

async function verifyCounts(client) {
  console.log(`\n========================================`);
  console.log(`  VERIFICATION`);
  console.log(`========================================`);

  const checks = [
    { label: 'Tables created', sql: `select count(*) as n from information_schema.tables where table_schema = 'public'` },
    { label: 'Roles (SR Creative)', sql: `select count(*) as n from roles where company_id = '00000000-0000-0000-0000-000000000001'` },
    { label: 'Branches (SR Creative)', sql: `select count(*) as n from branches where company_id = '00000000-0000-0000-0000-000000000001'` },
    { label: 'Customers (SR Creative)', sql: `select count(*) as n from customers where company_id = '00000000-0000-0000-0000-000000000001'` },
    { label: 'Sample Quotation', sql: `select count(*) as n from quotations where company_id = '00000000-0000-0000-0000-000000000001'` },
    { label: 'Sample SO', sql: `select count(*) as n from sales_orders where company_id = '00000000-0000-0000-0000-000000000001'` },
    { label: 'RLS enabled tables', sql: `select count(*) as n from pg_tables where schemaname = 'public' and rowsecurity = true` },
    { label: 'Audit triggers', sql: `select count(*) as n from information_schema.triggers where trigger_schema = 'public' and trigger_name = 'trg_auto_audit'` },
    { label: 'Production Jobs', sql: `select count(*) as n from production_jobs where company_id = '00000000-0000-0000-0000-000000000001'` },
    { label: 'Invoices', sql: `select count(*) as n from invoices where company_id = '00000000-0000-0000-0000-000000000001'` },
  ];

  for (const check of checks) {
    const r = await client.query(check.sql);
    const n = r.rows[0].n;
    const icon = n > 0 ? '✓' : '✗';
    console.log(`  ${icon} ${check.label}: ${n}`);
  }
}

async function main() {
  console.log('PRINT OS — Schema Deployer');
  console.log('Connecting to Supabase...');

  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✓ Connected.\n');

  // List migrations
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files:`);
  files.forEach((f) => console.log(`  - ${f}`));

  // Run each file
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await runSQL(client, file, sql);
  }

  // Verify
  await verifyCounts(client);

  await client.end();
  console.log('\n✓ All migrations applied successfully.');
  console.log('\nNext steps:');
  console.log('  1. Create first user in Supabase Auth (owner@srcreative.my)');
  console.log('  2. Link user to company via SQL (see SETUP.md)');
  console.log('  3. Set JWT custom claims (company_id, role)');
  console.log('  4. Test login from your Replit app');
}

main().catch((err) => {
  console.error('\n✗ Deployment failed:', err.message);
  process.exit(1);
});
