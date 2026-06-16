import { Client } from 'pg';
const c = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } });
await c.connect();

const userId = process.argv[3];
const email = process.argv[4];
const fullName = process.argv[5] || 'Ahmad bin Ali';
const role = process.argv[6] || 'owner';

const roleMap = {
  owner: '00000000-0000-0000-0000-000000000020',
  management: '00000000-0000-0000-0000-000000000021',
  manager: '00000000-0000-0000-0000-000000000022',
  sales: '00000000-0000-0000-0000-000000000023',
  designer: '00000000-0000-0000-0000-000000000024',
  production: '00000000-0000-0000-0000-000000000025',
  supplier: '00000000-0000-0000-0000-000000000026',
  customer: '00000000-0000-0000-0000-000000000027',
};

const roleId = roleMap[role];
if (!roleId) {
  console.log('Invalid role. Use: owner, management, manager, sales, designer, production, supplier, customer');
  process.exit(1);
}

const companyId = '00000000-0000-0000-0000-000000000001';
const branchId = '00000000-0000-0000-0000-000000000010';

try {
  // 1. Link user
  await c.query(`
    insert into users (id, company_id, branch_id, role_id, full_name, email, is_active)
    values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, true)
    on conflict (id) do update set
      company_id = excluded.company_id,
      branch_id = excluded.branch_id,
      role_id = excluded.role_id,
      full_name = excluded.full_name,
      is_active = true
  `, [userId, companyId, branchId, roleId, fullName, email]);

  // 2. Set JWT metadata
  await c.query(`
    update auth.users
    set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
      'company_id', $1::text,
      'role', $2::text,
      'role_id', $3::text
    )
    where id = $4::uuid
  `, [companyId, role, roleId, userId]);

  console.log(`\n✓ User ${email} linked to SR Creative Print`);
  console.log(`  User ID:    ${userId}`);
  console.log(`  Company:    ${companyId}`);
  console.log(`  Branch:     ${branchId}`);
  console.log(`  Role:       ${role}`);
  console.log(`  Role ID:    ${roleId}`);
  console.log(`\n✓ JWT app_metadata updated (company_id, role, role_id)`);
  console.log(`\n→ Login dari Replit app untuk test.`);

} catch (err) {
  console.error('Error:', err.message);
}

await c.end();
