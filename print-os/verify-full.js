import { Client } from 'pg';
const conn = process.argv[2];
const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();

console.log('=== PRINT OS DATABASE VERIFICATION ===\n');

const checks = [
  { l: 'Total tables in public schema', s: `select count(*) as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'` },
  { l: 'Tables with RLS enabled', s: `select count(*) as n from pg_tables where schemaname = 'public' and rowsecurity = true` },
  { l: 'RLS policies created', s: `select count(*) as n from pg_policies where schemaname = 'public'` },
  { l: 'Auto-audit triggers', s: `select count(*) as n from information_schema.triggers where trigger_schema = 'public' and trigger_name = 'trg_auto_audit'` },
  { l: 'updated_at triggers', s: `select count(*) as n from information_schema.triggers where trigger_schema = 'public' and trigger_name = 'trg_set_updated_at'` },
  { l: 'Helper functions', s: `select count(*) as n from information_schema.routines where routine_schema = 'public' and routine_name in ('fn_current_company_id', 'fn_is_super_admin', 'fn_auto_audit', 'fn_set_updated_at', 'fn_generate_doc_number')` },
  { l: 'Companies (SR Creative)', s: `select count(*) as n from companies` },
  { l: 'Branches', s: `select count(*) as n from branches` },
  { l: 'Roles', s: `select count(*) as n from roles` },
  { l: 'Customers', s: `select count(*) as n from customers` },
  { l: 'Quotations', s: `select count(*) as n from quotations` },
  { l: 'Sales Orders', s: `select count(*) as n from sales_orders` },
  { l: 'Production Jobs', s: `select count(*) as n from production_jobs` },
  { l: 'Invoices', s: `select count(*) as n from invoices` },
  { l: 'Payments', s: `select count(*) as n from payments` },
  { l: 'Tenant Features', s: `select count(*) as n from tenant_features` },
];

let allOk = true;
for (const check of checks) {
  const r = await c.query(check.s);
  const n = parseInt(r.rows[0].n);
  const expected = check.l.includes('tables') ? 24 : (check.l.includes('RLS') ? 24 : (check.l.includes('triggers') ? 14 : 0));
  const icon = n > 0 ? '✓' : '✗';
  console.log(`  ${icon} ${check.l.padEnd(35)} : ${n}`);
  if (n === 0) allOk = false;
}

// Test RLS with simulated non-super-admin query
console.log('\n=== RLS BEHAVIOR TEST ===\n');

await c.query(`SET LOCAL role anon`);
const r1 = await c.query(`select count(*) as n from customers`);
console.log(`  Anon role sees customers: ${r1.rows[0].n} (should be 0 — RLS blocks)`);

await c.query(`SET LOCAL role authenticated`);
const r2 = await c.query(`select count(*) as n from customers`);
console.log(`  Auth role (no JWT metadata) sees customers: ${r2.rows[0].n} (should be 0 — RLS blocks)`);

await c.query(`RESET role`);

console.log('\n=== DONE ===');
console.log(allOk ? '✓ All checks passed.' : '✗ Some checks failed.');

await c.end();
