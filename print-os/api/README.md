# PRINT OS API — Railway Deployment Guide

> **Deploy backend API ke Railway.app dalam 5 minit**

API server ini wrap semua business logic PRINT OS (quotations, sales orders, production, dashboard) dan connect ke Supabase database.

---

## Architecture

```
┌─────────────┐     HTTPS      ┌──────────────┐     Supabase      ┌──────────────┐
│  Replit App  │ ─────────────→ │  Railway API │ ────────────────→ │  Supabase DB  │
│  (Frontend)  │   Bearer JWT   │   (Hono)     │   RLS-protected   │   (HQ)        │
└─────────────┘                 └──────────────┘                   └──────────────┘
                                       │
                                       ├─ Hono HTTP server
                                       ├─ 6 route modules
                                       ├─ Auth middleware (JWT verify)
                                       └─ Cost-field filtering (RBAC)
```

**Database**: Supabase (multi-tenant, RLS-enabled)
**API**: Railway (Hono on Node.js)
**Frontend**: Replit (atau mana-mana)

---

## Quick Deploy (5 minit)

### Step 1: Create Railway Project

1. Pergi ke [railway.app](https://railway.app)
2. Sign in dengan GitHub
3. Klik **New Project** → **Deploy from GitHub repo**
4. Pilih repo `printos-bydeepseek` (atau nama repo anda)
5. Railway akan auto-detect struktur

### Step 2: Configure Service

1. Railway akan tunjuk service baru (default name akan jadi random)
2. Klik pada service tersebut
3. Pergi ke **Settings** tab:
   - **Root Directory**: `api`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### Step 3: Set Environment Variables

Pergi ke **Variables** tab, tambah:

| Variable | Value | Required |
|---|---|---|
| `PORT` | `3000` | Auto-set by Railway |
| `NODE_ENV` | `production` | ✅ |
| `SUPABASE_URL` | `https://ddvytkgskhegfjytwpqz.supabase.co` | ✅ |
| `SUPABASE_ANON_KEY` | `<from Supabase Dashboard>` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `<from Supabase Dashboard>` | ✅ |
| `ALLOWED_ORIGINS` | `*` (atau domain spesifik) | Optional |

**Dapat Supabase keys:**
1. Pergi ke [Supabase Dashboard](https://supabase.com/dashboard/project/ddvytkgskhegfjytwpqz/settings/api)
2. **Project URL** → copy ke `SUPABASE_URL`
3. **anon public** key → copy ke `SUPABASE_ANON_KEY`
4. **service_role** key → copy ke `SUPABASE_SERVICE_ROLE_KEY` (JANGAN expose ke client)

### Step 4: Deploy

Railway akan auto-deploy selepas environment variables diset. Tunggu build selesai (1-3 minit).

### Step 5: Verify

Railway akan assign URL seperti `https://your-app.up.railway.app`. Test:

```bash
# Health check (no auth)
curl https://your-app.up.railway.app/health

# Should return:
# {"status":"healthy","uptime":123,"timestamp":"..."}
```

Untuk test protected endpoint, perlukan JWT dari Supabase Auth.

---

## API Endpoints

### Health & Info (no auth)
- `GET /` — API info
- `GET /health` — Health check

### Quotations (auth required)
- `GET /api/v1/quotations` — List
- `GET /api/v1/quotations/:id` — Get single
- `POST /api/v1/quotations` — Create
- `PATCH /api/v1/quotations/:id` — Update (draft only)
- `POST /api/v1/quotations/:id/transition` — Change status
- `POST /api/v1/quotations/:id/convert-to-so` — Convert to SO

### Sales Orders
- `GET /api/v1/sales-orders` — List
- `GET /api/v1/sales-orders/:id` — Get single
- `POST /api/v1/sales-orders` — Create
- `PATCH /api/v1/sales-orders/:id` — Update
- `POST /api/v1/sales-orders/:id/transition` — Status transition (with side effects)

### Production / QC / Delivery
- `GET /api/v1/production/jobs` — List jobs
- `POST /api/v1/production/jobs/:id/transition` — Job status
- `GET /api/v1/production/bottlenecks` — Detection
- `POST /api/v1/production/qc` — Create QC
- `POST /api/v1/production/qc/:id/transition` — QC status
- `POST /api/v1/production/delivery/:id/transition` — Delivery status

### Dashboard
- `GET /api/v1/dashboard/owner` — Full owner dashboard
- `GET /api/v1/dashboard/repeat-predictions` — Repeat orders
- `GET /api/v1/dashboard/revenue-trend` — Time series

### Customers
- `GET /api/v1/customers` — List
- `POST /api/v1/customers` — Create
- `GET /api/v1/customers/:id` — Get with orders

---

## Auth

Semua endpoint (kecuali `/` dan `/health`) perlukan **Bearer JWT**:

```bash
curl -H "Authorization: Bearer <jwt-token>" \
  https://your-app.up.railway.app/api/v1/quotations
```

JWT didatangkan dari Supabase Auth (`supabase.auth.signInWithPassword`). API verify token, extract `app_metadata.company_id` & `role`, set sebagai context untuk RLS.

---

## Local Development

```bash
cd api
npm install
cp .env.example .env
# Edit .env — isi Supabase keys
npm run dev   # Uses tsx watch
```

Test:
```bash
curl http://localhost:3000/
curl http://localhost:3000/health
```

---

## Deployment Checklist

- [ ] Railway project created
- [ ] Root directory: `api`
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm start`
- [ ] Environment variables set
- [ ] Deploy successful
- [ ] Health endpoint returns 200
- [ ] Auth endpoint test with real JWT
- [ ] Frontend updated to use Railway URL

---

## Cost Estimation

**Railway Hobby Plan**: $5/month (500 hours, 8GB RAM)
**Usage**: API server boleh handle ~10K requests/day dalam tier ni
**Supabase Free**: 500MB database, 2GB bandwidth — cukup untuk demo

Production estimate: ~$25-50/bulan untuk Railway + Supabase Pro.

---

## Troubleshooting

### "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
Set variables dalam Railway Variables tab. Restart service.

### 401 Unauthorized
JWT expired atau invalid. User perlu login semula.

### "User missing company context"
JWT app_metadata takde company_id. Fix dalam Supabase:
```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'company_id', '<uuid>',
  'role', 'owner',
  'role_id', '<uuid>'
)
where email = 'user@email.com';
```

### Cost fields kosong dalam response
Role user bukan owner/management. Tukar role dalam `users` table.

### Railway build failed
Check Build Logs. Common issues:
- `npm install` timeout (Railway limit)
- TypeScript errors (run `npm run build` locally first)
- Missing env vars (deploy will succeed but runtime will fail)

---

## Security Notes

- **Service role key** boleh bypass RLS — JANGAN expose ke frontend
- **Anon key** selamat untuk frontend — RLS akan auto-filter
- Railway dashboard — limit akses untuk team sahaja
- Set CORS `ALLOWED_ORIGINS` untuk production (jangan `*`)

---

**PRINT OS API V1.0** — Production-ready backend
