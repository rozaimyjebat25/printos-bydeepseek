-- =====================================================================
-- PRINT OS — DATABASE SCHEMA V1.0
-- System of Record + Workflow Engine untuk Visual Communication Operations
-- =====================================================================
-- Stack: PostgreSQL 15+ / Supabase
-- Multi-tenant SaaS dengan Row Level Security (RLS)
-- Metadata-only di HQ. Storage fail diuruskan oleh tenant (BYOS).
-- =====================================================================

-- ============================
-- 0. EXTENSIONS
-- ============================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ============================
-- 1. SUPER ADMIN (HQ)
-- ============================
-- Akaun ini milik PrintOS HQ, bukan tenant.
-- Untuk akses ke tenant management, billing, system monitoring.
create table if not exists super_admins (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'hq_admin',  -- hq_owner, hq_admin, hq_support, hq_finance
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================
-- 2. COMPANIES (Tenants)
-- ============================
create table if not exists companies (
  id                      uuid primary key default uuid_generate_v4(),
  name                    text not null,
  registration_no         text,                          -- SSM no
  email                   text,
  phone                   text,
  address                 text,
  city                    text,
  state                   text,
  country                 text default 'Malaysia',
  logo_url                text,

  -- Subscription & Plan
  plan                    text default 'starter',        -- starter | growth | pro | enterprise
  plan_status             text default 'trial',          -- trial | active | suspended | cancelled
  trial_ends_at           timestamptz,
  subscription_starts_at  timestamptz,
  subscription_ends_at    timestamptz,

  -- Limits
  user_limit              int default 5,
  branch_limit            int default 1,

  -- BYOS Configuration
  storage_provider        text,                          -- google_drive | gcs | s3 | wasabi | backblaze | supabase
  storage_type            text default 'byos',           -- byos | managed
  storage_status          text default 'pending',        -- pending | active | error | suspended
  storage_quota_gb        numeric(10,2),                 -- null jika byos
  storage_connected_at    timestamptz,
  storage_error_message   text,
  storage_last_checked_at timestamptz,
  storage_config          jsonb default '{}'::jsonb,     -- encrypted credentials blob

  -- AI Configuration
  ai_provider             text,                          -- openai | gemini | claude | deepseek
  ai_status               text default 'pending',        -- pending | active | error
  ai_credits_remaining    int default 0,
  ai_config               jsonb default '{}'::jsonb,     -- encrypted api key blob

  -- WhatsApp / SMTP / SMS (tenant-owned)
  whatsapp_provider       text,                          -- ultramsg | meta | twilio
  whatsapp_status         text default 'pending',
  whatsapp_config         jsonb default '{}'::jsonb,
  smtp_config             jsonb default '{}'::jsonb,

  -- Metadata
  is_active               boolean default true,
  created_by              uuid,
  created_at              timestamptz default now(),
  updated_by              uuid,
  updated_at              timestamptz default now()
);

create index if not exists idx_companies_plan on companies(plan);
create index if not exists idx_companies_status on companies(plan_status);

-- ============================
-- 3. BRANCHES
-- ============================
create table if not exists branches (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,
  code          text,                                   -- SRCP-JB, SRCP-KL
  address       text,
  city          text,
  state         text,
  phone         text,
  is_main       boolean default false,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  deleted_at    timestamptz
);

create index if not exists idx_branches_company on branches(company_id);

-- ============================
-- 4. ROLES (Per-company customisable)
-- ============================
create table if not exists roles (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,                          -- Owner, Management, Manager, Sales Exec, Designer, Production, Supplier Coord, Customer
  key           text not null,                          -- owner, management, manager, sales, designer, production, supplier, customer
  description   text,
  is_system     boolean default false,                  -- system roles cannot be deleted
  permissions   jsonb default '{}'::jsonb,               -- RBAC matrix
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(company_id, key)
);

-- ============================
-- 5. USERS
-- ============================
create table if not exists users (
  id              uuid primary key references auth.users(id) on delete cascade,
  company_id      uuid not null references companies(id) on delete cascade,
  branch_id       uuid references branches(id) on delete set null,
  role_id         uuid references roles(id) on delete set null,
  full_name       text not null,
  email           text not null,
  phone           text,
  avatar_url      text,
  is_active       boolean default true,
  last_login_at   timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);

create index if not exists idx_users_company on users(company_id);
create index if not exists idx_users_branch on users(branch_id);
create index if not exists idx_users_email on users(email);

-- ============================
-- 6. CUSTOMERS
-- ============================
create table if not exists customers (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  branch_id       uuid references branches(id) on delete set null,
  customer_code   text,                                  -- auto-generated CUST-0001
  name            text not null,
  company_name    text,
  email           text,
  phone           text,
  whatsapp_no     text,
  address         text,
  city            text,
  state           text,
  customer_type   text default 'individual',            -- individual | business
  industry_tag    text,                                  -- sekolah | korporat | wedding | kerajaan | retail | f&b

  -- CRM data
  source          text,                                  -- walk-in | referral | facebook | instagram | website | whatsapp
  tags            text[],
  notes           text,

  -- LTV tracking
  total_orders    int default 0,
  total_revenue   numeric(14,2) default 0,
  last_order_at   timestamptz,

  is_active       boolean default true,
  created_by      uuid,
  created_at      timestamptz default now(),
  updated_by      uuid,
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);

create index if not exists idx_customers_company on customers(company_id);
create index if not exists idx_customers_phone on customers(phone);
create index if not exists idx_customers_industry on customers(industry_tag);

-- ============================
-- 7. LEADS
-- ============================
create table if not exists leads (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  branch_id       uuid references branches(id) on delete set null,
  customer_id     uuid references customers(id) on delete set null,  -- converted customer
  name            text not null,
  contact         text,
  email           text,
  source          text,                                  -- facebook, instagram, walk-in, referral, website
  status          text default 'new',                    -- new | contacted | qualified | quotation_sent | won | lost
  estimated_value numeric(14,2),
  notes           text,
  assigned_to     uuid references users(id) on delete set null,
  converted_at    timestamptz,
  lost_reason     text,
  created_by      uuid,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);

create index if not exists idx_leads_company_status on leads(company_id, status);
create index if not exists idx_leads_assigned on leads(assigned_to);

-- ============================
-- 8. QUOTATIONS
-- ============================
create table if not exists quotations (
  id                  uuid primary key default uuid_generate_v4(),
  company_id          uuid not null references companies(id) on delete cascade,
  branch_id           uuid references branches(id) on delete set null,
  quotation_no        text not null,                      -- QT-250001
  customer_id         uuid not null references customers(id),
  lead_id             uuid references leads(id) on delete set null,

  -- Financial
  subtotal            numeric(14,2) default 0,
  discount_amount     numeric(14,2) default 0,
  discount_percent    numeric(5,2) default 0,
  tax_percent         numeric(5,2) default 0,             -- SST
  tax_amount          numeric(14,2) default 0,
  total               numeric(14,2) default 0,

  -- Cost visibility (Owner/Finance only)
  cost_total          numeric(14,2) default 0,
  gross_profit        numeric(14,2) default 0,
  margin_percent      numeric(5,2) default 0,

  valid_until         date,
  status              text default 'draft',               -- draft | sent | approved | rejected | expired | converted
  approved_at         timestamptz,
  converted_to_so     uuid,                               -- sales_order id (set after conversion)
  notes               text,
  terms               text,
  created_by          uuid,
  created_at          timestamptz default now(),
  updated_by          uuid,
  updated_at          timestamptz default now(),
  deleted_at          timestamptz
);

create index if not exists idx_quotations_company on quotations(company_id);
create index if not exists idx_quotations_customer on quotations(customer_id);
create index if not exists idx_quotations_status on quotations(company_id, status);
create unique index if not exists idx_quotations_no on quotations(company_id, quotation_no);

-- ============================
-- 9. QUOTATION ITEMS
-- ============================
create table if not exists quotation_items (
  id                  uuid primary key default uuid_generate_v4(),
  quotation_id        uuid not null references quotations(id) on delete cascade,
  product_category    text,                              -- banner | sticker | kad_kahwin | buku_program | etc
  product_name        text not null,
  description         text,
  width               numeric(10,2),                     -- in cm/inch
  height              numeric(10,2),
  quantity            int default 1,
  unit                text default 'pcs',
  unit_price          numeric(14,2) default 0,
  cost_per_unit       numeric(14,2) default 0,            -- OWNER/FINANCE ONLY
  line_total          numeric(14,2) default 0,
  notes               text,
  sort_order          int default 0,
  created_at          timestamptz default now()
);

create index if not exists idx_quotation_items_quotation on quotation_items(quotation_id);

-- ============================
-- 10. SALES ORDERS
-- ============================
create table if not exists sales_orders (
  id                  uuid primary key default uuid_generate_v4(),
  company_id          uuid not null references companies(id) on delete cascade,
  branch_id           uuid references branches(id) on delete set null,
  so_number           text not null,                      -- SO-250001
  customer_id         uuid not null references customers(id),
  quotation_id        uuid references quotations(id) on delete set null,

  -- Status workflow
  status              text default 'pending_artwork',     -- pending_artwork | design_in_progress | approval_pending | artwork_approved | in_production | qc | packing | ready | out_for_delivery | delivered | completed | cancelled

  -- Financial
  subtotal            numeric(14,2) default 0,
  discount_amount     numeric(14,2) default 0,
  tax_amount          numeric(14,2) default 0,
  total               numeric(14,2) default 0,
  paid_amount         numeric(14,2) default 0,
  outstanding_amount  numeric(14,2) default 0,

  cost_total          numeric(14,2) default 0,
  gross_profit        numeric(14,2) default 0,
  margin_percent      numeric(5,2) default 0,

  -- Production
  production_type     text default 'inhouse',             -- inhouse | outsource | mixed
  due_date            date,
  rush_order          boolean default false,

  -- Delivery
  delivery_type       text default 'self_collect',        -- self_collect | courier
  delivery_address    text,
  courier_name        text,
  tracking_no         text,
  delivered_at        timestamptz,

  -- Artwork
  artwork_status      text default 'pending',             -- pending | assigned | in_design | revision | approved
  artwork_approved_at timestamptz,
  artwork_approved_by text,                                -- customer name / signature

  -- Audit
  notes               text,
  internal_notes      text,                                -- staff only
  created_by          uuid,
  created_at          timestamptz default now(),
  updated_by          uuid,
  updated_at          timestamptz default now(),
  deleted_at          timestamptz
);

create index if not exists idx_so_company_status on sales_orders(company_id, status);
create index if not exists idx_so_customer on sales_orders(customer_id);
create index if not exists idx_so_due_date on sales_orders(due_date);
create unique index if not exists idx_so_no on sales_orders(company_id, so_number);

-- ============================
-- 11. SALES ORDER ITEMS
-- ============================
create table if not exists sales_order_items (
  id                  uuid primary key default uuid_generate_v4(),
  sales_order_id      uuid not null references sales_orders(id) on delete cascade,
  product_category    text,
  product_name        text not null,
  description         text,
  width               numeric(10,2),
  height              numeric(10,2),
  quantity            int default 1,
  unit                text default 'pcs',
  unit_price          numeric(14,2) default 0,
  cost_per_unit       numeric(14,2) default 0,
  line_total          numeric(14,2) default 0,
  notes               text,
  sort_order          int default 0,
  created_at          timestamptz default now()
);

create index if not exists idx_so_items_so on sales_order_items(sales_order_id);

-- ============================
-- 12. ARTWORKS
-- ============================
create table if not exists artworks (
  id                  uuid primary key default uuid_generate_v4(),
  company_id          uuid not null references companies(id) on delete cascade,
  sales_order_id      uuid not null references sales_orders(id) on delete cascade,
  item_id             uuid references sales_order_items(id) on delete set null,

  status              text default 'pending_assignment', -- pending_assignment | assigned | in_design | internal_review | ready_for_approval | revision_requested | approved | released

  assigned_designer   uuid references users(id) on delete set null,
  assigned_at         timestamptz,

  -- File storage — URL only, BYOS
  final_file_url      text,                                -- signed URL (PDF Print Ready)
  source_file_url     text,                                -- AI / CDR / PSD
  preview_url         text,                                -- JPG preview

  -- Approval
  approval_link       text unique,
  approval_token      text unique,
  approval_status     text default 'pending',              -- pending | approved | revision | expired
  approval_expires_at timestamptz,
  approved_at         timestamptz,
  approved_by_name    text,
  approved_ip         text,

  released_at         timestamptz,
  released_by         uuid,

  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_artworks_so on artworks(sales_order_id);
create index if not exists idx_artworks_status on artworks(company_id, status);
create index if not exists idx_artworks_designer on artworks(assigned_designer);

-- ============================
-- 13. DESIGN REVISIONS
-- ============================
create table if not exists design_revisions (
  id                  uuid primary key default uuid_generate_v4(),
  artwork_id          uuid not null references artworks(id) on delete cascade,
  version_no          int not null,
  file_url            text,                                -- URL in tenant storage
  requested_by        text,                                -- customer name OR staff name
  requested_by_type   text,                                -- customer | staff
  comments            text,
  status              text default 'pending',              -- pending | completed | rejected
  created_at          timestamptz default now(),
  completed_at        timestamptz
);

create index if not exists idx_revisions_artwork on design_revisions(artwork_id);

-- ============================
-- 14. PRODUCTION JOBS
-- ============================
create table if not exists production_jobs (
  id                  uuid primary key default uuid_generate_v4(),
  company_id          uuid not null references companies(id) on delete cascade,
  sales_order_id      uuid not null references sales_orders(id) on delete cascade,
  branch_id           uuid references branches(id) on delete set null,

  job_number          text not null,                       -- JOB-250615-001
  production_type     text default 'inhouse',              -- inhouse | outsource

  -- For inhouse
  machine_id          uuid,                                -- references machines (future)
  operator_id         uuid references users(id) on delete set null,

  -- For outsource
  supplier_id         uuid,                                -- references suppliers (future)
  po_number           text,
  po_sent_at          timestamptz,
  expected_receive_at date,
  received_at         timestamptz,

  status              text default 'waiting_schedule',     -- waiting_schedule | scheduled | printing | finishing | qc | packing | ready | delivered | cancelled
  scheduled_at        timestamptz,
  started_at          timestamptz,
  finished_at         timestamptz,
  due_date            date,

  -- Receiving checklist (for outsource)
  receiving_checklist jsonb default '{}'::jsonb,
  receiving_photos    text[],                              -- array of URLs in BYOS

  notes               text,
  created_by          uuid,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_prod_company_status on production_jobs(company_id, status);
create index if not exists idx_prod_so on production_jobs(sales_order_id);
create index if not exists idx_prod_due on production_jobs(due_date);
create unique index if not exists idx_prod_no on production_jobs(company_id, job_number);

-- ============================
-- 15. QC RECORDS
-- ============================
create table if not exists qc_records (
  id                  uuid primary key default uuid_generate_v4(),
  company_id          uuid not null references companies(id) on delete cascade,
  production_job_id   uuid not null references production_jobs(id) on delete cascade,
  qc_staff_id         uuid references users(id) on delete set null,

  status              text default 'pending',              -- pending | passed | failed | rework
  checklist           jsonb default '{}'::jsonb,           -- structured QC items
  defects             text[],
  rework_required     boolean default false,
  rework_notes        text,

  photos              text[],                              -- array of URLs in BYOS

  passed_at           timestamptz,
  failed_at           timestamptz,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_qc_company_status on qc_records(company_id, status);
create index if not exists idx_qc_job on qc_records(production_job_id);

-- ============================
-- 16. DELIVERIES
-- ============================
create table if not exists deliveries (
  id                  uuid primary key default uuid_generate_v4(),
  company_id          uuid not null references companies(id) on delete cascade,
  sales_order_id      uuid not null references sales_orders(id) on delete cascade,

  delivery_type       text default 'self_collect',        -- self_collect | courier
  status              text default 'pending',              -- pending | packed | booked | in_transit | delivered | failed

  -- Courier
  courier_name        text,
  tracking_no         text,
  booked_at           timestamptz,
  collected_at        timestamptz,
  expected_delivery   date,
  delivered_at        timestamptz,

  -- Self collect
  ready_at            timestamptz,
  pickup_deadline     date,
  picked_up_at        timestamptz,
  picked_up_by_name   text,
  picked_up_by_ic     text,

  -- Proof of delivery
  pod_signature_url   text,                                -- URL in BYOS
  pod_photo_url       text,
  pod_notes           text,

  recipient_name      text,
  recipient_phone     text,

  created_by          uuid,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_deliveries_company_status on deliveries(company_id, status);
create index if not exists idx_deliveries_so on deliveries(sales_order_id);

-- ============================
-- 17. INVOICES
-- ============================
create table if not exists invoices (
  id                  uuid primary key default uuid_generate_v4(),
  company_id          uuid not null references companies(id) on delete cascade,
  sales_order_id      uuid references sales_orders(id) on delete set null,
  customer_id         uuid not null references customers(id),
  branch_id           uuid references branches(id) on delete set null,

  invoice_number      text not null,                       -- INV-250001
  invoice_date        date default current_date,
  due_date            date,

  subtotal            numeric(14,2) default 0,
  discount_amount     numeric(14,2) default 0,
  tax_amount          numeric(14,2) default 0,
  total               numeric(14,2) default 0,
  paid_amount         numeric(14,2) default 0,
  outstanding_amount  numeric(14,2) default 0,

  status              text default 'unpaid',               -- unpaid | partial | paid | overdue | cancelled
  pdf_url             text,                                -- BYOS URL
  notes               text,
  internal_notes      text,
  created_by          uuid,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  deleted_at          timestamptz
);

create index if not exists idx_invoices_company_status on invoices(company_id, status);
create index if not exists idx_invoices_customer on invoices(customer_id);
create index if not exists idx_invoices_due on invoices(due_date);
create unique index if not exists idx_invoices_no on invoices(company_id, invoice_number);

-- ============================
-- 18. PAYMENTS
-- ============================
create table if not exists payments (
  id                  uuid primary key default uuid_generate_v4(),
  company_id          uuid not null references companies(id) on delete cascade,
  invoice_id          uuid not null references invoices(id) on delete cascade,
  customer_id         uuid not null references customers(id),

  payment_date        timestamptz default now(),
  amount              numeric(14,2) not null,
  payment_method      text,                                -- cash | bank_transfer | cheque | card | ewallet
  reference_no        text,                                -- bank ref / cheque no
  receipt_url         text,                                -- BYOS URL
  notes               text,
  received_by         uuid references users(id) on delete set null,
  created_by          uuid,
  created_at          timestamptz default now()
);

create index if not exists idx_payments_invoice on payments(invoice_id);
create index if not exists idx_payments_customer on payments(customer_id);
create index if not exists idx_payments_date on payments(payment_date);

-- ============================
-- 19. AUDIT LOGS (Global)
-- ============================
create table if not exists audit_logs (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid references companies(id) on delete cascade,
  user_id         uuid references users(id) on delete set null,
  action          text not null,                          -- CREATE | UPDATE | DELETE | VIEW | LOGIN | LOGOUT | APPROVE | REJECT | EXPORT
  module          text not null,                          -- orders | quotations | invoices | artworks | production | qc | deliveries | users | settings
  record_id       uuid,
  record_type     text,                                  -- table name
  old_value       jsonb,
  new_value       jsonb,
  ip_address      inet,
  user_agent      text,
  device          text,
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz default now()
);

create index if not exists idx_audit_company_module on audit_logs(company_id, module);
create index if not exists idx_audit_user on audit_logs(user_id);
create index if not exists idx_audit_record on audit_logs(record_id);
create index if not exists idx_audit_created on audit_logs(created_at desc);

-- ============================
-- 20. TENANT FEATURES (License Control)
-- ============================
create table if not exists tenant_features (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  feature_key     text not null,                          -- crm | quotation | production | finance | customer_portal | ai | storage
  is_enabled      boolean default true,
  limit_value     numeric(14,2),                          -- quota (e.g. 1000 ai credits)
  used_value      numeric(14,2) default 0,
  valid_from      timestamptz default now(),
  valid_until     timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(company_id, feature_key)
);

create index if not exists idx_tenant_features_company on tenant_features(company_id);

-- ============================
-- 21. USAGE LOGS (For Resource / Product Intelligence)
-- ============================
create table if not exists usage_logs (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  user_id         uuid references users(id) on delete set null,
  feature_key     text,                                   -- ai | storage | whatsapp | email | automation
  action_type     text,                                   -- api_call | file_upload | message_sent | email_sent | job_run
  provider        text,                                   -- openai | gcs | ultramsg
  quantity        numeric(14,2) default 1,
  cost_estimate   numeric(14,2) default 0,                -- in RM for HQ analytics
  metadata        jsonb default '{}'::jsonb,
  logged_at       timestamptz default now()
);

create index if not exists idx_usage_company_feature on usage_logs(company_id, feature_key);
create index if not exists idx_usage_logged on usage_logs(logged_at desc);

-- ============================
-- 22. NOTIFICATIONS
-- ============================
create table if not exists notifications (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  user_id         uuid references users(id) on delete cascade,
  title           text not null,
  message         text,
  type            text default 'info',                    -- info | success | warning | error
  module          text,
  record_id       uuid,
  is_read         boolean default false,
  read_at         timestamptz,
  action_url      text,
  created_at      timestamptz default now()
);

create index if not exists idx_notif_user_unread on notifications(user_id, is_read);
create index if not exists idx_notif_company on notifications(company_id);

-- ============================
-- 23. UPDATED_AT TRIGGER
-- ============================
create or replace function fn_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to tables with updated_at
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'super_admins','companies','branches','roles','users','customers',
      'leads','quotations','sales_orders','artworks','production_jobs',
      'qc_records','deliveries','invoices','tenant_features'
    ])
  loop
    execute format('
      drop trigger if exists trg_set_updated_at on %I;
      create trigger trg_set_updated_at
        before update on %I
        for each row execute function fn_set_updated_at();
    ', t, t);
  end loop;
end $$;

-- ============================
-- 24. AUTO-GENERATE SO / QUOTATION / INVOICE NUMBER
-- ============================
create or replace function fn_generate_doc_number(p_company_id uuid, p_prefix text, p_table text, p_column text)
returns text as $$
declare
  v_count int;
  v_year text;
  v_number text;
begin
  v_year := to_char(current_date, 'YY');
  execute format('select count(*) from %I where company_id = $1 and %I like $2', p_table, p_column)
    into v_count
    using p_company_id, p_prefix || '-' || v_year || '%';

  v_number := p_prefix || '-' || v_year || lpad((v_count + 1)::text, 5, '0');
  return v_number;
end;
$$ language plpgsql;

-- ============================
-- 25. UPDATED_AT TRIGGER FOR PRODUCTION JOBS (no updated_at column by default — added)
-- ============================
alter table production_jobs add column if not exists updated_at timestamptz default now();
alter table qc_records add column if not exists updated_at timestamptz default now();
alter table deliveries add column if not exists updated_at timestamptz default now();

-- ============================
-- END OF SCHEMA
-- ============================
-- Next file: rls_policies.sql (Row Level Security for multi-tenant isolation)
-- Next file: seed_demo_srcreative.sql (Demo tenant data for SR Creative Print)
-- ============================
