// =====================================================================
// PRINT OS — TYPE DEFINITIONS V1.0
// Core domain types untuk semua modul
// =====================================================================

// ============================
// COMMON
// ============================
export type Uuid = string;
export type Timestamp = string; // ISO 8601
export type Money = number;    // numeric(14,2)

export type SoftDelete = {
  deleted_at?: Timestamp | null;
};

export type AuditFields = {
  created_by?: Uuid | null;
  created_at?: Timestamp;
  updated_by?: Uuid | null;
  updated_at?: Timestamp;
} & SoftDelete;

export type TenantScoped = {
  company_id: Uuid;
  branch_id?: Uuid | null;
};

// ============================
// COMPANY & USER
// ============================
export type PlanType = 'starter' | 'growth' | 'pro' | 'enterprise';
export type PlanStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

export type StorageProvider =
  | 'google_drive'
  | 'gcs'
  | 's3'
  | 'wasabi'
  | 'backblaze'
  | 'supabase';

export type StorageType = 'byos' | 'managed';
export type StorageStatus = 'pending' | 'active' | 'error' | 'suspended';

export type Company = TenantScoped & {
  id: Uuid;
  name: string;
  registration_no?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  logo_url?: string | null;

  plan: PlanType;
  plan_status: PlanStatus;
  trial_ends_at?: Timestamp | null;
  subscription_starts_at?: Timestamp | null;
  subscription_ends_at?: Timestamp | null;

  user_limit: number;
  branch_limit: number;

  storage_provider?: StorageProvider | null;
  storage_type: StorageType;
  storage_status: StorageStatus;
  storage_quota_gb?: number | null;
  storage_connected_at?: Timestamp | null;
  storage_error_message?: string | null;
  storage_last_checked_at?: Timestamp | null;

  ai_provider?: string | null;
  ai_status: string;
  ai_credits_remaining: number;

  whatsapp_provider?: string | null;
  whatsapp_status: string;

  is_active: boolean;
} & AuditFields;

export type Branch = TenantScoped & {
  id: Uuid;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  is_main: boolean;
  is_active: boolean;
} & AuditFields;

export type RoleKey =
  | 'owner'
  | 'management'
  | 'manager'
  | 'sales'
  | 'designer'
  | 'production'
  | 'supplier'
  | 'customer';

export type Role = TenantScoped & {
  id: Uuid;
  name: string;
  key: RoleKey;
  description?: string | null;
  is_system: boolean;
  permissions: RbacMatrix;
};

export type User = TenantScoped & {
  id: Uuid;
  full_name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  role_id?: Uuid | null;
  is_active: boolean;
  last_login_at?: Timestamp | null;
} & AuditFields;

// ============================
// CUSTOMER & SALES
// ============================
export type CustomerType = 'individual' | 'business';
export type IndustryTag =
  | 'sekolah'
  | 'korporat'
  | 'wedding'
  | 'kerajaan'
  | 'retail'
  | 'f&b'
  | 'events'
  | 'other';

export type Customer = TenantScoped & {
  id: Uuid;
  customer_code?: string | null;
  name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp_no?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  customer_type: CustomerType;
  industry_tag?: IndustryTag | null;
  source?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  total_orders: number;
  total_revenue: Money;
  last_order_at?: Timestamp | null;
  is_active: boolean;
} & AuditFields;

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'quotation_sent'
  | 'won'
  | 'lost';

export type Lead = TenantScoped & {
  id: Uuid;
  customer_id?: Uuid | null;
  name: string;
  contact?: string | null;
  email?: string | null;
  source?: string | null;
  status: LeadStatus;
  estimated_value?: Money | null;
  notes?: string | null;
  assigned_to?: Uuid | null;
  converted_at?: Timestamp | null;
  lost_reason?: string | null;
} & AuditFields;

// ============================
// QUOTATION
// ============================
export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'converted';

export type Quotation = TenantScoped & {
  id: Uuid;
  quotation_no: string;
  customer_id: Uuid;
  lead_id?: Uuid | null;

  subtotal: Money;
  discount_amount: Money;
  discount_percent: number;
  tax_percent: number;
  tax_amount: Money;
  total: Money;

  // Cost visibility (OWNER/FINANCE ONLY)
  cost_total: Money;
  gross_profit: Money;
  margin_percent: number;

  valid_until?: string | null;
  status: QuotationStatus;
  approved_at?: Timestamp | null;
  converted_to_so?: Uuid | null;
  notes?: string | null;
  terms?: string | null;
} & AuditFields;

export type QuotationItem = {
  id: Uuid;
  quotation_id: Uuid;
  product_category?: string | null;
  product_name: string;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  quantity: number;
  unit: string;
  unit_price: Money;
  cost_per_unit: Money; // OWNER/FINANCE ONLY
  line_total: Money;
  notes?: string | null;
  sort_order: number;
  created_at?: Timestamp;
};

// ============================
// SALES ORDER
// ============================
export type SOStatus =
  | 'pending_artwork'
  | 'design_in_progress'
  | 'approval_pending'
  | 'artwork_approved'
  | 'in_production'
  | 'qc'
  | 'packing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type ProductionType = 'inhouse' | 'outsource' | 'mixed';
export type DeliveryType = 'self_collect' | 'courier';
export type ArtworkStatus =
  | 'pending'
  | 'assigned'
  | 'in_design'
  | 'revision'
  | 'approved';

export type SalesOrder = TenantScoped & {
  id: Uuid;
  so_number: string;
  customer_id: Uuid;
  quotation_id?: Uuid | null;

  status: SOStatus;

  subtotal: Money;
  discount_amount: Money;
  tax_amount: Money;
  total: Money;
  paid_amount: Money;
  outstanding_amount: Money;

  cost_total: Money;
  gross_profit: Money;
  margin_percent: number;

  production_type: ProductionType;
  due_date?: string | null;
  rush_order: boolean;

  delivery_type: DeliveryType;
  delivery_address?: string | null;
  courier_name?: string | null;
  tracking_no?: string | null;
  delivered_at?: Timestamp | null;

  artwork_status: ArtworkStatus;
  artwork_approved_at?: Timestamp | null;
  artwork_approved_by?: string | null;

  notes?: string | null;
  internal_notes?: string | null;
} & AuditFields;

export type SalesOrderItem = {
  id: Uuid;
  sales_order_id: Uuid;
  product_category?: string | null;
  product_name: string;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  quantity: number;
  unit: string;
  unit_price: Money;
  cost_per_unit: Money; // OWNER/FINANCE ONLY
  line_total: Money;
  notes?: string | null;
  sort_order: number;
  created_at?: Timestamp;
};

// ============================
// ARTWORK
// ============================
export type ArtworkLifecycleStatus =
  | 'pending_assignment'
  | 'assigned'
  | 'in_design'
  | 'internal_review'
  | 'ready_for_approval'
  | 'revision_requested'
  | 'approved'
  | 'released';

export type Artwork = TenantScoped & {
  id: Uuid;
  sales_order_id: Uuid;
  item_id?: Uuid | null;

  status: ArtworkLifecycleStatus;

  assigned_designer?: Uuid | null;
  assigned_at?: Timestamp | null;

  final_file_url?: string | null;
  source_file_url?: string | null;
  preview_url?: string | null;

  approval_link?: string | null;
  approval_token?: string | null;
  approval_status: 'pending' | 'approved' | 'revision' | 'expired';
  approval_expires_at?: Timestamp | null;
  approved_at?: Timestamp | null;
  approved_by_name?: string | null;
  approved_ip?: string | null;

  released_at?: Timestamp | null;
  released_by?: Uuid | null;

  notes?: string | null;
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

export type DesignRevision = {
  id: Uuid;
  artwork_id: Uuid;
  version_no: number;
  file_url?: string | null;
  requested_by: string;
  requested_by_type: 'customer' | 'staff';
  comments?: string | null;
  status: 'pending' | 'completed' | 'rejected';
  created_at?: Timestamp;
  completed_at?: Timestamp | null;
};

// ============================
// PRODUCTION
// ============================
export type ProductionStatus =
  | 'waiting_schedule'
  | 'scheduled'
  | 'printing'
  | 'finishing'
  | 'qc'
  | 'packing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type ProductionJob = TenantScoped & {
  id: Uuid;
  sales_order_id: Uuid;
  job_number: string;
  production_type: ProductionType;

  machine_id?: Uuid | null;
  operator_id?: Uuid | null;

  supplier_id?: Uuid | null;
  po_number?: string | null;
  po_sent_at?: Timestamp | null;
  expected_receive_at?: string | null;
  received_at?: Timestamp | null;

  status: ProductionStatus;
  scheduled_at?: Timestamp | null;
  started_at?: Timestamp | null;
  finished_at?: Timestamp | null;
  due_date?: string | null;

  receiving_checklist: Record<string, any>;
  receiving_photos?: string[] | null;

  notes?: string | null;
} & AuditFields;

export type QCStatus = 'pending' | 'passed' | 'failed' | 'rework';
export type QCRecord = TenantScoped & {
  id: Uuid;
  production_job_id: Uuid;
  qc_staff_id?: Uuid | null;
  status: QCStatus;
  checklist: Record<string, any>;
  defects?: string[] | null;
  rework_required: boolean;
  rework_notes?: string | null;
  photos?: string[] | null;
  passed_at?: Timestamp | null;
  failed_at?: Timestamp | null;
  notes?: string | null;
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

export type DeliveryStatus =
  | 'pending'
  | 'packed'
  | 'booked'
  | 'in_transit'
  | 'delivered'
  | 'failed';

export type Delivery = TenantScoped & {
  id: Uuid;
  sales_order_id: Uuid;
  delivery_type: DeliveryType;
  status: DeliveryStatus;

  courier_name?: string | null;
  tracking_no?: string | null;
  booked_at?: Timestamp | null;
  collected_at?: Timestamp | null;
  expected_delivery?: string | null;
  delivered_at?: Timestamp | null;

  ready_at?: Timestamp | null;
  pickup_deadline?: string | null;
  picked_up_at?: Timestamp | null;
  picked_up_by_name?: string | null;
  picked_up_by_ic?: string | null;

  pod_signature_url?: string | null;
  pod_photo_url?: string | null;
  pod_notes?: string | null;

  recipient_name?: string | null;
  recipient_phone?: string | null;

  created_at?: Timestamp;
  updated_at?: Timestamp;
};

// ============================
// FINANCE
// ============================
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'ewallet';

export type Invoice = TenantScoped & {
  id: Uuid;
  sales_order_id?: Uuid | null;
  customer_id: Uuid;
  invoice_number: string;
  invoice_date: string;
  due_date?: string | null;

  subtotal: Money;
  discount_amount: Money;
  tax_amount: Money;
  total: Money;
  paid_amount: Money;
  outstanding_amount: Money;

  status: InvoiceStatus;
  pdf_url?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
} & AuditFields;

export type Payment = TenantScoped & {
  id: Uuid;
  invoice_id: Uuid;
  customer_id: Uuid;
  payment_date: Timestamp;
  amount: Money;
  payment_method: PaymentMethod;
  reference_no?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  received_by?: Uuid | null;
  created_at?: Timestamp;
};

// ============================
// RBAC MATRIX
// ============================
export type ModuleKey =
  | 'customers'
  | 'leads'
  | 'quotations'
  | 'sales_orders'
  | 'artworks'
  | 'production'
  | 'qc'
  | 'deliveries'
  | 'invoices'
  | 'payments'
  | 'reports'
  | 'users'
  | 'settings';

export type Action = 'create' | 'view' | 'edit' | 'approve' | 'delete' | 'export';

export type RbacMatrix = {
  [K in ModuleKey]?: {
    [A in Action]?: boolean;
  };
};

// ============================
// AUDIT
// ============================
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VIEW'
  | 'LOGIN'
  | 'LOGOUT'
  | 'APPROVE'
  | 'REJECT'
  | 'EXPORT';

export type AuditLog = {
  id: Uuid;
  company_id?: Uuid | null;
  user_id?: Uuid | null;
  action: AuditAction;
  module: string;
  record_id?: Uuid | null;
  record_type?: string | null;
  old_value?: Record<string, any> | null;
  new_value?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device?: string | null;
  metadata?: Record<string, any>;
  created_at: Timestamp;
};

// ============================
// NOTIFICATION
// ============================
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type Notification = TenantScoped & {
  id: Uuid;
  user_id: Uuid;
  title: string;
  message?: string | null;
  type: NotificationType;
  module?: string | null;
  record_id?: Uuid | null;
  is_read: boolean;
  read_at?: Timestamp | null;
  action_url?: string | null;
  created_at: Timestamp;
};
