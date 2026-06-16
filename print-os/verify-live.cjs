// Auto-verify Railway deployment
// Usage: node verify-live.cjs <url>

const url = process.argv[2];
if (!url) {
  console.log('Usage: node verify-live.cjs <url>');
  process.exit(1);
}

async function test() {
  console.log(`\n=== PRINT OS API Live Verification ===`);
  console.log(`URL: ${url}\n`);

  const tests = [
    {
      name: '1. Root endpoint',
      path: '/',
      expect: 200,
    },
    {
      name: '2. Health endpoint',
      path: '/health',
      expect: 200,
    },
    {
      name: '3. Quotations (no auth — should 401)',
      path: '/api/v1/quotations',
      expect: 401,
    },
    {
      name: '4. Customers (no auth — should 401)',
      path: '/api/v1/customers',
      expect: 401,
    },
    {
      name: '5. Sales Orders (no auth — should 401)',
      path: '/api/v1/sales-orders',
      expect: 401,
    },
    {
      name: '6. Dashboard (no auth — should 401)',
      path: '/api/v1/dashboard/owner',
      expect: 401,
    },
    {
      name: '7. 404 handler',
      path: '/nonexistent',
      expect: 404,
    },
  ];

  let pass = 0;
  let fail = 0;

  for (const t of tests) {
    try {
      const r = await fetch(`${url}${t.path}`);
      const ok = r.status === t.expect;
      const body = (await r.text()).substring(0, 100);
      console.log(`${ok ? '✓' : '✗'} ${t.name}`);
      console.log(`   Status: ${r.status} ${ok ? '' : `(expected ${t.expect})`}`);
      console.log(`   Body: ${body}`);
      if (ok) pass++; else fail++;
    } catch (e) {
      console.log(`✗ ${t.name} — Error: ${e.message}`);
      fail++;
    }
    console.log('');
  }

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

test();
