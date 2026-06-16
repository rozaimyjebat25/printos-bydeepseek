// =====================================================================
// PRINT OS — Sales Order API Service
// =====================================================================

import { getSupabaseClient } from '../utils/supabase';
import type { SalesOrder, SalesOrderItem, SOStatus, Uuid } from '../types/domain';

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
  tax_percent?: number;
  discount_percent?: number;
  items: Omit<SalesOrderItem, 'id' | 'line_total'>[];
};

export type UpdateSOInput = {
  due_date?: string;
  rush_order?: boolean;
  delivery_type?: 'self_collect' | 'courier';
  delivery_address?: string;
  notes?: string;
  production_type?: 'inhouse' | 'outsource' | 'mixed';
  items?: Omit<SalesOrderItem, 'id' | 'line_total'>[];
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

// =====================================================================
// CREATE
// =====================================================================
export async function createSalesOrder(input: CreateSOInput): Promise<SalesOrder> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.app_metadata?.company_id) throw new Error('No company context');

  const itemsWithTotal = input.items.map((item) => ({
    ...item,
    line_total: item.unit_price * item.quantity,
  }));

  const subtotal = itemsWithTotal.reduce((s, i) => s + i.line_total, 0);
  const discountAmount = (subtotal * (input.discount_percent || 0)) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * (input.tax_percent || 0)) / 100;
  const total = afterDiscount + taxAmount;

  const year = new Date().getFullYear().toString().slice(-2);
  const { count } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', user.app_metadata.company_id)
    .like('so_number', `SO-${year}%`);
  const soNumber = `SO-${year}${String((count || 0) + 1).padStart(5, '0')}`;

  const { data: so, error: soErr } = await supabase
    .from('sales_orders')
    .insert({
      company_id: user.app_metadata.company_id,
      branch_id: input.branch_id,
      so_number: soNumber,
      customer_id: input.customer_id,
      quotation_id: input.quotation_id,
      status: 'pending_artwork',
      production_type: input.production_type || 'inhouse',
      due_date: input.due_date,
      rush_order: input.rush_order || false,
      delivery_type: input.delivery_type || 'self_collect',
      delivery_address: input.delivery_address,
      notes: input.notes,
      artwork_status: 'pending',
      paid_amount: 0,
      outstanding_amount: total,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
    })
    .select()
    .single();

  if (soErr) throw soErr;

  const itemsPayload = itemsWithTotal.map((item, idx) => ({
    sales_order_id: so.id,
    product_category: item.product_category,
    product_name: item.product_name,
    description: item.description,
    width: item.width,
    height: item.height,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    cost_per_unit: item.cost_per_unit || 0,
    line_total: item.line_total,
    sort_order: idx,
  }));

  const { error: iErr } = await supabase.from('sales_order_items').insert(itemsPayload);
  if (iErr) throw iErr;

  return so as SalesOrder;
}

// =====================================================================
// UPDATE
// =====================================================================
export async function updateSalesOrder(id: Uuid, input: UpdateSOInput): Promise<SalesOrder> {
  const supabase = getSupabaseClient();

  const updates: Record<string, any> = {};
  if (input.due_date !== undefined) updates.due_date = input.due_date;
  if (input.rush_order !== undefined) updates.rush_order = input.rush_order;
  if (input.delivery_type !== undefined) updates.delivery_type = input.delivery_type;
  if (input.delivery_address !== undefined) updates.delivery_address = input.delivery_address;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.production_type !== undefined) updates.production_type = input.production_type;

  if (input.items) {
    const itemsWithTotal = input.items.map((item) => ({
      ...item,
      line_total: item.unit_price * item.quantity,
    }));

    const subtotal = itemsWithTotal.reduce((s, i) => s + i.line_total, 0);
    const taxAmount = (subtotal * (input.tax_percent || 0)) / 100;
    const total = subtotal + taxAmount;

    Object.assign(updates, {
      subtotal,
      tax_amount: taxAmount,
      total,
      outstanding_amount: total,
    });

    await supabase.from('sales_order_items').delete().eq('sales_order_id', id);
    const itemsPayload = itemsWithTotal.map((item, idx) => ({
      sales_order_id: id,
      product_category: item.product_category,
      product_name: item.product_name,
      description: item.description,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      cost_per_unit: item.cost_per_unit || 0,
      line_total: item.line_total,
      sort_order: idx,
    }));
    await supabase.from('sales_order_items').insert(itemsPayload);
  }

  const { data, error } = await supabase
    .from('sales_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as SalesOrder;
}

// =====================================================================
// TRANSITION STATUS
// =====================================================================
const SO_TRANSITIONS: Record<SOStatus, SOStatus[]> = {
  pending_artwork: ['design_in_progress', 'cancelled'],
  design_in_progress: ['approval_pending', 'cancelled'],
  approval_pending: ['artwork_approved', 'design_in_progress', 'cancelled'],
  artwork_approved: ['in_production'],
  in_production: ['qc'],
  qc: ['packing', 'in_production'],
  packing: ['ready'],
  ready: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

export async function transitionSO(
  id: Uuid,
  to_status: SOStatus,
  reason?: string
): Promise<SalesOrder> {
  const supabase = getSupabaseClient();

  const { data: current, error: fErr } = await supabase
    .from('sales_orders')
    .select('status')
    .eq('id', id)
    .single();
  if (fErr) throw fErr;

  const currentStatus = current.status as SOStatus;
  if (!SO_TRANSITIONS[currentStatus]?.includes(to_status)) {
    throw new Error(`Invalid transition: ${currentStatus} → ${to_status}`);
  }

  const updates: Record<string, any> = { status: to_status };
  if (to_status === 'delivered') updates.delivered_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('sales_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Side effects: auto-create production job when artwork approved
  if (to_status === 'in_production') {
    await autoCreateProductionJob(id);
  }

  // Side effects: auto-create delivery when ready
  if (to_status === 'ready' || to_status === 'packing') {
    await autoCreateDelivery(id);
  }

  // Side effects: auto-create invoice when delivered
  if (to_status === 'delivered') {
    await autoCreateInvoice(id);
  }

  return data as SalesOrder;
}

async function autoCreateProductionJob(soId: Uuid) {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Check if production job already exists
  const { data: existing } = await supabase
    .from('production_jobs')
    .select('id')
    .eq('sales_order_id', soId)
    .maybeSingle();

  if (existing) return;

  // Get SO
  const { data: so } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', soId)
    .single();

  if (!so) return;

  const now = new Date();
  const yearMonth = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const day = String(now.getDate()).padStart(2, '0');
  const prefix = `JOB-${yearMonth}${day}`;

  const { count } = await supabase
    .from('production_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', user.app_metadata.company_id)
    .like('job_number', `${prefix}%`);

  const jobNumber = `${prefix}-${String((count || 0) + 1).padStart(3, '0')}`;

  await supabase.from('production_jobs').insert({
    company_id: user.app_metadata.company_id,
    sales_order_id: soId,
    branch_id: so.branch_id,
    job_number: jobNumber,
    production_type: so.production_type,
    status: 'waiting_schedule',
    due_date: so.due_date,
  });
}

async function autoCreateDelivery(soId: Uuid) {
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from('deliveries')
    .select('id')
    .eq('sales_order_id', soId)
    .maybeSingle();
  if (existing) return;

  const { data: so } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', soId)
    .single();
  if (!so) return;

  await supabase.from('deliveries').insert({
    company_id: so.company_id,
    sales_order_id: soId,
    delivery_type: so.delivery_type,
    status: 'packed',
  });
}

async function autoCreateInvoice(soId: Uuid) {
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('sales_order_id', soId)
    .maybeSingle();
  if (existing) return;

  const { data: so } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', soId)
    .single();
  if (!so) return;

  const year = new Date().getFullYear().toString().slice(-2);
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', so.company_id)
    .like('invoice_number', `INV-${year}%`);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  await supabase.from('invoices').insert({
    company_id: so.company_id,
    sales_order_id: soId,
    customer_id: so.customer_id,
    branch_id: so.branch_id,
    invoice_number: `INV-${year}${String((count || 0) + 1).padStart(5, '0')}`,
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    subtotal: so.subtotal,
    discount_amount: so.discount_amount,
    tax_amount: so.tax_amount,
    total: so.total,
    paid_amount: so.paid_amount || 0,
    outstanding_amount: so.outstanding_amount || so.total,
    status: 'unpaid',
  });
}

// =====================================================================
// LIST
// =====================================================================
export async function listSalesOrders(filters: ListSOFilters = {}): Promise<{
  data: SalesOrder[];
  count: number;
}> {
  const supabase = getSupabaseClient();
  const page = filters.page || 1;
  const pageSize = filters.page_size || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sortBy = filters.sort_by || 'created_at';
  const sortOrder = filters.sort_order || 'desc';

  let query = supabase
    .from('sales_orders')
    .select('*', { count: 'exact' })
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(from, to);

  if (filters.status) {
    if (Array.isArray(filters.status)) query = query.in('status', filters.status);
    else query = query.eq('status', filters.status);
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
  if (error) throw error;
  return { data: (data || []) as SalesOrder[], count: count || 0 };
}

// =====================================================================
// GET
// =====================================================================
export async function getSalesOrder(id: Uuid): Promise<SalesOrder & { items: SalesOrderItem[] }> {
  const supabase = getSupabaseClient();

  const [{ data: so, error: soErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from('sales_orders').select('*').eq('id', id).single(),
    supabase.from('sales_order_items').select('*').eq('sales_order_id', id).order('sort_order'),
  ]);

  if (soErr) throw soErr;
  if (iErr) throw iErr;

  return { ...(so as SalesOrder), items: (items || []) as SalesOrderItem[] };
}
