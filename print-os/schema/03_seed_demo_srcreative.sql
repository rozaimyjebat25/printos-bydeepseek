-- =====================================================================
-- PRINT OS — SEED DATA SR CREATIVE PRINT (Demo Tenant)
-- Default 8 roles + sample data untuk testing
-- =====================================================================

-- ============================
-- 1. SR CREATIVE COMPANY
-- ============================
insert into companies (id, name, registration_no, email, phone, address, city, state, country, plan, plan_status, trial_ends_at, user_limit, branch_limit, storage_provider, storage_type, storage_status, ai_provider, ai_status, ai_credits_remaining, whatsapp_provider, whatsapp_status, is_active)
values ('00000000-0000-0000-0000-000000000001', 'SR Creative Print', '1234567-X', 'admin@srcreative.my', '+60123456789', 'No 42, Jalan Industri 3', 'Shah Alam', 'Selangor', 'Malaysia', 'pro', 'active', (now() + interval '30 days')::timestamptz, 20, 3, 'supabase', 'managed', 'active', 'claude', 'active', 10000, 'ultramsg', 'active', true)
on conflict (id) do nothing;

-- ============================
-- 2. BRANCHES
-- ============================
insert into branches (id, company_id, name, code, address, city, state, phone, is_main, is_active)
values
('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'HQ Shah Alam', 'SRCP-SA', 'No 42, Jalan Industri 3', 'Shah Alam', 'Selangor', '+60123456789', true, true),
('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'KL Branch', 'SRCP-KL', 'Lot 88, Jalan Bukit Bintang', 'Kuala Lumpur', 'Wilayah Persekutuan', '+60123456790', false, true),
('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'JB Branch', 'SRCP-JB', 'No 15, Jalan Skudai', 'Johor Bahru', 'Johor', '+60123456791', false, true)
on conflict do nothing;

-- ============================
-- 3. DEFAULT 8 ROLES
-- ============================
insert into roles (id, company_id, name, key, description, is_system, permissions)
values
('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Owner', 'owner', 'Pemilik syarikat — akses penuh', true, '{"all": true}'::jsonb),
('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'Management', 'management', 'C-level / GM', true, '{"view_all": true, "approve": true}'::jsonb),
('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 'Manager', 'manager', 'Department head', true, '{"view_all": true}'::jsonb),
('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 'Sales Executive', 'sales', 'Sales team — tak nampak cost/margin', true, '{"no_cost": true, "no_margin": true}'::jsonb),
('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', 'Designer', 'designer', 'Artwork & design team', true, '{"artwork_only": true}'::jsonb),
('00000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000001', 'Production', 'production', 'Production, QC, packing team', true, '{"production_only": true}'::jsonb),
('00000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000001', 'Supplier Coordinator', 'supplier', 'Outsource & supplier', true, '{"outsource_only": true}'::jsonb),
('00000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000001', 'Customer', 'customer', 'Customer portal access', true, '{"portal_only": true}'::jsonb)
on conflict (company_id, key) do nothing;

-- ============================
-- 4. SAMPLE CUSTOMERS
-- ============================
insert into customers (id, company_id, branch_id, customer_code, name, company_name, email, phone, whatsapp_no, customer_type, industry_tag, source, total_orders, total_revenue)
values
('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'CUST-0001', 'Kafe Orang Asli', 'Kafe Orang Asli Sdn Bhd', 'order@kafeorangasli.com', '+60198765432', '+60198765432', 'business', 'f&b', 'walk-in', 5, 2350.00),
('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'CUST-0002', 'Sekolah Kebangsaan Taman Maju', 'SK Taman Maju', 'admin@sktamanmaju.edu.my', '+60198765433', '+60198765433', 'business', 'sekolah', 'referral', 3, 1480.00),
('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'CUST-0003', 'Aisyah Wedding Planner', 'Aisyah Wedding Sdn Bhd', 'hello@aisyahwedding.com', '+60198765434', '+60198765434', 'business', 'wedding', 'instagram', 2, 4500.00),
('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'CUST-0004', 'Tan Sri Lim', null, 'tansri@email.com', '+60198765435', '+60198765435', 'individual', null, 'referral', 1, 850.00),
('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'CUST-0005', 'Maju Jaya Resources', 'Maju Jaya Resources Sdn Bhd', 'po@majujaya.com.my', '+60198765436', '+60198765436', 'business', 'korporat', 'facebook', 8, 12600.00)
on conflict do nothing;

-- ============================
-- 5. SAMPLE QUOTATION
-- ============================
insert into quotations (id, company_id, branch_id, quotation_no, customer_id, status, subtotal, discount_percent, tax_percent, tax_amount, total, cost_total, gross_profit, margin_percent, valid_until, notes)
values
('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'QT-2600001', '00000000-0000-0000-0000-000000000030', 'sent', 350.00, 0, 0, 0, 350.00, 150.00, 200.00, 57.14, (current_date + interval '14 days')::date, 'Menu cafe baru untuk Ramadhan')
on conflict do nothing;

insert into quotation_items (quotation_id, product_category, product_name, description, width, height, quantity, unit, unit_price, cost_per_unit, line_total, sort_order)
values
('00000000-0000-0000-0000-000000000040', 'banner', 'Menu Ramadhan Banner', 'Vinyl banner with grommet', 90, 200, 1, 'pcs', 150.00, 60.00, 150.00, 0),
('00000000-0000-0000-0000-000000000040', 'sticker', 'Sticker Logo Kafe', 'Die-cut sticker', 10, 10, 50, 'pcs', 4.00, 1.80, 200.00, 1)
on conflict do nothing;

-- ============================
-- 6. SAMPLE SALES ORDER (in production)
-- ============================
insert into sales_orders (id, company_id, branch_id, so_number, customer_id, status, subtotal, discount_amount, tax_amount, total, paid_amount, outstanding_amount, cost_total, gross_profit, margin_percent, production_type, due_date, delivery_type, artwork_status, notes)
values
('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'SO-2600001', '00000000-0000-0000-0000-000000000031', 'in_production', 800.00, 0, 0, 800.00, 400.00, 400.00, 320.00, 480.00, 60.00, 'inhouse', (current_date + interval '3 days')::date, 'self_collect', 'approved', 'Banner Hari Guru')
on conflict do nothing;

insert into sales_order_items (sales_order_id, product_category, product_name, description, width, height, quantity, unit, unit_price, cost_per_unit, line_total, sort_order)
values
('00000000-0000-0000-0000-000000000050', 'banner', 'Banner Hari Guru', 'Vinyl banner outdoor', 300, 100, 2, 'pcs', 250.00, 100.00, 500.00, 0),
('00000000-0000-0000-0000-000000000050', 'sticker', 'Sticker Logo Sekolah', 'Round sticker', 5, 5, 200, 'pcs', 1.50, 0.60, 300.00, 1)
on conflict do nothing;

-- ============================
-- 7. SAMPLE PRODUCTION JOB
-- ============================
insert into production_jobs (id, company_id, sales_order_id, branch_id, job_number, production_type, status, due_date, scheduled_at, started_at)
values
('00000000-0000-0000-0000-000000000060', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000010', 'JOB-260617-001', 'inhouse', 'printing', (current_date + interval '3 days')::date, (now() - interval '4 hours')::timestamptz, (now() - interval '2 hours')::timestamptz)
on conflict do nothing;

-- ============================
-- 8. SAMPLE INVOICE
-- ============================
insert into invoices (id, company_id, sales_order_id, customer_id, branch_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total, paid_amount, outstanding_amount, status)
values
('00000000-0000-0000-0000-000000000070', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000010', 'INV-2600001', current_date, (current_date + interval '30 days')::date, 800.00, 0, 800.00, 400.00, 400.00, 'partial')
on conflict do nothing;

-- ============================
-- 9. SAMPLE PAYMENT
-- ============================
insert into payments (id, company_id, invoice_id, customer_id, amount, payment_method, reference_no, notes)
values
('00000000-0000-0000-0000-000000000080', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000070', '00000000-0000-0000-0000-000000000031', 400.00, 'bank_transfer', 'MBB-20260617-001', 'Deposit 50%')
on conflict do nothing;

-- ============================
-- 10. DEFAULT FEATURE FLAGS
-- ============================
insert into tenant_features (company_id, feature_key, is_enabled, limit_value, used_value)
values
('00000000-0000-0000-0000-000000000001', 'crm', true, null, 0),
('00000000-0000-0000-0000-000000000001', 'quotation', true, null, 0),
('00000000-0000-0000-0000-000000000001', 'sales_order', true, null, 0),
('00000000-0000-0000-0000-000000000001', 'artwork', true, null, 0),
('00000000-0000-0000-0000-000000000001', 'production', true, null, 0),
('00000000-0000-0000-0000-000000000001', 'qc', true, null, 0),
('00000000-0000-0000-0000-000000000001', 'delivery', true, null, 0),
('00000000-0000-0000-0000-000000000001', 'finance', true, null, 0),
('00000000-0000-0000-0000-000000000001', 'customer_portal', true, null, 0),
('00000000-0000-0000-0000-000000000001', 'ai_credits', true, 10000, 0)
on conflict (company_id, feature_key) do nothing;

-- ============================
-- DONE
-- ============================
