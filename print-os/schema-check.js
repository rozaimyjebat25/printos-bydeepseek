import { Client } from 'pg';
const conn = process.argv[2];
const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`
  select ordinal_position, column_name, data_type
  from information_schema.columns
  where table_name = 'companies' and table_schema = 'public'
  order by ordinal_position
`);
r.rows.forEach(x => console.log(`${x.ordinal_position}. ${x.column_name} (${x.data_type})`));
await c.end();
