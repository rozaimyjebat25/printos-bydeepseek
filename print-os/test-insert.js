import { Client } from 'pg';
const conn = process.argv[2];
const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();

try {
  const r = await c.query(`
    insert into companies (
      id, name, email, plan, plan_status, user_limit, branch_limit, is_active
    ) values (
      '00000000-0000-0000-0000-000000000001',
      'SR Creative Print',
      'admin@srcreative.my',
      'pro',
      'active',
      20,
      3,
      true
    ) on conflict (id) do nothing
    returning id, name
  `);
  console.log('Insert result:', r.rows);
} catch (err) {
  console.log('Error:', err.message);
}

// Check if any company exists now
const r2 = await c.query(`select id, name from companies`);
console.log('Companies in DB:', r2.rows);

await c.end();
