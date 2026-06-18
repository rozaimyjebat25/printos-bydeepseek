-- =====================================================================
-- PRINT OS — Create 6 MVP Role Users (Direct SQL)
-- Password untuk semua: PrintOS2026!
-- =====================================================================

-- Use a function to safely insert/update users
do $$
declare
  v_user record;
  v_user_data jsonb;
  v_password text := 'PrintOS2026!';
  v_users text[] := array[
    'owner@srcreative.my',
    'management@srcreative.my',
    'sales@srcreative.my',
    'designer@srcreative.my',
    'production@srcreative.my',
    'finance@srcreative.my',
    'customer@example.com'
  ];
  v_user_info jsonb;
  v_email text;
  v_existing_id uuid;
  v_company_id uuid := '00000000-0000-0000-0000-000000000001';
  v_role text;
  v_role_id text;
  v_full_name text;
begin
  foreach v_email in array v_users loop
    -- Set role mapping
    v_role := case v_email
      when 'owner@srcreative.my' then 'owner'
      when 'management@srcreative.my' then 'management'
      when 'sales@srcreative.my' then 'sales'
      when 'designer@srcreative.my' then 'designer'
      when 'production@srcreative.my' then 'production'
      when 'finance@srcreative.my' then 'management'
      when 'customer@example.com' then 'customer'
    end;

    v_role_id := case v_email
      when 'owner@srcreative.my' then '00000000-0000-0000-0000-000000000020'
      when 'management@srcreative.my' then '00000000-0000-0000-0000-000000000021'
      when 'sales@srcreative.my' then '00000000-0000-0000-0000-000000000023'
      when 'designer@srcreative.my' then '00000000-0000-0000-0000-000000000024'
      when 'production@srcreative.my' then '00000000-0000-0000-0000-000000000025'
      when 'finance@srcreative.my' then '00000000-0000-0000-0000-000000000021'
      when 'customer@example.com' then '00000000-0000-0000-0000-000000000027'
    end;

    v_full_name := case v_email
      when 'owner@srcreative.my' then 'Ahmad bin Ali (Owner)'
      when 'management@srcreative.my' then 'Management Team'
      when 'sales@srcreative.my' then 'Siti Sales'
      when 'designer@srcreative.my' then 'Danial Designer'
      when 'production@srcreative.my' then 'Raj Production'
      when 'finance@srcreative.my' then 'Lisa Finance'
      when 'customer@example.com' then 'Demo Customer'
    end;

    v_user_info := jsonb_build_object(
      'provider', 'email',
      'providers', array['email'],
      'company_id', v_company_id,
      'role', v_role,
      'role_id', v_role_id
    );

    -- Check if user exists
    select id into v_existing_id from auth.users where email = v_email limit 1;

    if v_existing_id is not null then
      -- Update existing user
      update auth.users
      set
        encrypted_password = crypt(v_password, gen_salt('bf')),
        raw_app_meta_data = v_user_info,
        raw_user_meta_data = jsonb_build_object('full_name', v_full_name),
        email_confirmed_at = now(),
        updated_at = now()
      where id = v_existing_id;
      raise notice 'Updated user: % (role: %)', v_email, v_role;
    else
      -- Insert new user
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        v_email,
        crypt(v_password, gen_salt('bf')),
        now(),
        v_user_info,
        jsonb_build_object('full_name', v_full_name),
        now(),
        now(),
        '', '', '', ''
      );
      raise notice 'Created user: % (role: %)', v_email, v_role;
    end if;
  end loop;
end $$;

-- Link users to public.users + company
insert into public.users (id, company_id, branch_id, role_id, full_name, email, is_active)
select
  au.id,
  (au.raw_app_meta_data->>'company_id')::uuid,
  '00000000-0000-0000-0000-000000000010',
  (au.raw_app_meta_data->>'role_id')::uuid,
  au.raw_user_meta_data->>'full_name',
  au.email,
  true
from auth.users au
where au.email in (
  'owner@srcreative.my', 'management@srcreative.my', 'sales@srcreative.my',
  'designer@srcreative.my', 'production@srcreative.my', 'finance@srcreative.my',
  'customer@example.com'
)
on conflict (id) do update set
  company_id = excluded.company_id,
  branch_id = excluded.branch_id,
  role_id = excluded.role_id,
  full_name = excluded.full_name,
  is_active = true;

-- Verify
select email,
       raw_app_meta_data->>'role' as role,
       raw_app_meta_data->>'company_id' as company_id,
       raw_user_meta_data->>'full_name' as full_name,
       case when exists (select 1 from public.users pu where pu.id = au.id) then 'YES' else 'NO' end as linked
from auth.users au
where email in (
  'owner@srcreative.my', 'management@srcreative.my', 'sales@srcreative.my',
  'designer@srcreative.my', 'production@srcreative.my', 'finance@srcreative.my',
  'customer@example.com'
)
order by email;
