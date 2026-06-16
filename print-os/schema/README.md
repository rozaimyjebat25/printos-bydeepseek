# PRINT OS — Database Schema V1.0

> **System of Record + Workflow Engine untuk Visual Communication Operations**

Schema ini adalah foundation untuk PRINT OS. Ia dibina untuk **multi-tenant SaaS** dengan **Row Level Security (RLS)** yang dikuatkuasakan di peringkat database, bukan application.

---

## Prinsip Teras

| Prinsip | Pelaksanaan |
| --- | --- |
| **Tenant Isolation** | Setiap table ada `company_id`, RLS di-enforce di DB level |
| **Metadata Only di HQ** | Fail pelanggan disimpan di storage tenant (BYOS), HQ hanya simpan URL |
| **Audit Trail Global** | Auto-trigger rekod setiap INSERT/UPDATE/DELETE |
| **Soft Delete** | `deleted_at` column, tiada hard delete |
| **Auto Document Number** | `QT-25001`, `SO-25001`, `INV-25001` auto-generated |
| **Cost Visibility** | Sales TIDAK nampak cost/margin — enforced via RBAC + RLS |

---

## Struktur Fail

```
print-os/
└── schema/
    ├── 01_core_schema.sql     # Semua tables
    ├── 02_rls_policies.sql    # Row Level Security + audit trigger
    ├── 03_seed_demo.sql       # (Optional) Demo data SR Creative
    └── README.md              # Dokumen ini
```

---

## Cara Import ke Supabase

### Pilihan 1: Supabase SQL Editor (Paling Senang)

1. Login ke [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Pilih project PRINT OS anda
3. Pergi ke **SQL Editor** (icon `</>` di sidebar kiri)
4. Klik **New query**
5. Copy-paste semua content dari `01_core_schema.sql`
6. Klik **Run** (atau `Ctrl+Enter`)
7. Ulangi untuk `02_rls_policies.sql`

### Pilihan 2: Supabase CLI (Untuk Production)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link ke project
supabase link --project-ref <your-project-ref>

# Push schema
supabase db push
```

### Pilihan 3: Local Development (Docker)

```bash
# Clone repo
git clone <repo>
cd print-os

# Start local Supabase
supabase start

# Reset dan apply migrations
supabase db reset
```

---

## Senarai Tables (24 Tables)

### Foundation
| Table | Tujuan |
| --- | --- |
| `super_admins` | HQ staff (PrintOS team), bukan tenant |
| `companies` | Setiap syarikat printing = 1 tenant |
| `branches` | Cawangan syarikat (HQ, JB, KL dll) |
| `roles` | Customisable role per company (8 default) |
| `users` | Staff + customer login |

### Customer & Sales
| Table | Tujuan |
| --- | --- |
| `customers` | Master customer + LTV tracking |
| `leads` | Prospect, conversion → customer |
| `quotations` | Quotation (QT-25001) |
| `quotation_items` | Line items quotation |
| `sales_orders` | Sales Order (SO-25001) — main transaction |
| `sales_order_items` | Line items SO |

### Artwork & Production
| Table | Tujuan |
| --- | --- |
| `artworks` | Artwork file (URL only, BYOS) |
| `design_revisions` | Versioning + revision history |
| `production_jobs` | Job card (JOB-250615-001) |
| `qc_records` | QC inspection + checklist |
| `deliveries` | Self-collect / courier tracking |

### Finance
| Table | Tujuan |
| --- | --- |
| `invoices` | Invoice (INV-25001) |
| `payments` | Payment records |

### System
| Table | Tujuan |
| --- | --- |
| `audit_logs` | Global audit trail (auto) |
| `tenant_features` | License / feature flags |
| `usage_logs` | Resource usage tracking (AI, storage, etc) |
| `notifications` | In-app notifications |

---

## Multi-Tenant Pattern

Setiap table business data ada pattern sama:

```sql
company_id    uuid not null references companies(id)  -- Tenant isolation
created_by    uuid
updated_by    uuid
created_at    timestamptz
updated_at    timestamptz
deleted_at    timestamptz  -- soft delete
```

**Query pattern**: Tiap query mesti tapis dengan `company_id`. Tapi dengan RLS, anda tidak perlu tulis `where company_id = ...` di setiap query — database enforce automatik.

---

## Cost Visibility (RBAC)

Field `cost_per_unit`, `cost_total`, `gross_profit`, `margin_percent` wujud dalam:
- `quotation_items`
- `sales_order_items`
- `quotations`
- `sales_orders`

**Aplikasi MESTI filter field ini ikut role**:
- Sales Exec → tak nampak
- Designer → tak nampak
- Production → tak nampak
- Owner / Finance → nampak

RLS sahaja tidak cukup untuk hide columns. Anda perlu:
1. View-based queries yang exclude cost fields untuk non-finance roles
2. Atau API layer yang strip field sebelum hantar ke frontend

---

## BYOS (Bring Your Own Storage)

Field `*_url` dalam artwork/production/delivery/QC adalah **URL sahaja** kepada file dalam storage tenant:

| Provider | Format URL |
| --- | --- |
| Google Drive | `https://drive.google.com/uc?id=...` |
| Google Cloud Storage | `https://storage.googleapis.com/bucket/file.pdf` |
| AWS S3 | `https://bucket.s3.region.amazonaws.com/file.pdf` |
| Backblaze B2 | `https://f001.backblazeb2.com/...` |
| Wasabi | `https://bucket.wasabisys.com/...` |

Untuk security, guna **signed URL** dengan expiry 5-15 minit. Jangan expose direct URL.

Configuration storage tenant disimpan dalam `companies.storage_config` (jsonb, encrypted at rest).

---

## Audit Trail

Setiap INSERT/UPDATE/DELETE ke table teras auto-rekod ke `audit_logs`:

```
audit_logs
├── who    (user_id, from auth.uid())
├── what   (action: CREATE/UPDATE/DELETE)
├── when   (created_at)
├── where  (module, record_id)
├── old    (old_value jsonb)
└── new    (new_value jsonb)
```

Sangat penting untuk:
- Debugging (siapa ubah apa)
- Compliance (PDPA, audit keperluan)
- Dispute resolution

---

## Workflow State Machines

### Sales Order Status
```
pending_artwork
  → design_in_progress
  → approval_pending
  → artwork_approved
  → in_production
  → qc
  → packing
  → ready
  → out_for_delivery
  → delivered
  → completed
  → cancelled
```

### Artwork Status
```
pending_assignment
  → assigned
  → in_design
  → internal_review
  → ready_for_approval
  → revision_requested
  → approved
  → released
```

### Production Status
```
waiting_schedule
  → scheduled
  → printing
  → finishing
  → qc
  → packing
  → ready
  → delivered
```

### QC Status
```
pending → passed | failed | rework
```

### Delivery Status
```
pending → packed → booked → in_transit → delivered
        ↘ self_collect → picked_up
```

### Invoice Status
```
unpaid → partial → paid
      ↘ overdue
      ↘ cancelled
```

### Quotation Status
```
draft → sent → approved → converted (to SO)
                  ↘ rejected
                  ↘ expired
```

---

## Cara Test Schema

### 1. Insert Demo Company
```sql
-- Run dalam SQL Editor dengan service_role key (bypass RLS)
insert into companies (name, plan, plan_status) values
  ('SR Creative Print', 'pro', 'active');
```

### 2. Insert Demo User
```sql
-- Link user dari auth.users
insert into users (id, company_id, full_name, email)
select
  au.id,
  (select id from companies where name = 'SR Creative Print' limit 1),
  au.raw_user_meta_data->>'full_name',
  au.email
from auth.users au
where au.email = 'ahmad@srcreative.my'
limit 1;
```

### 3. Test RLS
```sql
-- Login sebagai user biasa, cuba query
select * from customers;  -- hanya nampak customer company sendiri
```

---

## KPI Yang Boleh Dikira Dari Schema Ini

| KPI | Query Pattern |
| --- | --- |
| **Transaction Capture Rate** | `count(sales_orders) / actual_orders_manual_count` |
| **Workflow Completion %** | `count(status='completed') / count(*)` |
| **Order Coverage %** | Sama seperti transaction capture |
| **Gross Profit Visibility %** | `count(so where cost_total > 0) / count(*)` |
| **Outstanding Amount** | `sum(invoices.outstanding_amount) where status != 'paid'` |
| **Customer LTV** | `customers.total_revenue` (auto-aggregated via trigger) |
| **Production Bottleneck** | `count(jobs where status='scheduled' and scheduled_at < now() - interval '4 hours')` |

---

## Apa Yang BELUM Ada (Untuk Sprint Akan Datang)

- [ ] **Machines table** — untuk Production planning
- [ ] **Suppliers table** — untuk Outsource tracking
- [ ] **Materials table** — untuk inventory
- [ ] **WhatsApp messages log** — untuk automation tracking
- [ ] **Recurring orders** — untuk repeat order prediction
- [ ] **Approval rules table** — untuk configurable approval workflow
- [ ] **Templates table** — untuk quotation templates

Tambah ikut keperluan, jangan tambah ikut trend.

---

## Migration Notes

Schema ini direka untuk **evolusi tanpa breaking changes**:

1. **Tambah column** → sentiasa `nullable` atau ada `default`
2. **Rename column** → guna view dengan nama lama + new column
3. **Drop column** → tunggu 1 release cycle
4. **Tambah table** → free, tak effect existing

---

## Security Checklist

- [x] RLS enabled untuk semua tables
- [x] `company_id` wajib ada di semua business tables
- [x] `deleted_at` untuk soft delete
- [x] Audit trail auto-trigger
- [x] Super admin pattern (bypass RLS untuk HQ)
- [x] Cost fields isolated (tapi enforce via API, bukan RLS)
- [ ] Signed URL untuk file access (implement di application layer)
- [ ] Encryption at rest untuk `storage_config`, `ai_config` (Supabase pgcrypto)
- [ ] MFA untuk super_admin (Supabase Auth setting)

---

## Tanggungjawab Application Layer

Database tidak boleh handle semua. Application perlu:

1. **Hide cost fields** ikut role (Sales tak boleh nampak)
2. **Generate signed URL** untuk file access (BYOS)
3. **Encrypt credentials** sebelum save (Supabase Vault atau pgcrypto)
4. **Enforce workflow transitions** (tak boleh skip dari `draft` ke `completed`)
5. **Validate approval token** (single-use, expire 72 jam)
6. **Rate limit** API calls (especially AI)
7. **Log usage** ke `usage_logs` untuk billing

---

## Selesai

Schema ini adalah **foundation**. Bukan final.

Tambah column bila ada use case sebenar. Jangan tambah awal.

Ikut prinsip: **Transaction First. Perfect Later.**

---

**Maintainer**: PrintOS HQ
**Version**: 1.0
**Last Updated**: 2026-06-17
