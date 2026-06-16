// =====================================================================
// PRINT OS — SALES ORDER SERVICE V1.0
// SO transaction engine: create, update, workflow transition,
// production job generation, delivery creation, invoice generation
// =====================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SalesOrder,
  SalesOrderItem,
  SOStatus,
  Uuid,
  Money,
  RoleKey,
} from '../types/domain';
import {
  filterSensitiveFields,
  canSeeCost,
} from '../rbac/defaultMatrix';
import {
  validateTransition,
  getAllowedNextStates,
} from '../workflows/stateMachines';
import { AuditableClient, extractContext } from '../audit/auditService';

// ============================
// TYPES
// ============================
export type CreateSOInput = {
  customer_id: Uuid;
  quotation_id?: Uuid;
  branch_id?: Uuid;
  production_type?: 'inhouse' | 'outsource' | 'mixed';
  due_date?: string;
  rush_order?: boolean;
  delivery_type?: 'self_collect' | 'courier';
  delivery_address?: string;
  notes?: string;
  internal_notes?: string;
  items: CreateSOItemInput[];
  tax_percent?: number;
  discount_percent?: number;
};

export type CreateSOItemInput = {
  product_category?: string;
  product_name: string;
  description?: string;
  width?: number;
  height?: number;
  quantity: number;
  unit?: string;
  unit_price: Money;
  cost_per_unit?: Money;
  notes?: string;
};

export type UpdateSOInput = Partial<{
  due_date: string;
  rush_order: boolean;
  delivery_type: 'self_collect' | 'courier';
  delivery_address: string;
  notes: string;
  internal_notes: string;
  items: CreateSOItemInput[];
  tax_percent: number;
  discount_percent: number;
  production_type: 'inhouse' | 'outsource' | 'mixed';
}>;

export type TransitionSOInput = {
  so_id: Uuid;
  to_status: SOStatus;
  reason?: string;
};

export type ListSOFilters = {
  status?: SOStatus | SOStatus[];
  customer_id?: Uuid;
  production_type?: 'inhouse' | 'outsource' | 'mixed';
  rush_only?: boolean;
  start_date?: string;
  end_date?: string;
  due_before?: string;
  due_after?: string;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: 'created_at' | 'due_date' | 'total' | 'so_number';
  sort_order?: 'asc' | 'desc';
};

// ============================
// CALCULATE TOTALS
// ============================
function calculateTotals(
  items: CreateSOItemInput[],
  discountPercent: number = 0,
  taxPercent: number = 0
) {
  let subtotal = 0;
  let costTotal = 0;

  for (const item of items) {
    const lineTotal = (item.unit_price || 0) * (item.quantity || 0);
    subtotal += lineTotal;
    if (item.cost_per_unit) {
      costTotal += item.cost_per_unit * item.quantity;
    }
  }

  const discountAmount = (subtotal * discountPercent) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * taxPercent) / 100;
  const total = afterDiscount + taxAmount;
  const grossProfit = total - costTotal;
  const marginPercent = total > 0 ? (grossProfit / total) * 100 : 0;

  return {
    subtotal: round2(subtotal),
    discount_amount: round2(discountAmount),
    tax_amount: round2(taxAmount),
    total: round2(total),
    cost_total: round2(costTotal),
    gross_profit: round2(grossProfit),
    margin_percent: round2(marginPercent),
  };
}

function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

// ============================
// GENERATE SO NUMBER
// ============================
async function generateSONumber(
  supabase: SupabaseClient,
  companyId: Uuid
): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = `SO-${year}`;

  const { count, error } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .like('so_number', `${prefix}%`);

  if (error) throw error;

  const nextNum = (count || 0) + 1;
  return `${prefix}${String(nextNum).padStart(5, '0')}`;
}

// ============================
// CREATE SALES ORDER
// ============================
export async function createSalesOrder(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  input: CreateSOInput
): Promise<{ data: SalesOrder | null; error: any }> {
  const audit = new AuditableClient(supabase, extractContext(context.userId, context.companyId));
  const soNumber = await generateSONumber(supabase, context.companyId);

  const totals = calculateTotals(
    input.items,
    input.discount_percent || 0,
    input.tax_percent || 0
  );

  const items = input.items.map((item) => ({
    ...item,
    cost_per_unit: canSeeCost(context.role) ? item.cost_per_unit || 0 : 0,
  }));

  // Insert SO header
  const { data: so, error: headerError } = await audit.insert<SalesOrder>(
    'sales_orders',
    {
      company_id: context.companyId,
      branch_id: input.branch_id,
      so_number: soNumber,
      customer_id: input.customer_id,
      quotation_id: input.quotation_id,
      status: 'pending_artwork' as SOStatus,
      production_type: input.production_type || 'inhouse',
      due_date: input.due_date,
      rush_order: input.rush_order || false,
      delivery_type: input.delivery_type || 'self_collect',
      delivery_address: input.delivery_address,
      notes: input.notes,
      internal_notes: internalNotesIfAllowed(input.internal_notes, context.role),
      artwork_status: 'pending',
      paid_amount: 0,
      outstanding_amount: totals.total,
      ...totals,
    } as any
  );

  if (headerError || !so) {
    return { data: null, error: headerError };
  }

  // Insert items
  const itemsPayload = items.map((item, index) => ({
    sales_order_id: so.id,
    product_category: item.product_category,
    product_name: item.product_name,
    description: item.description,
    width: item.width,
    height: item.height,
    quantity: item.quantity,
    unit: item.unit || 'pcs',
    unit_price: item.unit_price,
    cost_per_unit: item.cost_per_unit,
    line_total: item.unit_price * item.quantity,
    notes: item.notes,
    sort_order: index,
  }));

  const { error: itemsError } = await supabase
    .from('sales_order_items')
    .insert(itemsPayload);

  if (itemsError) {
    await supabase.from('sales_orders').delete().eq('id', so.id);
    return { data: null, error: itemsError };
  }

  // Update customer LTV
  await updateCustomerLTV(supabase, context.companyId, input.customer_id);

  return { data: so, error: null };
}

function internalNotesIfAllowed(notes: string | undefined, role: RoleKey): string | undefined {
  if (!notes) return undefined;
  // Only owner/management/manager boleh set internal notes
  if (['owner', 'management', 'manager'].includes(role)) {
    return notes;
  }
  return undefined;
}

// ============================
// UPDATE SO
// ============================
export async function updateSalesOrder(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  soId: Uuid,
  input: UpdateSOInput
): Promise<{ data: SalesOrder | null; error: any }> {
  const { data: existing, error: fetchError } = await supabase
    .from('sales_orders')
    .select('status')
    .eq('id', soId)
    .single();

  if (fetchError) return { data: null, error: fetchError };

  // Allow edit only for certain statuses
  const editableStatuses: SOStatus[] = ['pending_artwork', 'design_in_progress', 'approval_pending'];
  if (!editableStatuses.includes(existing.status as SOStatus)) {
    return {
      data: null,
      error: { message: `Cannot edit SO in status "${existing.status}".` },
    };
  }

  const audit = new AuditableClient(supabase, extractContext(context.userId, context.companyId));

  if (input.items) {
    const totals = calculateTotals(
      input.items,
      input.discount_percent || 0,
      input.tax_percent || 0
    );

    await supabase
      .from('sales_order_items')
      .delete()
      .eq('sales_order_id', soId);

    const itemsPayload = input.items.map((item, index) => ({
      sales_order_id: soId,
      product_category: item.product_category,
      product_name: item.product_name,
      description: item.description,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      unit_price: item.unit_price,
      cost_per_unit: canSeeCost(context.role) ? item.cost_per_unit || 0 : 0,
      line_total: item.unit_price * item.quantity,
      notes: item.notes,
      sort_order: index,
    }));

    await supabase.from('sales_order_items').insert(itemsPayload);

    const { data, error } = await audit.update<SalesOrder>('sales_orders', soId, {
      due_date: input.due_date,
      rush_order: input.rush_order,
      delivery_type: input.delivery_type,
      delivery_address: input.delivery_address,
      notes: input.notes,
      internal_notes: internalNotesIfAllowed(input.internal_notes, context.role),
      production_type: input.production_type,
      outstanding_amount: totals.total,
      ...totals,
    } as any);

    return { data, error };
  }

  const { data, error } = await audit.update<SalesOrder>('sales_orders', soId, {
    due_date: input.due_date,
    rush_order: input.rush_order,
    delivery_type: input.delivery_type,
    delivery_address: input.delivery_address,
    notes: input.notes,
    internal_notes: internalNotesIfAllowed(input.internal_notes, context.role),
    production_type: input.production_type,
  } as any);

  return { data, error };
}

// ============================
// TRANSITION SO STATUS
// ============================
export async function transitionSO(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  input: TransitionSOInput
): Promise<{ data: SalesOrder | null; error: any; triggers?: string[] }> {
  const { data: current, error: fetchError } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', input.so_id)
    .single();

  if (fetchError || !current) {
    return { data: null, error: fetchError || { message: 'SO not found' } };
  }

  const validation = validateTransition(
    'sales_order',
    current.status,
    input.to_status,
    context.role,
    { reason: input.reason }
  );

  if (!validation.ok) {
    return { data: null, error: { message: validation.message, code: validation.reason } };
  }

  const audit = new AuditableClient(supabase, extractContext(context.userId, context.companyId));

  const updatePayload: Record<string, any> = {
    status: input.to_status,
  };

  if (input.to_status === 'delivered') {
    updatePayload.delivered_at = new Date().toISOString();
  }

  const { data, error } = await audit.update<SalesOrder>('sales_orders', input.so_id, updatePayload as any);

  // Side effects from triggers
  if (validation.triggers.includes('create_production_job') && data) {
    await autoCreateProductionJob(supabase, context, data);
  }

  if (validation.triggers.includes('create_delivery') && data) {
    await autoCreateDelivery(supabase, context, data);
  }

  if (validation.triggers.includes('create_invoice') && data) {
    await autoCreateInvoice(supabase, context, data);
  }

  return { data, error, triggers: validation.triggers };
}

// ============================
// SIDE EFFECTS: Auto-create Production Job
// ============================
async function autoCreateProductionJob(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  so: SalesOrder
) {
  const jobNumber = await generateProductionJobNumber(supabase, context.companyId);

  const { data, error } = await supabase.from('production_jobs').insert({
    company_id: context.companyId,
    sales_order_id: so.id,
    branch_id: so.branch_id,
    job_number: jobNumber,
    production_type: so.production_type,
    status: 'waiting_schedule',
    due_date: so.due_date,
  }).select().single();

  if (error) {
    console.error('[SO] Failed to auto-create production job:', error);
  }
  return data;
}

async function generateProductionJobNumber(
  supabase: SupabaseClient,
  companyId: Uuid
): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const day = String(now.getDate()).padStart(2, '0');
  const prefix = `JOB-${yearMonth}${day}`;

  const { count } = await supabase
    .from('production_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .like('job_number', `${prefix}%`);

  return `${prefix}-${String((count || 0) + 1).padStart(3, '0')}`;
}

// ============================
// SIDE EFFECTS: Auto-create Delivery
// ============================
async function autoCreateDelivery(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  so: SalesOrder
) {
  const { data, error } = await supabase.from('deliveries').insert({
    company_id: context.companyId,
    sales_order_id: so.id,
    delivery_type: so.delivery_type,
    status: so.delivery_type === 'self_collect' ? 'packed' : 'packed',
  }).select().single();

  if (error) {
    console.error('[SO] Failed to auto-create delivery:', error);
  }
  return data;
}

// ============================
// SIDE EFFECTS: Auto-create Invoice
// ============================
async function autoCreateInvoice(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  so: SalesOrder
) {
  // Check if invoice already exists
  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('sales_order_id', so.id)
    .maybeSingle();

  if (existing) return existing;

  const invoiceNumber = await generateInvoiceNumber(supabase, context.companyId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const { data, error } = await supabase.from('invoices').insert({
    company_id: context.companyId,
    sales_order_id: so.id,
    customer_id: so.customer_id,
    branch_id: so.branch_id,
    invoice_number: invoiceNumber,
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    subtotal: so.subtotal,
    discount_amount: so.discount_amount,
    tax_amount: so.tax_amount,
    total: so.total,
    paid_amount: so.paid_amount || 0,
    outstanding_amount: so.outstanding_amount || so.total,
    status: 'unpaid',
  }).select().single();

  if (error) {
    console.error('[SO] Failed to auto-create invoice:', error);
  }
  return data;
}

async function generateInvoiceNumber(
  supabase: SupabaseClient,
  companyId: Uuid
): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = `INV-${year}`;

  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .like('invoice_number', `${prefix}%`);

  return `${prefix}${String((count || 0) + 1).padStart(5, '0')}`;
}

// ============================
// UPDATE CUSTOMER LTV (helper)
// ============================
async function updateCustomerLTV(
  supabase: SupabaseClient,
  companyId: Uuid,
  customerId: Uuid
) {
  // Aggregate is left to scheduled job for now
  // This is a simple placeholder
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('total, created_at, status')
    .eq('company_id', companyId)
    .eq('customer_id', customerId);

  if (!orders) return;

  const completed = orders.filter((o) => o.status === 'completed' || o.status === 'delivered');
  const totalOrders = completed.length;
  const totalRevenue = completed.reduce((sum, o) => sum + (o.total || 0), 0);
  const lastOrderAt = orders
    .map((o) => o.created_at)
    .sort()
    .pop();

  await supabase
    .from('customers')
    .update({
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      last_order_at: lastOrderAt,
    })
    .eq('id', customerId);
}

// ============================
// GET SO BY ID (with role filtering)
// ============================
export async function getSalesOrder(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  soId: Uuid
): Promise<{ data: (SalesOrder & { items: SalesOrderItem[] }) | null; error: any }> {
  const { data: so, error: soError } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', soId)
    .single();

  if (soError || !so) {
    return { data: null, error: soError };
  }

  const { data: items, error: itemsError } = await supabase
    .from('sales_order_items')
    .select('*')
    .eq('sales_order_id', soId)
    .order('sort_order', { ascending: true });

  if (itemsError) {
    return { data: null, error: itemsError };
  }

  const filteredSO = filterSensitiveFields(so, 'sales_orders', context.role);
  const filteredItems = (items || []).map((item) =>
    filterSensitiveFields(item, 'sales_order_items', context.role)
  );

  return {
    data: { ...filteredSO, items: filteredItems } as any,
    error: null,
  };
}

// ============================
// LIST SALES ORDERS (paginated)
// ============================
export async function listSalesOrders(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  filters: ListSOFilters
): Promise<{ data: SalesOrder[]; count: number; error: any }> {
  const page = filters.page || 1;
  const pageSize = filters.page_size || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sortBy = filters.sort_by || 'created_at';
  const sortOrder = filters.sort_order || 'desc';

  let query = supabase
    .from('sales_orders')
    .select('*', { count: 'exact' })
    .eq('company_id', context.companyId)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(from, to);

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }
  if (filters.customer_id) query = query.eq('customer_id', filters.customer_id);
  if (filters.production_type) query = query.eq('production_type', filters.production_type);
  if (filters.rush_only) query = query.eq('rush_order', true);
  if (filters.start_date) query = query.gte('created_at', filters.start_date);
  if (filters.end_date) query = query.lte('created_at', filters.end_date);
  if (filters.due_before) query = query.lte('due_date', filters.due_before);
  if (filters.due_after) query = query.gte('due_date', filters.due_after);
  if (filters.search) {
    query = query.or(`so_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    return { data: [], count: 0, error };
  }

  const filteredData = (data || []).map((so) => filterSensitiveFields(so, 'sales_orders', context.role));

  return { data: filteredData as SalesOrder[], count: count || 0, error: null };
}

// ============================
// GET NEXT STATES
// ============================
export function getSONextStates(currentStatus: SOStatus, role: RoleKey): string[] {
  return getAllowedNextStates('sales_order', currentStatus, role);
}

// ============================
// CANCEL SO
// ============================
export async function cancelSalesOrder(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  soId: Uuid,
  reason: string
): Promise<{ data: SalesOrder | null; error: any }> {
  return transitionSO(supabase, context, {
    so_id: soId,
    to_status: 'cancelled',
    reason,
  }) as any;
}
