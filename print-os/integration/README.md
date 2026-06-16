# PRINT OS — Integration Package

> **Drop-in React package untuk Replit / Vite apps**

Pakej ini membolehkan Replit app anda connect ke PRINT OS Supabase database dengan sekali copy.

---

## 📦 Isi Package

```
integration/
├── index.ts                      # Main exports
├── context/
│   └── PrintOSContext.tsx        # Auth provider + useAuth
├── hooks/
│   ├── useQuotations.ts          # Quotation CRUD hooks
│   ├── useSalesOrders.ts         # SO CRUD hooks
│   ├── useProduction.ts          # Production + QC + Delivery
│   ├── useCustomers.ts           # Customer list
│   └── useDashboard.ts           # 5 KPI + Owner Dashboard
├── services/
│   ├── quotationApi.ts           # Quotation REST wrapper
│   ├── salesOrderApi.ts          # SO REST wrapper
│   ├── productionApi.ts          # Production REST wrapper
│   └── dashboardApi.ts           # Dashboard + KPI
├── components/
│   ├── KPITile.tsx               # KPI cards + dashboard grid
│   ├── LoginPage.tsx             # Login UI
│   ├── QuotationForm.tsx         # Quotation form + list
│   └── SalesOrderCard.tsx        # SO card + list
├── utils/
│   └── supabase.ts               # Supabase client
├── types/
│   └── domain.ts                 # TypeScript types
└── examples/
    └── App.tsx                   # Complete example
```

---

## 🚀 Setup (5 minit)

### Step 1: Copy folder ke Replit

Salin `integration/` folder ke root project Replit anda.

```
my-replit-app/
└── integration/    ← copy sini
```

### Step 2: Install dependency

```bash
npm install @supabase/supabase-js
```

### Step 3: Set env variables

Dalam Replit, buka **Secrets** tab (icon kunci di sidebar), tambah:

```
VITE_SUPABASE_URL = https://ddvytkgskhegfjytwpqz.supabase.co
VITE_SUPABASE_ANON_KEY = <your-anon-key>
```

(Anda boleh dapat anon key dari Supabase Dashboard → Settings → API)

### Step 4: Replace App.tsx

Guna example yang diberi, atau import komponen dalam code anda:

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

  return (
    <div className="p-6">
      <h1>Hello {user.email}</h1>
      <DashboardGrid dashboard={...} />
    </div>
  );
}
```

### Step 5: Run

```bash
npm run dev
```

Login dengan:
- Email: `owner@srcreative.my`
- Password: (yang anda set di Supabase Auth)

---

## 🧩 Usage Examples

### Fetch Quotations

```tsx
import { useQuotations } from './integration/hooks/useQuotations';

function MyQuotations() {
  const { data, count, loading, error, refresh } = useQuotations({
    status: 'sent',
    page_size: 20,
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Total: {count}</p>
      {data.map((q) => (
        <div key={q.id}>{q.quotation_no} - RM {q.total}</div>
      ))}
    </div>
  );
}
```

### Create Quotation

```tsx
import { QuotationForm } from './integration/components/QuotationForm';

function NewQuotationPage() {
  return (
    <QuotationForm
      onSuccess={(q) => alert(`Created: ${q.quotation_no}`)}
      onCancel={() => history.back()}
    />
  );
}
```

### Transition SO Status

```tsx
import { SOCard } from './integration/components/SalesOrderCard';

function SOCardDemo() {
  return <SOCard so={soData} onAction={() => console.log('refresh')} />;
}
```

### Owner Dashboard

```tsx
import { DashboardGrid } from './integration/components/KPITile';
import { useDashboard } from './integration/hooks/useDashboard';

function OwnerHome() {
  const { dashboard, loading } = useDashboard();
  return <DashboardGrid dashboard={dashboard} loading={loading} />;
}
```

### Repeat Order Predictions

```tsx
import { useRepeatPredictions } from './integration/hooks/useDashboard';

function RepeatPage() {
  const { data, loading } = useRepeatPredictions();
  return (
    <div>
      {data.map((p) => (
        <div key={p.customer_id}>
          {p.customer_name} — {p.urgency}
        </div>
      ))}
    </div>
  );
}
```

### Direct API Call

```tsx
import { createQuotation, getOwnerDashboard } from './integration';

// Direct use
const quotation = await createQuotation({
  customer_id: '...',
  items: [{ product_name: 'Banner', quantity: 1, unit_price: 100, unit: 'pcs' }],
});

const dash = await getOwnerDashboard();
console.log(dash.month.total_revenue);
```

---

## 🎨 Styling

Package ini guna **Tailwind CSS** (utility classes). Pastikan Replit app anda ada Tailwind.

Jika takde Tailwind, tukar class names dalam components ikut CSS framework anda.

---

## 🔐 Security & RLS

Semua query melalui Supabase client (anon key). RLS di database level automatik tapis ikut company.

**PENTING:** Set `app_metadata.company_id` untuk setiap user (sudah dibuat untuk `owner@srcreative.my`). Tanpa ini, RLS akan block semua data.

---

## 📊 Apa Yang Anda Dapat

Selepas integrate, Replit app anda boleh:

1. ✅ **Login** dengan email/password Supabase
2. ✅ **Lihat dashboard** dengan 5 KPI + today/month stats
3. ✅ **Buat quotation** dengan items + auto-generate number
4. ✅ **Convert quotation ke SO** dengan satu klik
5. ✅ **Track SO workflow** (12 status) dengan transition validation
6. ✅ **Manage production** jobs, QC, delivery
7. ✅ **Lihat customer** list dengan search
8. ✅ **Prediksi repeat orders** berdasarkan history

Semua data automatically isolated by company melalui RLS.

---

## 🐛 Troubleshooting

### "Missing VITE_SUPABASE_URL"
Set env variable dalam Replit Secrets, **restart dev server**.

### "new row violates row-level security policy"
JWT `app_metadata.company_id` takde. Set manually dalam Supabase Dashboard → Authentication → Users → klik user → set raw_app_meta_data.

### Cost/margin fields kosong
User role bukan owner/management. Tukar role dalam `users` table atau `auth.users.raw_app_meta_data`.

### Hook returns loading forever
Check browser console untuk error. Usually RLS blocking. Test dengan SQL Editor untuk verify user ada access.

---

## 🆘 Support

Untuk issue / customization, contact HQ team atau rujuk:
- `SETUP.md` di root project — untuk database setup
- `schema/README.md` — untuk schema documentation
- `backend/workflows/stateMachines.ts` — untuk workflow rules

---

**PRINT OS Integration V1.0** — Multi-tenant SaaS untuk Visual Communication Industry
