// Robust seed runner: each statement dalam savepoint

import { Client } from 'pg';
import { readFileSync } from 'fs';

const CONNECTION_STRING = process.argv[2];
const SQL_FILE = process.argv[3];

const client = new Client({
  connectionString: CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('✓ Connected.');

const sql = readFileSync(SQL_FILE, 'utf8');

// Split by lines, identify statements by 'insert into' at start
const lines = sql.split('\n');
const stmtBlocks = [];
let current = [];

for (const line of lines) {
  if (line.trim().startsWith('--') || line.trim() === '') {
    if (current.length > 0) {
      stmtBlocks.push(current.join('\n'));
      current = [];
    }
    continue;
  }
  current.push(line);
  // Detect end of statement
  const trimmed = line.trim();
  if (trimmed.endsWith(';')) {
    stmtBlocks.push(current.join('\n'));
    current = [];
  }
}
if (current.length > 0) stmtBlocks.push(current.join('\n'));

const statements = stmtBlocks
  .map(s => s.trim())
  .filter(s => s.length > 0);

// DEBUG: print first statement
if (statements.length > 0) {
  console.log('--- First statement ---');
  console.log(statements[0]);
  console.log('--- end ---');
  console.log();
}

console.log(`Found ${statements.length} statements\n`);

await client.query('BEGIN');

let i = 0;
let errors = 0;

for (const stmt of statements) {
  i++;
  const firstLine = stmt.split('\n')[0].trim().substring(0, 100);

  const sp = `sp_${i}`;
  try {
    await client.query(`SAVEPOINT ${sp}`);
    await client.query(stmt);
    await client.query(`RELEASE SAVEPOINT ${sp}`);
    console.log(`  [${i}] ✓ ${firstLine}`);
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    errors++;
    console.log(`  [${i}] ✗ ${firstLine}`);
    console.log(`      → ${err.message.split('\n')[0]}`);
  }
}

await client.query('COMMIT');

console.log(`\n${statements.length - errors}/${statements.length} succeeded, ${errors} failed`);
await client.end();
