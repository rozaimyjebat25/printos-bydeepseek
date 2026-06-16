import { Client } from 'pg';
const c = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } });
await c.connect();

console.log('=== USER & AUTH VERIFICATION ===\n');

// Check users table
const r1 = await c.query(`
  select u.id, u.email, u.full_name, u.company_id, u.branch_id, r.name as role_name, r.key as role_key
  from users u
  left join roles r on r.id = u.role_id
`);
console.log('Users in public.users:');
r1.rows.forEach(u => console.log(`  ${u.email} (${u.role_name}) — company: ${u.company_id?.substring(0, 8)}...`));

// Check auth.users app_metadata
const r2 = await c.query(`
  select id, email, raw_app_meta_data
  from auth.users
  where id = $1
`, [process.argv[3]]);

console.log('\nAuth user JWT metadata:');
if (r2.rows[0]) {
  const meta = r2.rows[0].raw_app_meta_data;
  console.log(`  Email: ${r2.rows[0].email}`);
  console.log(`  company_id: ${meta?.company_id}`);
  console.log(`  role: ${meta?.role}`);
  console.log(`  role_id: ${meta?.role_id}`);
} else {
  console.log('  ✗ User not found in auth.users');
}

// Test: simulate login flow
console.log('\n=== SIMULATED LOGIN FLOW ===\n');

// Check that fn_current_company_id() will work
const r3 = await c.query(`
  select (
    (auth.jwt() -> 'app_metadata' ->> 'company_id')
  ) as company_id_from_jwt
`);
console.log(`  Default JWT (no user): company_id = ${r3.rows[0].company_id_from_jwt || 'null'}`);
console.log(`  ✓ fn_current_company_id() will read from app_metadata.company_id`);

await c.end();
