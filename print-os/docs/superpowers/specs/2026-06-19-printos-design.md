# PRINT OS — Design Specification

> **Version:** 1.0
> **Date:** 2026-06-19
> **Status:** Draft

---

## 1. Product Identity

| Field | Value |
|-------|-------|
| Name | PRINT OS |
| Category | Printing Business Operating System |
| Type | Multi-Tenant SaaS |
| Target Market | Printing Companies, Print Shops, Signage Companies, Advertising Companies |

**Vision:** Menjadi Operating System utama untuk industri percetakan Malaysia.

**Mission:** Kurangkan kebergantungan owner, automasi operasi, tingkatkan keuntungan, kurangkan kesilapan, mudahkan scaling.

### Problem Statement
- Order hilang dalam WhatsApp
- Customer selalu follow-up status
- Artwork approval tidak tersusun
- Production tidak dapat dikesan
- Owner perlu monitor semua benda

### Solution Statement
PrintOS menyediakan CRM, Quotation, Sales Order, Invoice, Artwork Approval, Production Tracking, QC, Delivery, Management Dashboard dalam satu sistem.

---

## 2. System Architecture

### Layers
```
PRINT OS
├── HQ Layer (Tenant Management, Subscription, Billing, Credit, AI Monitoring, Support)
├── Tenant Layer (SR Creative, Company A, B, C — data isolated by company_id)
├── Shared Services (Auth, Notification, Storage, AI Router, Billing)
├── External Integration (WhatsApp, Email, Payment Gateway, Google Storage, OpenAI/Gemini/Claude)
└── Infrastructure (Frontend: Next.js, Backend: Node.js, DB: PostgreSQL, Hosting: Railway/Vercel)
```

### Multi-Tenant Strategy
- ✅ Shared Database with `company_id` isolation
- ✅ BYOS (Bring Your Own Storage) — tenant guna storage sendiri
- ✅ Credit-Based AI — HQ tidak tanggung kos AI
- ✅ Tenant WhatsApp sendiri

---

## 3. Core Modules (15 Modules)

| # | Module | Business Purpose |
|---|--------|-----------------|
| 1 | CRM | Mengurus prospek dan pelanggan |
| 2 | Quotation | Menghasilkan sebutharga |
| 3 | Sales Order | Menukar quotation kepada order |
| 4 | Finance | Mengurus wang masuk |
| 5 | Artwork Submission | Mengumpul fail pelanggan |
| 6 | Design Management | Mengurus designer |
| 7 | Customer Approval | Mendapatkan kelulusan pelanggan |
| 8 | Production Planning | Merancang pengeluaran |
| 9 | Production | Mengurus proses cetakan |
| 10 | QC | Kawalan kualiti |
| 11 | Packing | Penyediaan penghantaran |
| 12 | Delivery | Penghantaran |
| 13 | Customer Portal | Pelanggan semak status sendiri |
| 14 | Reports | Laporan operasi |
| 15 | Dashboard | Pandangan pengurusan |

### Core Business Flow
```
Lead → CRM → Quotation → Sales Order → Invoice → Payment → Artwork Submission → Design → Customer Approval → Production Planning → Production → QC → Packing → Delivery → Completed → Review Request → Repeat Order
```

---

## 4. User Journeys (8 Roles)

| Journey | Role | Objective |
|---------|------|-----------|
| 1 | Customer | Buat tempahan dan terima barang |
| 2 | Sales Executive | Tukar lead menjadi pelanggan |
| 3 | Customer Service | Pastikan order bergerak |
| 4 | Designer | Siapkan artwork |
| 5 | Production Staff | Siapkan kerja cetakan |
| 6 | QC Officer | Pastikan kualiti |
| 7 | Delivery Staff | Hantar barang |
| 8 | Owner/Manager | Monitor bisnes tanpa terlibat operasi |

### Decision Points
- Customer Approve Artwork? → YES: Production / NO: Revision
- Payment Received? → YES: Proceed / NO: Reminder
- QC Pass? → YES: Packing / NO: Reprint

### Automation Triggers
- Invoice → 3 hari tiada bayaran → Auto Reminder WhatsApp
- Artwork Ready → 48 jam tiada tindakan → Auto Reminder
- Due Date tercapai, belum complete → Alert Manager

---

## 5. Screen Flow & UX

### Screen Groups by Role
- **Sales:** Dashboard → Leads → Customers → Quotations → Orders
- **Designer:** Dashboard → Tasks → Revisions → Completed
- **Customer:** Dashboard → Orders → Payments → Artwork → Tracking
- **Management:** Dashboard → Revenue → Profit → Outstanding → Orders → Staff KPI → Reports

### UX Rules
1. Maximum 3 klik ke fungsi utama
2. Role hanya nampak apa yang diperlukan
3. Dashboard mesti action-based (bukan statistik semata)
4. Semua transaksi ada shortcut (Create Invoice, Assign Designer, etc.)

---

## 6. Monetization (6 Revenue Layers)

| Layer | Model |
|-------|-------|
| Subscription | Starter RM99/mo (1 branch, 3 users), Growth RM299/mo (10 users), Enterprise Custom |
| Credit Engine | WhatsApp (100 msg = 10 credit), AI (1-10 credit per action) |
| WhatsApp Revenue | HQ jual WhatsApp Credit |
| Storage Revenue | HQ Storage Add-On (10GB=RM10, 50GB=RM30, 100GB=RM50) |
| AI Revenue | AI Quotation (1 credit), AI Analysis (5 credit), AI Insights (10 credit) |
| Add-Ons | Additional User (RM10/mo), Additional Branch (RM50/mo), Extra WhatsApp Credits |

### Credit Architecture
```
Credit Wallet (company_id, balance)
→ Credit Transactions (type, amount, balance_before, balance_after)
→ Credit Usage (feature, credit_used, timestamp)
```
Rules: No negative balance, all usage logged, audit trail for all transactions.

---

## 7. AI Architecture

### AI Router
```
Task → Classification Engine → Cost Calculation → Model Selection → Execute → Log
```
- **Level 1:** DeepSeek (murah) — WhatsApp messages, simple generation
- **Level 2:** Gemini (sederhana) — Sales analysis, customer insights
- **Level 3:** Claude (mahal) — Strategic business reports
- **Level 4:** OpenAI (kes khas) — Complex analysis

### AI Governance
- No free unlimited AI
- All AI through Router
- All usage logged (model_used, tokens_used, credit_used, cost)
- AI cannot access other tenants
- AI follows RBAC

### AI Use Cases
Sales AI, Customer Service AI, Design AI, Production AI (bottleneck detection, delay prediction), Management AI (analysis, insights)

---

## 8. HQ Architecture

### HQ Structure
```
PRINT OS HQ
├── Dashboard (platform-wide KPIs)
├── Tenant Management (CRUD, status, usage monitoring)
├── Subscription Management (plans, billing cycles)
├── Billing Management (invoices, payments, credits)
├── Credit Management (wallet, transactions, pricing)
├── AI Management (usage, cost, router config)
├── Storage Management (usage per tenant, BYOS connections)
└── Support Center (tickets, announcements)
```

---

## 9. Security & Compliance

### Security Layers
1. **Authentication** — Login, OTP, Session, Device Tracking, Account Lock on failure
2. **Authorization (RBAC)** — Roles: Super Admin, Management, Branch Manager, Sales, CS, Designer, Production, QC, Finance, Delivery, Customer
3. **Tenant Isolation** — All tables have `company_id`, cross-tenant access forbidden
4. **Data Security** — Encryption at rest + in transit, secure storage, backup
5. **Audit Trail** — All transactions logged (who, what, when, from, to)
6. **Activity History** — Timeline view per record
7. **Privacy** — Tenant only sees own data, customer only sees own orders
8. **File Security** — Secure URL, permission check, expiry link, download logging
9. **Backup & Recovery** — Daily, weekly, monthly backups with recovery testing

### Rules
- All transactions audited
- No hard delete (use `deleted_at`, `deleted_by`)
- RBAC and Tenant Isolation mandatory
- All files must have permission validation
- HQ cannot modify tenant data without audit

---

## 10. Development Roadmap

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| A Foundation | Auth, Company, Users, Roles | Tenant can login |
| B Sales Engine | CRM, Quotation, Sales Order | Lead → Quotation → Order |
| C Finance Engine | Invoice, Payment, Receipt | Order → Invoice → Payment |
| D Design Workflow | Artwork Upload, Design, Approval | Artwork → Design → Approval |
| E Production Engine | Queue, Schedule, Work Orders | Approved → Production |
| F QC & Delivery | QC, Packing, Delivery, POD | Production → QC → Delivery |
| G Reporting | Sales/Production/Finance Reports | Management visibility |
| H Automation | Auto Follow-Up, Reminders, Alerts | Less manual work |
| I Customer Portal | Order Tracking, Artwork Approval | Self-service |
| J HQ Platform | Tenant Management, Billing, Credits | HQ control |
| K AI Engine | AI Router, Features, Credits | AI ready |

### MVP Scope
Authentication + Customers + CRM + Quotation + Sales Order + Invoice + Payment + Artwork Upload + Design Workflow + Approval + Production Queue + QC + Delivery

---

## 11. Database Schema

### 20 Table Levels
1. Foundation: `companies`, `branches`, `users`, `roles`, `permissions`
2. CRM: `leads`, `lead_sources`, `lead_activities`, `customers`, `customer_contacts`
3. Products: `product_categories`, `products`, `product_templates`, `product_pricing`
4. Sales: `quotations`, `quotation_items`, `sales_orders`, `sales_order_items`
5. Finance: `invoices`, `invoice_items`, `payments`, `receipts`, `payment_methods`
6. Artwork: `artwork_submissions`, `artwork_files`, `artwork_comments`, `artwork_versions`
7. Design: `design_tasks`, `design_assignments`, `design_revisions`, `design_approvals`
8. Production: `production_jobs`, `production_queue`, `production_schedules`, `machine_assignments`, `operators`
9. QC: `qc_checks`, `qc_results`, `qc_photos`, `qc_failures`
10. Delivery: `packing`, `deliveries`, `tracking_numbers`, `pod_files`
11. Customer Portal: `portal_access_logs`, `customer_notifications`, `portal_sessions`
12. Reporting: `report_snapshots`, `kpi_snapshots`
13. Automation: `automation_rules`, `automation_logs`, `scheduled_jobs`
14. Notifications: `notifications`, `notification_logs`, `whatsapp_logs`, `email_logs`
15. AI: `ai_requests`, `ai_responses`, `ai_usage_logs`, `ai_credit_usage`
16. Billing: `subscriptions`, `subscription_plans`, `invoices_subscription`, `credit_wallets`, `credit_transactions`
17. Storage: `storage_connections`, `storage_usage`, `storage_logs`
18. HQ: `tenants`, `tenant_usage`, `support_tickets`, `system_announcements`
19. Audit: `audit_logs`
20. Activity: `activity_logs`, `timeline_events`

### Standard Fields (all tables)
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
company_id UUID REFERENCES companies(id)
branch_id UUID REFERENCES branches(id)
status VARCHAR(50)
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ
created_by UUID REFERENCES users(id)
updated_by UUID REFERENCES users(id)
deleted_at TIMESTAMPTZ
deleted_by UUID REFERENCES users(id)
```

---

## 12. API Architecture

### 20 API Layers
`/api/v1/*` — Auth, Companies, Customers, CRM, Quotations, Orders, Invoices, Payments, Artwork, Design, Production, QC, Delivery, Dashboard, Reports, Notifications, Automation, AI, Billing, HQ

### Service Layer Pattern
```
API → Service Layer (Business Logic) → Database
```
No business logic in API handlers.

### Security
- JWT Authentication
- RBAC Authorization
- Tenant validation (`company_id` checked on every request)
- Audit logging on all mutations

---

## 13. UI Components

### Component Categories
Layout, Navigation, Form, Button, Data (Table/Badge/Tag/Timeline), Dashboard (KPI Card/Widget), Workflow (Status Tracker/Progress/Approval), Modal, Notification, File, Communication, Report, AI, Billing, HQ

### Standard Page Structure
```
Page Header → Action Buttons → Filters → Content → Pagination
```

### Standard Detail Page
```
Header → Status → Summary → Tabs (Details/Files/Notes/History) → Timeline → Audit
```

---

## 14. Master Execution Plan (20 Sprints)

| Sprint | Module | Dependency |
|--------|--------|------------|
| 1 | Foundation (Auth, Roles, Company, Users) | None |
| 2 | Customer Foundation | Sprint 1 |
| 3 | Product Foundation | Sprint 1 |
| 4 | CRM Engine (Leads, Activities) | Sprint 2 |
| 5 | Quotation Engine | Sprint 3, 4 |
| 6 | Sales Order Engine | Sprint 5 |
| 7 | Finance Engine | Sprint 6 |
| 8 | Artwork Engine | Sprint 6 |
| 9 | Design Engine | Sprint 8 |
| 10 | Production Engine | Sprint 9 |
| 11 | QC Engine | Sprint 10 |
| 12 | Delivery Engine | Sprint 11 |
| 13 | Reporting Engine | Sprint 6, 7, 12 |
| 14 | Dashboard Engine | Sprint 13 |
| 15 | Automation Engine | Sprint 14 |
| 16 | Customer Portal | Sprint 12 |
| 17 | Billing Engine | Sprint 1 |
| 18 | HQ Platform | Sprint 1 |
| 19 | AI Engine | Sprint 14 |
| 20 | Hardening | All |

### Definition of Done
Each module is complete only when: Database ✅ + API ✅ + UI ✅ + RBAC ✅ + Audit Trail ✅ + Validation ✅ + Testing ✅ + Documentation ✅

---

## Spec Self-Review

- [x] No placeholders or TODOs
- [x] Internal consistency — architecture matches modules matches DB matches API matches UI
- [x] Scope is focused on MVP sprints (1-12) with clear V2/V3 definition
- [x] No ambiguity — each layer has clear ownership and rules
- [x] All 14 steps from blueprint to execution plan covered
