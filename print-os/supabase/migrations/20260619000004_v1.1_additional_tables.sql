-- =====================================================================
-- PRINT OS — V1.1 ADDITIONAL TABLES
-- Products, Permissions, Contacts, Activities, AI, Billing, HQ, Automation
-- =====================================================================

-- ============================
-- 1. PRODUCT CATEGORIES
-- ============================
create table if not exists product_categories (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  name            text not null,
  code            text,
  description     text,
  parent_id       uuid references product_categories(id) on delete set null,
  sort_order      int default 0,
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);
create index if not exists idx_prod_cat_company on product_categories(company_id);

-- ============================
-- 2. PRODUCTS
-- ============================
create table if not exists products (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  category_id     uuid references product_categories(id) on delete set null,
  name            text not null,
  code            text,
  description     text,
  unit            text default 'pcs',
  default_price   numeric(14,2) default 0,
  default_cost    numeric(14,2) default 0,
  width           numeric(10,2),
  height          numeric(10,2),
  material        text,
  finish          text,
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);
create index if not exists idx_products_company on products(company_id);
create index if not exists idx_products_category on products(category_id);

-- ============================
-- 3. PRODUCT TEMPLATES
-- ============================
create table if not exists product_templates (
  id                uuid primary key default uuid_generate_v4(),
  company_id        uuid not null references companies(id) on delete cascade,
  name              text not null,
  description       text,
  category_id       uuid references product_categories(id) on delete set null,
  default_width     numeric(10,2),
  default_height    numeric(10,2),
  default_unit      text,
  default_price     numeric(14,2) default 0,
  default_cost      numeric(14,2) default 0,
  config            jsonb default '{}'::jsonb,
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  deleted_at        timestamptz
);
create index if not exists idx_prod_tmpl_company on product_templates(company_id);

-- ============================
-- 4. PRODUCT PRICING (tiered)
-- ============================
create table if not exists product_pricing (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  product_id      uuid not null references products(id) on delete cascade,
  min_qty         int not null default 1,
  max_qty         int,
  unit_price      numeric(14,2) not null,
  cost_per_unit   numeric(14,2),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_prod_price_product on product_pricing(product_id);

-- ============================
-- 5. LEAD SOURCES
-- ============================
create table if not exists lead_sources (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  name            text not null,
  code            text,
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);
create index if not exists idx_lead_src_company on lead_sources(company_id);

-- ============================
-- 6. LEAD ACTIVITIES
-- ============================
create table if not exists lead_activities (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  lead_id         uuid not null references leads(id) on delete cascade,
  type            text not null,
  description     text,
  notes           text,
  follow_up_at    timestamptz,
  completed_at    timestamptz,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz default now()
);
create index if not exists idx_lead_act_lead on lead_activities(lead_id);

-- ============================
-- 7. CUSTOMER CONTACTS
-- ============================
create table if not exists customer_contacts (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade,
  name            text not null,
  position        text,
  email           text,
  phone           text,
  mobile          text,
  is_primary      boolean default false,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);
create index if not exists idx_cust_contact_customer on customer_contacts(customer_id);

-- ============================
-- 8. ACTIVITY LOGS (user-facing timeline)
-- ============================
create table if not exists activity_logs (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  user_id         uuid references users(id) on delete set null,
  module          text not null,
  record_id       uuid,
  action          text not null,
  description     text,
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz default now()
);
create index if not exists idx_activity_company on activity_logs(company_id);
create index if not exists idx_activity_record on activity_logs(module, record_id);
create index if not exists idx_activity_created on activity_logs(created_at desc);

-- ============================
-- 9. AI TABLES
-- ============================
create table if not exists ai_requests (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  user_id         uuid references users(id) on delete set null,
  feature         text not null,
  model_used      text,
  prompt_tokens   int default 0,
  completion_tokens int default 0,
  total_tokens    int default 0,
  credit_cost     numeric(10,2) default 0,
  cost_estimate   numeric(14,6) default 0,
  status          text default 'completed',
  duration_ms     int,
  created_at      timestamptz default now()
);
create index if not exists idx_ai_req_company on ai_requests(company_id);
create index if not exists idx_ai_req_feature on ai_requests(feature);

create table if not exists ai_usage_logs (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  month           date not null,
  feature         text not null,
  request_count   int default 0,
  total_tokens    int default 0,
  total_cost      numeric(14,6) default 0,
  credits_used    numeric(10,2) default 0,
  unique(company_id, month, feature)
);

-- ============================
-- 10. BILLING TABLES
-- ============================
create table if not exists subscription_plans (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  code            text unique not null,
  description     text,
  price_monthly   numeric(14,2) not null,
  price_yearly    numeric(14,2),
  user_limit      int default 5,
  branch_limit    int default 1,
  features        jsonb default '{}'::jsonb,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

insert into subscription_plans (name, code, description, price_monthly, price_yearly, user_limit, branch_limit)
values
  ('Starter', 'starter', 'Untuk print shop kecil. 1 cawangan, 3 pengguna.', 99, 999, 3, 1),
  ('Growth', 'growth', 'Untuk syarikat sederhana. 10 pengguna, laporan lanjutan.', 299, 2999, 10, 3),
  ('Pro', 'pro', 'Untuk syarikat besar. Pengguna tanpa had, AI + automation.', 599, 5999, 999, 99),
  ('Enterprise', 'enterprise', 'Harga khas untuk keperluan spesifik.', 0, 0, 999, 999)
on conflict (code) do nothing;

create table if not exists credit_wallets (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  balance         numeric(14,2) default 0,
  total_purchased numeric(14,2) default 0,
  total_used      numeric(14,2) default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(company_id)
);

create table if not exists credit_transactions (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  type            text not null, -- purchase | usage | refund | bonus
  amount          numeric(14,2) not null,
  balance_before  numeric(14,2) not null,
  balance_after   numeric(14,2) not null,
  reference       text,
  description     text,
  created_at      timestamptz default now()
);
create index if not exists idx_credit_tx_company on credit_transactions(company_id);

-- ============================
-- 11. STORAGE TABLES
-- ============================
create table if not exists storage_connections (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  provider        text not null, -- google_drive | gcs | s3 | wasabi
  config          jsonb default '{}'::jsonb,
  status          text default 'pending',
  connected_at    timestamptz,
  last_checked_at timestamptz,
  error_message   text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists storage_usage (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  month           date not null,
  bytes_used      numeric(20,0) default 0,
  file_count      int default 0,
  unique(company_id, month)
);

-- ============================
-- 12. SUPPORT TICKETS (HQ)
-- ============================
create table if not exists support_tickets (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  user_id         uuid references users(id) on delete set null,
  subject         text not null,
  description     text,
  priority        text default 'normal', -- low | normal | high | urgent
  status          text default 'open', -- open | in_progress | waiting_reply | resolved | closed
  assigned_to     uuid, -- super_admin id
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  resolved_at     timestamptz
);
create index if not exists idx_tickets_company on support_tickets(company_id);

create table if not exists system_announcements (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  message         text,
  priority        text default 'info', -- info | warning | maintenance | critical
  target_roles    text[], -- null = all tenants
  starts_at       timestamptz default now(),
  ends_at         timestamptz,
  created_by      uuid,
  created_at      timestamptz default now()
);

-- ============================
-- 13. AUTOMATION TABLES
-- ============================
create table if not exists automation_rules (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  name            text not null,
  trigger_event   text not null, -- payment_received | artwork_approved | due_date_approaching | etc
  action_type     text not null, -- send_whatsapp | send_email | update_status | create_task
  action_config   jsonb default '{}'::jsonb,
  delay_minutes   int default 0,
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_auto_rules_company on automation_rules(company_id);

create table if not exists automation_logs (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  rule_id         uuid references automation_rules(id) on delete set null,
  trigger_record_id uuid,
  action          text not null,
  status          text default 'success', -- success | failed | skipped
  error_message   text,
  executed_at     timestamptz default now()
);
create index if not exists idx_auto_logs_company on automation_logs(company_id);

-- ============================
-- 14. ENABLE RLS ON NEW TABLES
-- ============================
alter table product_categories   enable row level security;
alter table products             enable row level security;
alter table product_templates    enable row level security;
alter table product_pricing      enable row level security;
alter table lead_sources         enable row level security;
alter table lead_activities      enable row level security;
alter table customer_contacts    enable row level security;
alter table activity_logs        enable row level security;
alter table ai_requests          enable row level security;
alter table ai_usage_logs        enable row level security;
alter table credit_wallets       enable row level security;
alter table credit_transactions  enable row level security;
alter table storage_connections  enable row level security;
alter table storage_usage        enable row level security;
alter table support_tickets      enable row level security;
alter table automation_rules     enable row level security;
alter table automation_logs      enable row level security;

-- ============================
-- 15. RLS POLICIES FOR NEW TABLES
-- ============================
create policy "product_categories_tenant" on product_categories for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "products_tenant" on products for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "product_templates_tenant" on product_templates for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "product_pricing_tenant" on product_pricing for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "lead_sources_tenant" on lead_sources for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "lead_activities_tenant" on lead_activities for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "customer_contacts_tenant" on customer_contacts for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "activity_logs_tenant" on activity_logs for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "ai_requests_tenant" on ai_requests for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "ai_usage_logs_tenant" on ai_usage_logs for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "credit_wallets_tenant" on credit_wallets for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "credit_transactions_tenant" on credit_transactions for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "storage_connections_tenant" on storage_connections for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "storage_usage_tenant" on storage_usage for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "support_tickets_tenant" on support_tickets for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "automation_rules_tenant" on automation_rules for all using (company_id = fn_current_company_id() or fn_is_super_admin());
create policy "automation_logs_tenant" on automation_logs for all using (company_id = fn_current_company_id() or fn_is_super_admin());

-- ============================
-- 16. AUDIT TRIGGERS FOR NEW TABLES
-- ============================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'product_categories','products','product_templates','product_pricing',
      'lead_sources','customer_contacts',
      'credit_wallets','credit_transactions',
      'support_tickets','automation_rules'
    ])
  loop
    execute format('
      drop trigger if exists trg_auto_audit on %I;
      create trigger trg_auto_audit
        after insert or update or delete on %I
        for each row execute function fn_auto_audit();
    ', t, t);
  end loop;
end $$;

-- ============================
-- 17. PRODUCT SEED DATA
-- ============================
insert into product_categories (company_id, name, code, sort_order)
select '00000000-0000-0000-0000-000000000001', name, code, sort_order
from (values
  ('Banner', 'banner', 1),
  ('Bunting', 'bunting', 2),
  ('Sticker', 'sticker', 3),
  ('Business Card', 'bizcard', 4),
  ('Flyer', 'flyer', 5),
  ('Poster', 'poster', 6),
  ('T-Shirt', 'tshirt', 7),
  ('Signage', 'signage', 8)
) as v(name, code, sort_order)
where not exists (select 1 from product_categories where company_id = '00000000-0000-0000-0000-000000000001' and code = v.code);

insert into products (company_id, category_id, name, code, unit, default_price, default_cost)
select '00000000-0000-0000-0000-000000000001', pc.id, v.name, v.code, v.unit, v.price, v.cost
from (values
  ('Vinyl Banner Standard', 'VYN-STD', 'sqft', 5.00, 2.00, 'banner'),
  ('Vinyl Banner Premium', 'VYN-PRM', 'sqft', 8.00, 3.50, 'banner'),
  ('Die-Cut Sticker', 'DCS', 'pcs', 4.00, 1.50, 'sticker'),
  ('Vinyl Sticker', 'VYS', 'sqft', 6.00, 2.50, 'sticker'),
  ('Business Card Standard', 'BC-STD', 'box', 25.00, 10.00, 'bizcard'),
  ('Business Card Premium', 'BC-PRM', 'box', 45.00, 18.00, 'bizcard')
) as v(name, code, unit, price, cost, cat_code)
join product_categories pc on pc.company_id = '00000000-0000-0000-0000-000000000001' and pc.code = v.cat_code
where not exists (select 1 from products where company_id = '00000000-0000-0000-0000-000000000001' and code = v.code);

-- Lead sources
insert into lead_sources (company_id, name, code)
select '00000000-0000-0000-0000-000000000001', name, code
from (values
  ('Website', 'web'), ('WhatsApp', 'wa'), ('Referral', 'ref'),
  ('Walk-in', 'walkin'), ('Social Media', 'social'), ('Facebook', 'fb'),
  ('Instagram', 'ig'), ('Google', 'google')
) as v(name, code)
where not exists (select 1 from lead_sources where company_id = '00000000-0000-0000-0000-000000000001' and code = v.code);

-- Credit wallet for SR Creative
insert into credit_wallets (company_id, balance, total_purchased)
values ('00000000-0000-0000-0000-000000000001', 5000, 5000)
on conflict (company_id) do nothing;

-- ============================
-- END OF V1.1 MIGRATION
-- ============================
