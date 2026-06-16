# PRINT OS — Setup Guide

> **System of Record + Workflow Engine untuk Visual Communication Operations**

Panduan lengkap untuk setup PRINT OS dari kosong sehingga boleh digunakan.

---

## Struktur Project

```
print-os/
├── schema/
│   ├── 01_core_schema.sql         # 24 tables
│   ├── 02_rls_policies.sql        # RLS + auto audit trigger
│   ├── 03_seed_demo_srcreative.sql# Demo data SR Creative
│   └── README.md                  # Schema documentation
│
├── backend/
│   ├── types/
│   │   └── domain.ts              # TypeScript types
│   │
│   ├── workflows/
│   │   └── stateMachines.ts       # Workflow transitions + validation
│   │
│   ├── rbac/
│   │   └── defaultMatrix.ts       # 8 default roles + permission matrix
│   │
│   ├── audit/
│   │   └── auditService.ts        # Audit trail service
│   │
│   ├── automation/
│   │   └── automationEngine.ts    # Rules engine + scheduled jobs
│   │
│   └── modules/
│       ├── quotationService.ts    # Quotation transaction engine
│       ├── salesOrderService.ts   # SO transaction engine
│       ├── productionService.ts   # Production + QC + Delivery
│       └── reportingService.ts    # 5 KPI + dashboard queries
│
└── SETUP.md                       # Dokumen ini
```

---

## Bahagian 1: Database (Supabase)

### Step 1: Create Supabase Project

1. Pergi ke [https://supabase.com](https://supabase.com)
2. Create new project
3. Pilih region: **Singapore** (paling dekat dengan Malaysia)
4. Set strong database password (simpan baik-baik)

### Step 2: Run Schema

Buka **SQL Editor** dalam Supabase Dashboard.

Run files dalam urutan ini:

**a) Core schema**
```sql
-- Copy-paste content dari 01_core_schema.sql
-- Klik Run (Ctrl+Enter)
```

**b) RLS policies**
```sql
-- Copy-paste content dari 02_rls_policies.sql
-- Klik Run
```

**c) Seed demo data (optional, untuk testing)**
```sql
-- Copy-paste content dari 03_seed_demo_srcreative.sql
-- Klik Run
```

### Step 3: Verify Installation

Run query ini dalam SQL Editor:

```sql
-- Should return 24
select count(*) as table_count
from information_schema.tables
where table_schema = 'public';

-- Should return 8
select count(*) as role_count
from roles
where company_id = '00000000-0000-0000-0000-000000000001';

-- Should return 5
select count(*) as customer_count
from customers
where company_id = '00000000-0000-0000-0000-000000000001';
```

---

## Bahagian 2: Authentication Setup

### Step 1: Configure Supabase Auth

Pergi ke **Authentication → URL Configuration**:
- Site URL: `http://localhost:5173` (development)
- Redirect URLs: tambah URL apps anda

### Step 2: Create First User (Owner)

1. Pergi ke **Authentication → Users**
2. Klik **Add user → Create new user**
3. Email: `owner@srcreative.my`
4. Password: `(strong password)`
5. Auto Confirm User: **ON**

### Step 3: Link User to Company

```sql
insert into users (id, company_id, branch_id, role_id, full_name, email, is_active)
values (
  '<user-uuid-from-auth>',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020',
  'Ahmad bin Ali',
  'owner@srcreative.my',
  true
);
```

### Step 4: Set JWT Metadata (Penting untuk RLS!)

Untuk user `owner@srcreative.my`, set custom claims:

```sql
-- Run in Supabase SQL Editor
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'company_id', '00000000-0000-0000-0000-000000000001',
  'role', 'owner',
  'role_id', '00000000-0000-0000-0000-000000000020'
)
where email = 'owner@srcreative.my';
```

**Atau** gunakan `service_role` key di backend dan set dalam code:

```typescript
await supabase.auth.admin.updateUserById(userId, {
  app_metadata: {
    company_id: '00000000-0000-0000-0000-000000000001',
    role: 'owner',
    role_id: '00000000-0000-0000-0000-000000000020'
  }
});
```

---

## Bahagian 3: Backend Integration (TypeScript)

### Step 1: Install Dependencies

```bash
npm install @supabase/supabase-js
```

### Step 2: Setup Supabase Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Step 3: Use Services

```typescript
// Example: Create quotation
import { createQuotation } from '~/backend/modules/quotationService';
import { supabase } from '~/lib/supabase';

const { data, error } = await createQuotation(supabase, {
  userId: user.id,
  companyId: user.app_metadata.company_id,
  role: user.app_metadata.role,
}, {
  customer_id: 'xxx',
  items: [
    { product_name: 'Banner 3x1', quantity: 1, unit_price: 150 }
  ]
});
```

---

## Bahagian 4: Test the System

### Test 1: Create a Quotation

```typescript
const result = await createQuotation(supabase, context, {
  customer_id: '<customer-uuid>',
  items: [
    {
      product_name: 'Test Banner',
      product_category: 'banner',
      quantity: 2,
      unit_price: 100,
      cost_per_unit: 40,
    }
  ]
});
console.log(result);
```

Expected:
- Quotation number: `QT-2600001` (or next available)
- Status: `draft`
- Subtotal: 200
- Total: 200
- Cost total: 80 (if role is owner/management)
- Gross profit: 120
- Margin: 60%

### Test 2: Transition to Sent

```typescript
await transitionQuotation(supabase, context, {
  quotation_id: result.data.id,
  to_status: 'sent',
});
```

### Test 3: Check Sales Role Can't See Cost

Login sebagai `sales@srcreative.my` (after creating the user):
- Buka quotation yang sama
- `cost_total`, `gross_profit`, `margin_percent` akan jadi 0
- `cost_per_unit` dalam items akan jadi 0

### Test 4: Convert to Sales Order

```typescript
await transitionQuotation(supabase, context, {
  quotation_id: result.data.id,
  to_status: 'approved',
});

await convertQuotationToSO(supabase, context, result.data.id);
```

Expected: New SO dengan number `SO-2600001`, status `pending_artwork`.

### Test 5: Check Audit Log

```sql
select action, module, record_id, created_at
from audit_logs
where company_id = '00000000-0000-0000-0000-000000000001'
order by created_at desc
limit 10;
```

Expected: Log untuk setiap action yang diambil.

---

## Bahagian 5: Test Pilot SR Creative (10 Order Test)

Sebelum onboard customer pertama, jalankan 10 order sebenar dalam PRINT OS.

Checklist untuk setiap order:

- [ ] Quotation dibuat dalam PRINT OS
- [ ] Quotation dihantar & diluluskan
- [ ] Converted to SO
- [ ] Customer approval artwork (via portal)
- [ ] Artwork released to production
- [ ] Production job dijadualkan
- [ ] Production completed → QC
- [ ] QC passed
- [ ] Packing → Ready
- [ ] Delivery (self-collect / courier)
- [ ] Invoice generated
- [ ] Payment recorded

**Tanpa satu pun WhatsApp dalaman untuk tanya status.**
**Tanpa satu pun Excel untuk track.**

Jika 10 order ini boleh siap — V1.0 READY.

---

## Bahagian 6: KPI Dashboard

### Test 5 KPI

```typescript
import { getOwnerDashboard } from '~/backend/modules/reportingService';

const dashboard = await getOwnerDashboard(supabase, context);
console.log(dashboard);
```

Expected output:

```json
{
  "today": {
    "new_orders": 3,
    "revenue": 1250.00,
    "pending_artwork": 5,
    "in_production": 4,
    "awaiting_delivery": 2
  },
  "month": {
    "total_revenue": 28500.00,
    "total_profit": 14250.00,
    "margin_percent": 50.00,
    "total_orders": 42,
    "completed_orders": 28,
    "completion_rate": 66.67
  },
  "outstanding": {
    "total": 8500.00,
    "overdue": 1200.00,
    "invoice_count": 14
  },
  "production": {
    "queue": 12,
    "overdue": 2,
    "qc_pending": 3
  },
  "kpi": {
    "transaction_capture": 95.0,
    "order_coverage": 100.0,
    "workflow_completion": 66.67,
    "owner_dependency": 25.0,
    "profit_visibility": 85.0
  }
}
```

---

## Bahagian 7: BYOS Storage (Optional)

Untuk demo, guna Supabase Storage. Untuk production, tenant boleh setup storage sendiri.

### Setup Google Drive (Example)

1. Create Google Cloud Project
2. Enable Google Drive API
3. Create OAuth credentials
4. Setup webhook untuk receive file changes
5. Save config dalam `companies.storage_config` (encrypted)

```sql
update companies
set
  storage_provider = 'google_drive',
  storage_type = 'byos',
  storage_status = 'active',
  storage_connected_at = now(),
  storage_config = '{"refresh_token": "..."}'::jsonb  -- encrypt in real app
where id = '<company-uuid>';
```

---

## Troubleshooting

### Error: "new row violates row-level security policy"

**Sebab:** User tidak ada `company_id` dalam JWT metadata.

**Fix:** Update app_metadata user dengan company_id.

### Error: "permission denied for table companies"

**Sebab:** User tidak authenticated, atau RLS blocking.

**Fix:** Pastikan user logged in dan JWT valid.

### Cost fields masih nampak untuk Sales role

**Sebab:** Filter belum applied di frontend.

**Fix:** Pastikan `filterSensitiveFields` dipanggil dalam semua service response.

### Audit log tidak direkod

**Sebab:** Trigger belum enabled.

**Fix:**
```sql
-- Check triggers
select trigger_name, event_manipulation, event_object_table
from information_schema.triggers
where trigger_schema = 'database';

-- Re-apply audit trigger
-- (Run 02_rls_policies.sql again)
```

---

## Production Checklist

Sebelum deploy ke production:

- [ ] Strong database password
- [ ] RLS enabled pada semua tables (verify)
- [ ] All triggers active
- [ ] Backup strategy (Supabase auto-backup enabled)
- [ ] Custom claims setup untuk setiap user
- [ ] Encryption at rest untuk `storage_config`, `ai_config`
- [ ] Rate limiting pada API
- [ ] Monitoring (Sentry, LogRocket, etc)
- [ ] ToS & Privacy Policy published
- [ ] 10 order pilot test passed
- [ ] Staff training completed

---

## API Endpoints (akan datang)

PRINT OS menggunakan Supabase client. Tiap modul ada service functions.

Untuk expose sebagai REST API, gunakan **Supabase Edge Functions**:

```typescript
// supabase/functions/create-quotation/index.ts
import { createQuotation } from '../../../backend/modules/quotationService.ts';
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = await createQuotation(supabase, {
    userId: user.id,
    companyId: user.app_metadata.company_id,
    role: user.app_metadata.role,
  }, body);

  return Response.json(result);
});
```

---

## Selesai

PRINT OS V1.0 sekarang ada:

✅ 24 tables dengan RLS
✅ 8 default roles
✅ Workflow state machines untuk 8 modul
✅ Audit trail auto-trigger
✅ Quotation + SO transaction engine
✅ Production + QC + Delivery
✅ Automation engine dengan 11 default rules
✅ 5 KPI + Owner Dashboard
✅ Demo data SR Creative
✅ Setup guide ini

**Langkah seterusnya:**

1. Test 10 order sebenar dalam SR Creative
2. Bug fix & polish UI
3. Onboard 1 customer beta
4. Iterate berdasarkan feedback

---

**Maintainer:** PrintOS HQ
**Version:** 1.0
**Last Updated:** 2026-06-17
**Status:** Ready for Pilot
