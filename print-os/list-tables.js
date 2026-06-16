import { Client } from 'pg';
const c = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name");
r.rows.forEach(x => console.log(x.table_name));
await c.end();
