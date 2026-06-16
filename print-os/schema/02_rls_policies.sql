-- =====================================================================
-- PRINT OS — ROW LEVEL SECURITY (RLS) V1.0
-- Multi-tenant isolation dikuatkuasakan di peringkat database
-- =====================================================================

-- ============================
-- HELPER FUNCTION
-- ============================
-- Mendapatkan company_id dari JWT metadata
-- Supabase menyimpan custom claims di auth.jwt() -> 'app_metadata' atau 'user_metadata'
create or replace function fn_current_company_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid,
    (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
  );
$$;

-- Check if current user is super admin (HQ staff)
create or replace function fn_is_super_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from super_admins
    where user_id = auth.uid() and is_active = true
  );
$$;

-- Check if current user belongs to a company
create or replace function fn_current_user_company()
returns uuid
language sql
stable
as $$
  select company_id from users where id = auth.uid() and is_active = true limit 1;
$$;

-- ============================
-- ENABLE RLS ON ALL TABLES
-- ============================
alter table super_admins          enable row level security;
alter table companies             enable row level security;
alter table branches              enable row level security;
alter table roles                 enable row level security;
alter table users                 enable row level security;
alter table customers             enable row level security;
alter table leads                 enable row level security;
alter table quotations            enable row level security;
alter table quotation_items       enable row level security;
alter table sales_orders          enable row level security;
alter table sales_order_items     enable row level security;
alter table artworks              enable row level security;
alter table design_revisions      enable row level security;
alter table production_jobs       enable row level security;
alter table qc_records            enable row level security;
alter table deliveries            enable row level security;
alter table invoices              enable row level security;
alter table payments              enable row level security;
alter table audit_logs            enable row level security;
alter table tenant_features       enable row level security;
alter table usage_logs            enable row level security;
alter table notifications         enable row level security;

-- ============================
-- POLICIES: SUPER ADMINS (HQ)
-- ============================
create policy "super_admins_self_read" on super_admins
  for select using (user_id = auth.uid() or fn_is_super_admin());

create policy "super_admins_admin_all" on super_admins
  for all using (fn_is_super_admin());

-- ============================
-- POLICIES: COMPANIES
-- ============================
-- Tenant boleh baca company sendiri sahaja
create policy "companies_own_read" on companies
  for select using (id = fn_current_user_company() or fn_is_super_admin());

-- Super admin boleh buat semua
create policy "companies_admin_all" on companies
  for all using (fn_is_super_admin());

-- Tenant boleh update company sendiri
create policy "companies_own_update" on companies
  for update using (id = fn_current_user_company());

-- ============================
-- POLICIES: BRANCHES
-- ============================
create policy "branches_tenant_isolation" on branches
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- POLICIES: ROLES
-- ============================
create policy "roles_tenant_isolation" on roles
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- POLICIES: USERS
-- ============================
create policy "users_tenant_isolation" on users
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- POLICIES: CUSTOMERS
-- ============================
create policy "customers_tenant_isolation" on customers
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- POLICIES: LEADS
-- ============================
create policy "leads_tenant_isolation" on leads
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- POLICIES: QUOTATIONS
-- ============================
create policy "quotations_tenant_isolation" on quotations
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

create policy "quotation_items_via_quotation" on quotation_items
  for all using (
    exists (
      select 1 from quotations q
      where q.id = quotation_items.quotation_id
        and (q.company_id = fn_current_user_company() or fn_is_super_admin())
    )
  );

-- ============================
-- POLICIES: SALES ORDERS
-- ============================
create policy "so_tenant_isolation" on sales_orders
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

create policy "so_items_via_so" on sales_order_items
  for all using (
    exists (
      select 1 from sales_orders so
      where so.id = sales_order_items.sales_order_id
        and (so.company_id = fn_current_user_company() or fn_is_super_admin())
    )
  );

-- ============================
-- POLICIES: ARTWORKS
-- ============================
create policy "artworks_tenant_isolation" on artworks
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

create policy "revisions_via_artwork" on design_revisions
  for all using (
    exists (
      select 1 from artworks a
      where a.id = design_revisions.artwork_id
        and (a.company_id = fn_current_user_company() or fn_is_super_admin())
    )
  );

-- ============================
-- POLICIES: PRODUCTION
-- ============================
create policy "production_tenant_isolation" on production_jobs
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

create policy "qc_via_production" on qc_records
  for all using (
    exists (
      select 1 from production_jobs pj
      where pj.id = qc_records.production_job_id
        and (pj.company_id = fn_current_user_company() or fn_is_super_admin())
    )
  );

-- ============================
-- POLICIES: DELIVERIES
-- ============================
create policy "deliveries_tenant_isolation" on deliveries
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- POLICIES: INVOICES
-- ============================
create policy "invoices_tenant_isolation" on invoices
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- POLICIES: PAYMENTS
-- ============================
create policy "payments_tenant_isolation" on payments
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- POLICIES: AUDIT LOGS
-- ============================
-- Tenant boleh baca audit logs sendiri
-- Insert melalui service role sahaja (system-generated)
create policy "audit_logs_tenant_read" on audit_logs
  for select using (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- POLICIES: TENANT FEATURES
-- ============================
create policy "tenant_features_isolation" on tenant_features
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- POLICIES: USAGE LOGS
-- ============================
create policy "usage_logs_tenant_isolation" on usage_logs
  for all using (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- POLICIES: NOTIFICATIONS
-- ============================
create policy "notifications_own_read" on notifications
  for select using (user_id = auth.uid() or fn_is_super_admin());

create policy "notifications_own_update" on notifications
  for update using (user_id = auth.uid());

create policy "notifications_tenant_insert" on notifications
  for insert with check (company_id = fn_current_user_company() or fn_is_super_admin());

-- ============================
-- AUDIT TRAIL TRIGGER (Auto-log INSERT/UPDATE/DELETE)
-- ============================
-- Function generic untuk auto-audit
create or replace function fn_auto_audit()
returns trigger
language plpgsql
as $$
declare
  v_action text;
  v_record_id uuid;
  v_company_id uuid;
  v_module text;
  v_old jsonb;
  v_new jsonb;
begin
  v_module := TG_TABLE_NAME;

  if TG_OP = 'INSERT' then
    v_action := 'CREATE';
    v_new := to_jsonb(NEW);
    v_record_id := (NEW.id)::uuid;
    -- Cuba extract company_id
    begin
      v_company_id := (NEW.company_id)::uuid;
    exception when others then
      v_company_id := null;
    end;
  elsif TG_OP = 'UPDATE' then
    v_action := 'UPDATE';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (NEW.id)::uuid;
    begin
      v_company_id := (NEW.company_id)::uuid;
    exception when others then
      v_company_id := null;
    end;
  elsif TG_OP = 'DELETE' then
    v_action := 'DELETE';
    v_old := to_jsonb(OLD);
    v_record_id := (OLD.id)::uuid;
    begin
      v_company_id := (OLD.company_id)::uuid;
    exception when others then
      v_company_id := null;
    end;
  end if;

  insert into audit_logs (
    company_id, user_id, action, module, record_id, record_type,
    old_value, new_value
  ) values (
    v_company_id, auth.uid(), v_action, v_module, v_record_id, v_module,
    v_old, v_new
  );

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

-- Apply audit trigger ke tables teras (skip system tables)
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'companies','branches','users','customers','leads',
      'quotations','sales_orders','artworks','production_jobs',
      'qc_records','deliveries','invoices','payments',
      'tenant_features'
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
-- END OF RLS POLICIES
-- ============================
-- Test: Cuba query sebagai user biasa, pasti tidak nampak data tenant lain.
-- Test: Cuba query sebagai super admin, pasti nampak semua.
-- ============================
