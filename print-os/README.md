# PRINT OS — Multi-Tenant SaaS untuk Visual Communication Industry

> **System of Record + Workflow Engine** untuk industri percetakan Malaysia dan global.

PRINT OS ialah platform SaaS yang membantu syarikat percetakan mengurus operasi harian (CRM, Quotation, Sales Order, Production, QC, Delivery, Finance) dengan **System of Record** yang kukuh dan **Workflow Engine** yang automatik.

---

## 🎯 Visi

PRINT OS membina **System of Record** untuk industri visual communication, membolehkan syarikat:
- Mengautomasikan operasi
- Meningkatkan keuntungan
- Mengurangkan kebergantungan kepada pemilik
- Mengumpulkan data industri untuk intelligence layer

---

## 📦 Isi Repo Ini

```
print-os/
├── schema/              # PostgreSQL database schema
│   ├── 01_core_schema.sql         # 22 tables
│   ├── 02_rls_policies.sql        # Multi-tenant RLS
│   ├── 03_seed_demo_srcreative.sql# Demo data
│   └── README.md
│
├── backend/             # TypeScript business logic
│   ├── types/domain.ts            # Domain types
│   ├── workflows/stateMachines.ts # Workflow state machines
│   ├── rbac/defaultMatrix.ts      # 8 default roles
│   ├── audit/auditService.ts      # Audit trail
│   ├── automation/automationEngine.ts # Rules engine
│   └── modules/                   # Service modules
│       ├── quotationService.ts
│       ├── salesOrderService.ts
│       ├── productionService.ts
│       └── reportingService.ts
│
├── integration/         # React/TypeScript drop-in package untuk Replit apps
│   ├── context/                   # Auth provider
│   ├── hooks/                     # React hooks (quotations, SO, dashboard)
│   ├── services/                  # API wrappers
│   ├── components/                # UI components
│   ├── examples/App.tsx           # Complete example
│   └── README.md
│
├── supabase/            # Supabase migrations
│   ├── config.toml
│   └── migrations/                # SQL migration files
│
├── deploy-schema.js     # Schema deployer script
├── link-user.js         # User linking script
├── SETUP.md             # Setup guide
└── package.json
```

---

## 🚀 Quick Start

### 1. Setup Supabase Project

1. Create project di [supabase.com](https://supabase.com)
2. Run schema files dalam SQL Editor (urutan):
   - `schema/01_core_schema.sql`
   - `schema/02_rls_policies.sql`
   - `schema/03_seed_demo_srcreative.sql` (optional)

### 2. Setup First User

```sql
-- Create user via Supabase Auth Dashboard, then:
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'company_id', '<your-company-id>',
  'role', 'owner',
  'role_id', '<owner-role-id>'
)
where email = 'your@email.com';
```

### 3. Integrate ke Replit App

```bash
# Copy integration/ folder ke root Replit project
npm install @supabase/supabase-js

# Set env variables:
# VITE_SUPABASE_URL=https://<project>.supabase.co
# VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

```tsx
// App.tsx
import { PrintOSProvider, LoginPage, useAuth } from './integration';
import { DashboardGrid } from './integration/components/KPITile';

function App() {
  return (
    <PrintOSProvider>
      <MyApp />
    </PrintOSProvider>
  );
}

function MyApp() {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <LoginPage />;
  return <DashboardGrid dashboard={...} />;
}
```

---

## 🏗️ Architecture

### Multi-Tenant SaaS
- Setiap syarikat = 1 tenant dengan `company_id`
- **Row Level Security (RLS)** enforced di database level
- Tenant data fully isolated — satu tenant tak boleh nampak data tenant lain

### BYOS (Bring Your Own Storage)
- HQ simpan metadata sahaja
- Tenant simpan artwork/PDF/AI dalam storage sendiri (Google Drive, S3, GCS, Wasabi)
- Demo tenant guna Supabase Storage

### 3-Layer AI
- **HQ AI**: untuk operasi HQ (tenant health, churn prediction)
- **Tenant AI**: tenant guna API sendiri (OpenAI/Claude/Gemini)
- **AI Credit System**: HQ jual credit, jadi profit center

### Workflow Engine
- 8 state machines (Lead → Quotation → SO → Artwork → Production → QC → Delivery → Invoice)
- Role-based transition validation
- Auto triggers (create production job, delivery, invoice)
- Audit trail auto-logged

---

## 📊 5 Core KPI

PRINT OS track 5 metrik kritikal untuk setiap tenant:

1. **Transaction Capture Rate** — % transaksi sebenar yang masuk dalam sistem
2. **Order Coverage** — % order yang melalui PRINT OS
3. **Workflow Completion** — % order siap sepenuhnya
4. **Owner Dependency Reduction** — kurang campur tangan owner
5. **Gross Profit Visibility** — % order dengan data margin

---

## 🔐 Security

- ✅ RLS enabled untuk semua 22 tables
- ✅ 27 RLS policies (tenant isolation + role-based)
- ✅ Auto audit trail untuk semua business tables
- ✅ Cost fields (cost_per_unit, gross_profit) hidden dari sales role
- ✅ Soft delete pattern (deleted_at column)
- ✅ JWT custom claims untuk user context

---

## 📜 Prinsip Teras

```
Jangan bina apa yang nampak pintar.
Bina apa yang membuat operasi berjalan
tanpa campur tangan owner.

Transaction First. Perfect Later.

Jika tidak direkod, ia tidak berlaku.
```

---

## 🛠️ Tech Stack

- **Database**: PostgreSQL 15+ (Supabase)
- **Backend**: TypeScript (Node.js / Deno)
- **Frontend**: React + Vite + Tailwind CSS
- **Auth**: Supabase Auth (with custom JWT claims)
- **Storage**: BYOS (tenant-owned) + Supabase Storage (demo)

---

## 📈 Status

| Component | Status |
|---|---|
| Database Schema | ✅ Live (22 tables) |
| RLS Policies | ✅ Active (27 policies) |
| Audit Trail | ✅ Auto-logged |
| Workflow Engine | ✅ 8 state machines |
| RBAC | ✅ 8 default roles |
| Automation | ✅ 11 default rules |
| Demo Tenant | ✅ SR Creative Print seeded |
| React Integration | ✅ Drop-in package ready |
| Owner User | ✅ Setup dengan JWT metadata |

---

## 📄 License

Proprietary — SR Creative Print & PrintOS HQ

---

**PRINT OS V1.0** — *Transaction First. Perfect Later.* 🚀
