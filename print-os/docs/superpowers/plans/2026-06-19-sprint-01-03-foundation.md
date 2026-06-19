# Sprint 01-03 — Foundation + Customers + Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task.

**Goal:** Create the foundational database schema on Supabase for PRINT OS — companies, branches, users, roles, permissions, customers, and products — with full RLS, audit trail, and seed data.

**Architecture:** Multi-tenant shared database with `company_id` isolation, soft delete, and audit logging on all tables. All tables follow the standard field pattern: `id`, `company_id`, `status`, `created_at/updated_at/deleted_at`, `created_by/updated_by/deleted_by`.

**Tech Stack:** Supabase (PostgreSQL 17), SQL migrations, Row Level Security (RLS), Supabase Auth.

## Global Constraints

- All tables MUST have `company_id UUID REFERENCES companies(id)`
- No hard delete — use `deleted_at TIMESTAMPTZ`, `deleted_by UUID REFERENCES users(id)`
- Audit trail on all mutations via triggers
- RLS enabled on all tables with tenant isolation policy
- All timestamps use `TIMESTAMPTZ` with `DEFAULT NOW()`
- All IDs use `UUID` with `DEFAULT gen_random_uuid()`

---

### Task 1: Migration SQL — Foundation Schema

**Files:**
- Create: `print-os/supabase/migrations/20260619000001_foundation.sql`

**Purpose:** Create the 5 foundation tables: `companies`, `branches`, `roles`, `users`, `permissions` with RLS, audit triggers, and seed data.

- [ ] **Step 1: Write the SQL migration**

```sql
-- ============================================================
-- SPRINT 01 — FOUNDATION SCHEMA
-- Companies, Branches, Roles, Users, Permissions
-- ============================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. COMPANIES (tenants)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    registration_no VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    logo_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    subscription_tier VARCHAR(50) DEFAULT 'starter',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);

-- 2. BRANCHES
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    is_headquarters BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);
CREATE INDEX idx_branches_company ON branches(company_id);

-- 3. ROLES
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);
CREATE INDEX idx_roles_company ON roles(company_id);

-- 4. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    branch_id UUID REFERENCES branches(id),
    auth_user_id UUID REFERENCES auth.users(id),
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    role_id UUID REFERENCES roles(id),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_auth ON users(auth_user_id);
CREATE INDEX idx_users_email ON users(email);

-- 5. PERMISSIONS
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id),
    module VARCHAR(100) NOT NULL,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_approve BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
CREATE INDEX idx_permissions_role ON permissions(role_id);

-- 6. AUDIT LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    user_id UUID REFERENCES users(id),
    module VARCHAR(100) NOT NULL,
    record_id UUID,
    action VARCHAR(50) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_company ON audit_logs(company_id);
CREATE INDEX idx_audit_module ON audit_logs(module);
CREATE INDEX idx_audit_record ON audit_logs(record_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- 7. AUDIT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION trigger_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (company_id, user_id, module, record_id, action, new_data)
        VALUES (NEW.company_id, NEW.created_by, TG_TABLE_NAME, NEW.id, 'CREATE', row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (company_id, user_id, module, record_id, action, old_data, new_data)
        VALUES (NEW.company_id, NEW.updated_by, TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (company_id, user_id, module, record_id, action, old_data)
        VALUES (OLD.company_id, OLD.deleted_by, TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. SOFT DELETE TRIGGER
CREATE OR REPLACE FUNCTION trigger_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    NEW.deleted_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. RLS FUNCTIONS
CREATE OR REPLACE FUNCTION fn_current_company_id()
RETURNS UUID AS $$
DECLARE
    claim_company_id UUID;
BEGIN
    claim_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::UUID;
    IF claim_company_id IS NULL THEN
        claim_company_id := (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID;
    END IF;
    RETURN claim_company_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fn_user_role()
RETURNS VARCHAR AS $$
BEGIN
    RETURN (auth.jwt() -> 'app_metadata' ->> 'role');
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fn_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN fn_user_role() IN ('super_admin', 'hq_admin');
END;
$$ LANGUAGE plpgsql STABLE;

-- 10. ENABLE RLS ON ALL TABLES
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 11. RLS POLICIES
CREATE POLICY "users_company_access" ON companies
    FOR ALL USING (
        id = fn_current_company_id()
        OR fn_is_super_admin()
    );

CREATE POLICY "branches_company_access" ON branches
    FOR ALL USING (
        company_id = fn_current_company_id()
        OR fn_is_super_admin()
    );

CREATE POLICY "roles_company_access" ON roles
    FOR ALL USING (
        company_id = fn_current_company_id()
        OR fn_is_super_admin()
    );

CREATE POLICY "users_company_access" ON users
    FOR ALL USING (
        company_id = fn_current_company_id()
        OR fn_is_super_admin()
    );

CREATE POLICY "permissions_role_access" ON permissions
    FOR ALL USING (
        role_id IN (SELECT id FROM roles WHERE company_id = fn_current_company_id())
        OR fn_is_super_admin()
    );

CREATE POLICY "audit_company_access" ON audit_logs
    FOR ALL USING (
        company_id = fn_current_company_id()
        OR fn_is_super_admin()
    );

-- 12. AUTO UPDATE updated_at
CREATE OR REPLACE FUNCTION trigger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();

-- 13. AUDIT TRIGGERS
CREATE TRIGGER trg_companies_audit AFTER INSERT OR UPDATE OR DELETE ON companies
    FOR EACH ROW EXECUTE FUNCTION trigger_audit();
CREATE TRIGGER trg_branches_audit AFTER INSERT OR UPDATE OR DELETE ON branches
    FOR EACH ROW EXECUTE FUNCTION trigger_audit();
CREATE TRIGGER trg_roles_audit AFTER INSERT OR UPDATE OR DELETE ON roles
    FOR EACH ROW EXECUTE FUNCTION trigger_audit();
CREATE TRIGGER trg_users_audit AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_audit();
```

- [ ] **Step 2: Write seed data SQL**

```sql
-- ============================================================
-- SEED DATA — SR Creative (Tenant Demo)
-- ============================================================

-- Company (SR Creative)
INSERT INTO companies (id, name, registration_no, email, phone, subscription_tier)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'SR Creative Sdn Bhd',
    '202501000001',
    'info@srcreative.my',
    '+60123456789',
    'starter'
);

-- Branches
INSERT INTO branches (id, company_id, name, code, is_headquarters)
VALUES
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'HQ Kuala Lumpur', 'HQ-KL', TRUE),
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Branch Penang', 'BR-PG', FALSE);

-- Roles
INSERT INTO roles (id, company_id, name, code, description, is_system, priority)
VALUES
    ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Owner', 'owner', 'Full access to all modules including cost and profit', TRUE, 100),
    ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'Management', 'management', 'Operations access with cost visibility', TRUE, 90),
    ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 'Sales Executive', 'sales', 'CRM and quotation without cost visibility', TRUE, 80),
    ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 'Designer', 'designer', 'Artwork and design management only', TRUE, 70),
    ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', 'Production Staff', 'production', 'Production queue and job management', TRUE, 60),
    ('00000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000001', 'Finance', 'finance', 'Invoice, payment, and financial reports', TRUE, 85),
    ('00000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000001', 'Customer Service', 'cs', 'Order monitoring and customer updates', TRUE, 75),
    ('00000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000001', 'QC Officer', 'qc', 'Quality control and inspection', TRUE, 65),
    ('00000000-0000-0000-0000-000000000028', '00000000-0000-0000-0000-000000000001', 'Delivery Staff', 'delivery', 'Packing and delivery management', TRUE, 55),
    ('00000000-0000-0000-0000-000000000029', '00000000-0000-0000-0000-000000000001', 'Customer', 'customer', 'Customer portal - own orders only', TRUE, 10);

-- Users (linked to Supabase Auth users)
INSERT INTO users (id, company_id, branch_id, email, full_name, role_id, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'owner@srcreative.my', 'Ahmad bin Ali (Owner)', '00000000-0000-0000-0000-000000000020', TRUE),
    ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'management@srcreative.my', 'Siti binti Hamid (Manager)', '00000000-0000-0000-0000-000000000021', TRUE),
    ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'sales@srcreative.my', 'Raja bin Ismail (Sales)', '00000000-0000-0000-0000-000000000022', TRUE),
    ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'designer@srcreative.my', 'Lin binti Tan (Designer)', '00000000-0000-0000-0000-000000000023', TRUE),
    ('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'production@srcreative.my', 'Abu bin Bakar (Production)', '00000000-0000-0000-0000-000000000024', TRUE),
    ('00000000-0000-0000-0000-000000000036', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'finance@srcreative.my', 'Mei Ling binti Wong (Finance)', '00000000-0000-0000-0000-000000000025', TRUE),
    ('00000000-0000-0000-0000-000000000037', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'cs@srcreative.my', 'Farid bin Aziz (CS)', '00000000-0000-0000-0000-000000000026', TRUE),
    ('00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'qc@srcreative.my', 'Hafiz bin Rahman (QC)', '00000000-0000-0000-0000-000000000027', TRUE),
    ('00000000-0000-0000-0000-000000000039', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'delivery@srcreative.my', 'Zain bin Othman (Delivery)', '00000000-0000-0000-0000-000000000028', TRUE);

-- Permissions (Owner = full access)
INSERT INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_approve)
SELECT id, m.module, TRUE, TRUE, TRUE, TRUE, TRUE
FROM roles CROSS JOIN (
    VALUES ('dashboard'), ('crm'), ('quotation'), ('orders'), ('invoice'),
           ('payment'), ('artwork'), ('design'), ('production'), ('qc'),
           ('delivery'), ('reports'), ('settings'), ('users'), ('customers')
) AS m(module)
WHERE roles.code = 'owner';

-- Permissions (Sales = no finance/cost)
INSERT INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_approve)
SELECT id, m.module,
       CASE WHEN m.module IN ('reports', 'settings', 'users') THEN FALSE ELSE TRUE END,
       CASE WHEN m.module IN ('reports', 'settings', 'users') THEN FALSE ELSE TRUE END,
       CASE WHEN m.module IN ('reports', 'settings', 'users') THEN FALSE ELSE TRUE END,
       FALSE, FALSE
FROM roles CROSS JOIN (
    VALUES ('dashboard'), ('crm'), ('quotation'), ('orders'), ('artwork'),
           ('customers')
) AS m(module)
WHERE roles.code = 'sales';
```

---

### Task 2: Migration SQL — Customer Tables

**Files:**
- Create: `print-os/supabase/migrations/20260619000002_customers.sql`

**Purpose:** Create `leads`, `lead_sources`, `lead_activities`, `customers`, and `customer_contacts` tables.

- [ ] **Step 1: Write customer migration SQL**

```sql
-- ============================================================
-- SPRINT 02 — CUSTOMER SCHEMA
-- ============================================================

-- LEAD SOURCES
CREATE TABLE lead_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);
CREATE INDEX idx_lead_sources_company ON lead_sources(company_id);

-- LEADS
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    branch_id UUID REFERENCES branches(id),
    source_id UUID REFERENCES lead_sources(id),
    company_name VARCHAR(255),
    contact_person VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'new',
    priority VARCHAR(20) DEFAULT 'medium',
    notes TEXT,
    assigned_to UUID REFERENCES users(id),
    converted_to_customer_id UUID,
    converted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id)
);
CREATE INDEX idx_leads_company ON leads(company_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);

-- LEAD ACTIVITIES
CREATE TABLE lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    lead_id UUID NOT NULL REFERENCES leads(id),
    type VARCHAR(50) NOT NULL,
    description TEXT,
    notes TEXT,
    follow_up_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id);

-- CUSTOMERS
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    branch_id UUID REFERENCES branches(id),
    customer_no VARCHAR(50),
    company_name VARCHAR(255),
    contact_person VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postcode VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Malaysia',
    tax_id VARCHAR(50),
    notes TEXT,
    credit_limit NUMERIC(12,2) DEFAULT 0,
    payment_terms VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    source_id UUID REFERENCES lead_sources(id),
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id)
);
CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_customers_email ON customers(email);

-- CUSTOMER CONTACTS
CREATE TABLE customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    name VARCHAR(255) NOT NULL,
    position VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    is_primary BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);
CREATE INDEX idx_customer_contacts_customer ON customer_contacts(customer_id);

-- RLS
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_sources_company_access" ON lead_sources FOR ALL USING (company_id = fn_current_company_id() OR fn_is_super_admin());
CREATE POLICY "leads_company_access" ON leads FOR ALL USING (company_id = fn_current_company_id() OR fn_is_super_admin());
CREATE POLICY "lead_activities_company_access" ON lead_activities FOR ALL USING (company_id = fn_current_company_id() OR fn_is_super_admin());
CREATE POLICY "customers_company_access" ON customers FOR ALL USING (company_id = fn_current_company_id() OR fn_is_super_admin());
CREATE POLICY "customer_contacts_company_access" ON customer_contacts FOR ALL USING (company_id = fn_current_company_id() OR fn_is_super_admin());

-- Updated_at triggers
CREATE TRIGGER trg_lead_sources_updated_at BEFORE UPDATE ON lead_sources FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER trg_customer_contacts_updated_at BEFORE UPDATE ON customer_contacts FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();

-- Audit triggers
CREATE TRIGGER trg_lead_sources_audit AFTER INSERT OR UPDATE OR DELETE ON lead_sources FOR EACH ROW EXECUTE FUNCTION trigger_audit();
CREATE TRIGGER trg_leads_audit AFTER INSERT OR UPDATE OR DELETE ON leads FOR EACH ROW EXECUTE FUNCTION trigger_audit();
CREATE TRIGGER trg_customers_audit AFTER INSERT OR UPDATE OR DELETE ON customers FOR EACH ROW EXECUTE FUNCTION trigger_audit();
CREATE TRIGGER trg_customer_contacts_audit AFTER INSERT OR UPDATE OR DELETE ON customer_contacts FOR EACH ROW EXECUTE FUNCTION trigger_audit();

-- Seed customer data
INSERT INTO lead_sources (company_id, name, code)
VALUES ('00000000-0000-0000-0000-000000000001', 'Website', 'web'),
       ('00000000-0000-0000-0000-000000000001', 'WhatsApp', 'wa'),
       ('00000000-0000-0000-0000-000000000001', 'Referral', 'ref'),
       ('00000000-0000-0000-0000-000000000001', 'Walk-in', 'walkin'),
       ('00000000-0000-0000-0000-000000000001', 'Social Media', 'social');

INSERT INTO customers (id, company_id, branch_id, customer_no, company_name, contact_person, email, phone)
VALUES
    ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'CUST-00001', 'Kafe Orang Asli', 'Ali bin Mat', 'ali@kafeoa.com', '0123456789'),
    ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'CUST-00002', 'Restoran Nasi Lemak', 'Siti binti Ahmad', 'siti@nasi lemak.com', '0123456790'),
    ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'CUST-00003', 'Kedai Buku Ilmu', 'Hassan bin Osman', 'hassan@ilmu.com', '0123456791'),
    ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'CUST-00004', 'Gym Fit Malaysia', 'Mike Chan', 'mike@gymfit.my', '0123456792'),
    ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'CUST-00005', 'Klinik Sejahtera', 'Dr. Nurul', 'nurul@sejahtera.com', '0123456793');
```

---

### Task 3: Migration SQL — Product Tables

**Files:**
- Create: `print-os/supabase/migrations/20260619000003_products.sql`

**Purpose:** Create product catalog tables with categories, products, templates, and pricing.

- [ ] **Step 1: Write product migration SQL**

```sql
-- ============================================================
-- SPRINT 03 — PRODUCT SCHEMA
-- ============================================================

-- PRODUCT CATEGORIES
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    parent_id UUID REFERENCES product_categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id)
);
CREATE INDEX idx_product_categories_company ON product_categories(company_id);

-- PRODUCTS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    category_id UUID REFERENCES product_categories(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    unit VARCHAR(50) DEFAULT 'pcs',
    default_price NUMERIC(12,2),
    default_cost NUMERIC(12,2),
    width NUMERIC(10,2),
    height NUMERIC(10,2),
    material TEXT,
    finish TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id)
);
CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_products_category ON products(category_id);

-- PRODUCT TEMPLATES (pre-configured product specs)
CREATE TABLE product_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    category_id UUID REFERENCES product_categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_width NUMERIC(10,2),
    default_height NUMERIC(10,2),
    default_unit VARCHAR(50),
    default_price NUMERIC(12,2),
    default_cost NUMERIC(12,2),
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);
CREATE INDEX idx_product_templates_company ON product_templates(company_id);

-- PRODUCT PRICING (tiered pricing by quantity)
CREATE TABLE product_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    product_id UUID NOT NULL REFERENCES products(id),
    min_qty INTEGER NOT NULL DEFAULT 1,
    max_qty INTEGER,
    unit_price NUMERIC(12,2) NOT NULL,
    cost_per_unit NUMERIC(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
CREATE INDEX idx_product_pricing_product ON product_pricing(product_id);

-- RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_categories_company_access" ON product_categories FOR ALL USING (company_id = fn_current_company_id() OR fn_is_super_admin());
CREATE POLICY "products_company_access" ON products FOR ALL USING (company_id = fn_current_company_id() OR fn_is_super_admin());
CREATE POLICY "product_templates_company_access" ON product_templates FOR ALL USING (company_id = fn_current_company_id() OR fn_is_super_admin());
CREATE POLICY "product_pricing_company_access" ON product_pricing FOR ALL USING (company_id = fn_current_company_id() OR fn_is_super_admin());

-- Updated_at triggers
CREATE TRIGGER trg_product_categories_updated_at BEFORE UPDATE ON product_categories FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER trg_product_templates_updated_at BEFORE UPDATE ON product_templates FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();
CREATE TRIGGER trg_product_pricing_updated_at BEFORE UPDATE ON product_pricing FOR EACH ROW EXECUTE FUNCTION trigger_updated_at();

-- Audit triggers
CREATE TRIGGER trg_product_categories_audit AFTER INSERT OR UPDATE OR DELETE ON product_categories FOR EACH ROW EXECUTE FUNCTION trigger_audit();
CREATE TRIGGER trg_products_audit AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION trigger_audit();
CREATE TRIGGER trg_product_templates_audit AFTER INSERT OR UPDATE OR DELETE ON product_templates FOR EACH ROW EXECUTE FUNCTION trigger_audit();
CREATE TRIGGER trg_product_pricing_audit AFTER INSERT OR UPDATE OR DELETE ON product_pricing FOR EACH ROW EXECUTE FUNCTION trigger_audit();

-- Seed product categories
INSERT INTO product_categories (company_id, name, code, sort_order)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Banner', 'banner', 1),
    ('00000000-0000-0000-0000-000000000001', 'Bunting', 'bunting', 2),
    ('00000000-0000-0000-0000-000000000001', 'Sticker', 'sticker', 3),
    ('00000000-0000-0000-0000-000000000001', 'Business Card', 'bizcard', 4),
    ('00000000-0000-0000-0000-000000000001', 'Flyer', 'flyer', 5),
    ('00000000-0000-0000-0000-000000000001', 'Poster', 'poster', 6),
    ('00000000-0000-0000-0000-000000000001', 'T-Shirt', 'tshirt', 7),
    ('00000000-0000-0000-0000-000000000001', 'Signage', 'signage', 8);

-- Seed products
INSERT INTO products (company_id, category_id, name, code, unit, default_price, default_cost)
VALUES
    ('00000000-0000-0000-0000-000000000001', (SELECT id FROM product_categories WHERE code='banner'), 'Vinyl Banner Standard', 'VYN-STD', 'sqft', 5.00, 2.00),
    ('00000000-0000-0000-0000-000000000001', (SELECT id FROM product_categories WHERE code='banner'), 'Vinyl Banner Premium', 'VYN-PRM', 'sqft', 8.00, 3.50),
    ('00000000-0000-0000-0000-000000000001', (SELECT id FROM product_categories WHERE code='sticker'), 'Die-Cut Sticker', 'DCS', 'pcs', 4.00, 1.50),
    ('00000000-0000-0000-0000-000000000001', (SELECT id FROM product_categories WHERE code='sticker'), 'Vinyl Sticker', 'VYS', 'sqft', 6.00, 2.50),
    ('00000000-0000-0000-0000-000000000001', (SELECT id FROM product_categories WHERE code='bizcard'), 'Business Card Standard', 'BC-STD', 'box', 25.00, 10.00),
    ('00000000-0000-0000-0000-000000000001', (SELECT id FROM product_categories WHERE code='bizcard'), 'Business Card Premium', 'BC-PRM', 'box', 45.00, 18.00);
```

---

### Task 4: Apply Migrations to Supabase

**Purpose:** Execute all migration files against the production Supabase database.

- [ ] **Step 1: Combine migrations and apply**

Run the combined SQL against the Supabase connection string:

```powershell
# Using psql or direct connection
psql "postgresql://postgres.ddvytkgskhegfjytwpqz:Sorangje$1juta@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require" -f supabase/migrations/20260619000001_foundation.sql
psql "..." -f supabase/migrations/20260619000002_customers.sql
psql "..." -f supabase/migrations/20260619000003_products.sql
```

- [ ] **Step 2: Verify tables exist**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Expected: companies, branches, roles, users, permissions, lead_sources, leads, lead_activities, customers, customer_contacts, product_categories, products, product_templates, product_pricing, audit_logs

- [ ] **Step 3: Verify RLS is enabled**

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
```

- [ ] **Step 4: Verify seed data**

```sql
SELECT COUNT(*) FROM companies;
SELECT COUNT(*) FROM roles;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM product_categories;
SELECT COUNT(*) FROM products;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: foundation schema - companies, customers, products"
```

---

### Verification

**Integration test:** Create a new user in Supabase Auth with `app_metadata` containing `company_id` and `role`. Sign in and verify RLS returns only that company's data.

```sql
-- Test RLS
SELECT fn_current_company_id();
-- Should return the company_id from the JWT
```
