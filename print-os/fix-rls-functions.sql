-- =====================================================================
-- FIX: Make fn_current_company_id work with both direct connection
-- (using auth.jwt()) and PostgREST (using request.jwt.claims)
-- =====================================================================

create or replace function fn_current_company_id()
returns uuid
language plpgsql
stable
security definer
as $$
declare
  v_company text;
begin
  -- Try PostgREST first (set via request.jwt.claims)
  begin
    v_company := current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'company_id';
  exception when others then
    v_company := null;
  end;

  -- Fallback: direct connection (auth.jwt())
  if v_company is null or v_company = '' then
    begin
      v_company := (auth.jwt() -> 'app_metadata' ->> 'company_id');
    exception when others then
      v_company := null;
    end;
  end if;

  -- Final fallback: check if user is in public.users table and get their company
  if v_company is null or v_company = '' then
    begin
      v_company := (select company_id::text from public.users where id = auth.uid() limit 1);
    exception when others then
      v_company := null;
    end;
  end if;

  return nullif(v_company, '')::uuid;
end;
$$;

create or replace function fn_current_user_company()
returns uuid
language sql
stable
security definer
as $$
  select company_id from public.users where id = auth.uid() and is_active = true limit 1;
$$;

create or replace function fn_is_super_admin()
returns boolean
language plpgsql
stable
security definer
as $$
declare
  v_role text;
begin
  begin
    v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  exception when others then
    v_role := null;
  end;

  if v_role is null or v_role = '' then
    begin
      v_role := auth.jwt() -> 'app_metadata' ->> 'role';
    exception when others then
      v_role := null;
    end;
  end if;

  -- In our system, "super_admin" is the HQ-level role (separate from owner)
  -- Owners are NOT super admins - they're tenant admins
  return v_role in ('super_admin', 'hq_admin', 'platform_admin');
end;
$$;

-- Reload policies just in case
-- (no DDL changes needed, just function definitions)
