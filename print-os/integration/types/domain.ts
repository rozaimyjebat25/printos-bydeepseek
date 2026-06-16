// =====================================================================
// PRINT OS — Domain Types (untuk integration package)
// Simplified version untuk frontend consumption
// =====================================================================

export type Uuid = string;
export type Money = number;

export type RoleKey =
  | 'owner'
  | 'management'
  | 'manager'
  | 'sales'
  | 'designer'
  | 'production'
  | 'supplier'
  | 'customer';

export type PlanType = 'starter' | 'growth' | 'pro' | 'enterprise';

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

export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'converted';

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

export type DeliveryStatus =
  | 'pending'
  | 'packed'
  | 'booked'
  | 'in_transit'
  | 'delivered'
  | 'failed';

export type QCStatus = 'pending' | 'passed' | 'failed' | 'rework';

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export type ArtworkLifecycleStatus =
  | 'pending_assignment'
  | 'assigned'
  | 'in_design'
  | 'internal_review'
  | 'ready_for_approval'
  | 'revision_requested'
  | 'approved'
  | 'released';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'quotation_sent'
  | 'won'
  | 'lost';

export type IndustryTag =
  | 'sekolah'
  | 'korporat'
  | 'wedding'
  | 'kerajaan'
  | 'retail'
  | 'f&b'
  | 'events'
  | 'other';

export type CustomerType = 'individual' | 'business';

export interface Company {
  id: Uuid;
  name: string;
  email: string;
  phone: string;
  plan: PlanType;
  plan_status: string;
}

export interface Branch {
  id: Uuid;
  company_id: Uuid;
  name: string;
  code: string;
  is_main: boolean;
}

export interface User {
  id: Uuid;
  company_id: Uuid;
  branch_id: Uuid | null;
  role_id: Uuid;
  full_name: string;
  email: string;
  is_active: boolean;
}

export interface Customer {
  id: Uuid;
  company_id: Uuid;
  customer_code: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_no: string | null;
  customer_type: CustomerType;
  industry_tag: IndustryTag | null;
  total_orders: number;
  total_revenue: Money;
  last_order_at: string | null;
}

export interface QuotationItem {
  id?: Uuid;
  product_category: string | null;
  product_name: string;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  quantity: number;
  unit: string;
  unit_price: Money;
  cost_per_unit?: Money;
  line_total: Money;
}

export interface Quotation {
  id: Uuid;
  company_id: Uuid;
  quotation_no: string;
  customer_id: Uuid;
  status: QuotationStatus;
  subtotal: Money;
  discount_amount: Money;
  tax_amount: Money;
  total: Money;
  cost_total: Money;
  gross_profit: Money;
  margin_percent: number;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  items?: QuotationItem[];
}

export interface SalesOrderItem {
  id?: Uuid;
  product_category: string | null;
  product_name: string;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  quantity: number;
  unit: string;
  unit_price: Money;
  cost_per_unit?: Money;
  line_total: Money;
}

export interface SalesOrder {
  id: Uuid;
  company_id: Uuid;
  so_number: string;
  customer_id: Uuid;
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
  production_type: 'inhouse' | 'outsource' | 'mixed';
  due_date: string | null;
  rush_order: boolean;
  delivery_type: 'self_collect' | 'courier';
  artwork_status: string;
  notes: string | null;
  created_at: string;
  items?: SalesOrderItem[];
}

export interface ProductionJob {
  id: Uuid;
  company_id: Uuid;
  sales_order_id: Uuid;
  job_number: string;
  production_type: string;
  status: ProductionStatus;
  due_date: string | null;
  started_at: string | null;
  finished_at: string | null;
  operator_id: Uuid | null;
}

export interface QCRecord {
  id: Uuid;
  production_job_id: Uuid;
  status: QCStatus;
  checklist: Record<string, any>;
  defects: string[] | null;
  notes: string | null;
  passed_at: string | null;
  failed_at: string | null;
}

export interface Delivery {
  id: Uuid;
  sales_order_id: Uuid;
  delivery_type: 'self_collect' | 'courier';
  status: DeliveryStatus;
  courier_name: string | null;
  tracking_no: string | null;
  delivered_at: string | null;
  picked_up_by_name: string | null;
}

export interface Invoice {
  id: Uuid;
  sales_order_id: Uuid | null;
  customer_id: Uuid;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total: Money;
  paid_amount: Money;
  outstanding_amount: Money;
  status: InvoiceStatus;
}

export interface Payment {
  id: Uuid;
  invoice_id: Uuid;
  customer_id: Uuid;
  amount: Money;
  payment_method: string;
  reference_no: string | null;
  payment_date: string;
}

export interface OwnerDashboard {
  today: {
    new_orders: number;
    revenue: number;
    pending_artwork: number;
    in_production: number;
    awaiting_delivery: number;
  };
  month: {
    total_revenue: number;
    total_profit: number;
    margin_percent: number;
    total_orders: number;
    completed_orders: number;
    completion_rate: number;
  };
  outstanding: {
    total: number;
    overdue: number;
    invoice_count: number;
  };
  production: {
    queue: number;
    overdue: number;
    qc_pending: number;
  };
  kpi: {
    transaction_capture: number;
    order_coverage: number;
    workflow_completion: number;
    owner_dependency: number;
    profit_visibility: number;
  };
}
