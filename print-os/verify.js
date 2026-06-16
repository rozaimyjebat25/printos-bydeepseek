// Quick verify: check existing data

import { Client } from 'pg';

const CONNECTION_STRING = process.argv[2];

const client = new Client({
  connectionString: CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const checks = [
  { l: 'companies', s: `select count(*) as n, max(name) as sample from companies` },
  { l: 'branches', s: `select count(*) as n from branches where company_id = '00000000-0000-0000-0000-000000000001'` },
  { l: 'roles', s: `select count(*) as n from roles where company_id = '00000000-0000-0000-0000-000000000001'` },
  { l: 'customers', s: `select count(*) as n from customers where company_id = '00000000-0000-0000-0000-000000000001'` },
  { l: 'quotations', s: `select count(*) as n from quotations where company_id = '00000000-0000-0000-0000-000000000001'` },
  { l: 'quotation_items', s: `select count(*) as n from quotation_items` },
  { l: 'sales_orders', s: `select count(*) as n from sales_orders where company_id = '00000000-0000-0000-0000-000000000001'` },
  { l: 'sales_order_items', s: `select count(*) as n from sales_order_items` },
  { l: 'production_jobs', s: `select count(*) as n from production_jobs where company_id = '00000000-0000-0000-0000-000000000001'` },
  { l: 'invoices', s: `select count(*) as n from invoices where company_id = '00000000-0000-0000-0000-000000000001'` },
  { l: 'payments', s: `select count(*) as n from payments` },
  { l: 'tenant_features', s: `select count(*) as n from tenant_features where company_id = '00000000-0000-0000-0000-000000000001'` },
  { l: 'notifications', s: `select count(*) as n from notifications` },
];

for (const c of checks) {
  const r = await client.query(c.s);
  console.log(`  ${c.l.padEnd(20)} : ${r.rows[0].n}`);
}

await client.end();
