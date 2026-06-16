// =====================================================================
// PRINT OS — Quotation API Service
// =====================================================================

import { getSupabaseClient } from '../utils/supabase';
import type {
  Quotation,
  QuotationItem,
  QuotationStatus,
  Uuid,
} from '../types/domain';

export type CreateQuotationInput = {
  customer_id: Uuid;
  lead_id?: Uuid;
  branch_id?: Uuid;
  valid_until?: string;
  notes?: string;
  terms?: string;
  tax_percent?: number;
  discount_percent?: number;
  items: Omit<QuotationItem, 'id' | 'line_total'>[];
};

export type UpdateQuotationInput = {
  valid_until?: string;
  notes?: string;
  terms?: string;
  tax_percent?: number;
  discount_percent?: number;
  items?: Omit<QuotationItem, 'id' | 'line_total'>[];
};

export type ListQuotationFilters = {
  status?: QuotationStatus;
  customer_id?: Uuid;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
};

// =====================================================================
// CREATE
// =====================================================================
export async function createQuotation(input: CreateQuotationInput): Promise<Quotation> {
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

  // Generate number client-side (will be replaced by server-side gen)
  const year = new Date().getFullYear().toString().slice(-2);
  const { count } = await supabase
    .from('quotations')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', user.app_metadata.company_id)
    .like('quotation_no', `QT-${year}%`);
  const quotationNo = `QT-${year}${String((count || 0) + 1).padStart(5, '0')}`;

  const { data: quotation, error: qErr } = await supabase
    .from('quotations')
    .insert({
      company_id: user.app_metadata.company_id,
      branch_id: input.branch_id,
      quotation_no: quotationNo,
      customer_id: input.customer_id,
      lead_id: input.lead_id,
      valid_until: input.valid_until,
      notes: input.notes,
      terms: input.terms,
      status: 'draft',
      subtotal,
      discount_amount: discountAmount,
      discount_percent: input.discount_percent || 0,
      tax_percent: input.tax_percent || 0,
      tax_amount: taxAmount,
      total,
      cost_total: 0, // Set by manager/owner later via separate API
      gross_profit: 0,
      margin_percent: 0,
    })
    .select()
    .single();

  if (qErr) throw qErr;

  const itemsPayload = itemsWithTotal.map((item, idx) => ({
    quotation_id: quotation.id,
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

  const { error: iErr } = await supabase.from('quotation_items').insert(itemsPayload);
  if (iErr) throw iErr;

  return quotation as Quotation;
}

// =====================================================================
// UPDATE
// =====================================================================
export async function updateQuotation(id: Uuid, input: UpdateQuotationInput): Promise<Quotation> {
  const supabase = getSupabaseClient();
  const updates: Record<string, any> = {};

  if (input.valid_until !== undefined) updates.valid_until = input.valid_until;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.terms !== undefined) updates.terms = input.terms;

  // Recalculate if items or percentages changed
  if (input.items || input.tax_percent !== undefined || input.discount_percent !== undefined) {
    const { data: current } = await supabase
      .from('quotations')
      .select('status, discount_percent, tax_percent')
      .eq('id', id)
      .single();

    if (current?.status !== 'draft') {
      throw new Error('Only draft quotations can be modified');
    }

    let items = input.items;
    if (!items) {
      const { data } = await supabase.from('quotation_items').select('*').eq('quotation_id', id);
      items = (data || []).map((d: any) => ({
        product_category: d.product_category,
        product_name: d.product_name,
        description: d.description,
        width: d.width,
        height: d.height,
        quantity: d.quantity,
        unit: d.unit,
        unit_price: d.unit_price,
        cost_per_unit: d.cost_per_unit,
        line_total: d.line_total,
      }));
    }

    const itemsWithTotal = items.map((item) => ({
      ...item,
      line_total: item.unit_price * item.quantity,
    }));

    const subtotal = itemsWithTotal.reduce((s, i) => s + i.line_total, 0);
    const discountPercent = input.discount_percent ?? current?.discount_percent ?? 0;
    const taxPercent = input.tax_percent ?? current?.tax_percent ?? 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * taxPercent) / 100;
    const total = afterDiscount + taxAmount;

    Object.assign(updates, {
      subtotal,
      discount_amount: discountAmount,
      discount_percent: discountPercent,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      total,
    });

    if (input.items) {
      await supabase.from('quotation_items').delete().eq('quotation_id', id);
      const itemsPayload = itemsWithTotal.map((item, idx) => ({
        quotation_id: id,
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
      await supabase.from('quotation_items').insert(itemsPayload);
    }
  }

  const { data, error } = await supabase
    .from('quotations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Quotation;
}

// =====================================================================
// TRANSITION STATUS
// =====================================================================
export async function transitionQuotation(
  id: Uuid,
  to_status: QuotationStatus,
  reason?: string
): Promise<Quotation> {
  const supabase = getSupabaseClient();

  // Workflow state machine (simplified — full version in backend)
  const allowed: Record<QuotationStatus, QuotationStatus[]> = {
    draft: ['sent', 'rejected'],
    sent: ['approved', 'rejected', 'expired'],
    approved: ['converted'],
    rejected: ['draft'],
    expired: ['draft'],
    converted: [],
  };

  const { data: current, error: fErr } = await supabase
    .from('quotations')
    .select('status')
    .eq('id', id)
    .single();
  if (fErr) throw fErr;

  if (!allowed[current.status as QuotationStatus]?.includes(to_status)) {
    throw new Error(`Invalid transition: ${current.status} → ${to_status}`);
  }

  const updates: Record<string, any> = { status: to_status };
  if (to_status === 'approved') updates.approved_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('quotations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Quotation;
}

// =====================================================================
// CONVERT TO SO
// =====================================================================
export async function convertQuotationToSO(quotationId: Uuid): Promise<Uuid> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get quotation + items
  const { data: quotation, error: qErr } = await supabase
    .from('quotations')
    .select('*, quotation_items(*)')
    .eq('id', quotationId)
    .single();

  if (qErr) throw qErr;
  if (quotation.status !== 'approved') {
    throw new Error('Quotation must be approved before conversion');
  }

  // Generate SO number
  const year = new Date().getFullYear().toString().slice(-2);
  const { count } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', user.app_metadata.company_id)
    .like('so_number', `SO-${year}%`);
  const soNumber = `SO-${year}${String((count || 0) + 1).padStart(5, '0')}`;

  // Create SO
  const { data: so, error: soErr } = await supabase
    .from('sales_orders')
    .insert({
      company_id: user.app_metadata.company_id,
      branch_id: quotation.branch_id,
      so_number: soNumber,
      customer_id: quotation.customer_id,
      quotation_id: quotationId,
      status: 'pending_artwork',
      subtotal: quotation.subtotal,
      discount_amount: quotation.discount_amount,
      tax_amount: quotation.tax_amount,
      total: quotation.total,
      cost_total: quotation.cost_total,
      gross_profit: quotation.gross_profit,
      margin_percent: quotation.margin_percent,
      production_type: 'inhouse',
      delivery_type: 'self_collect',
      artwork_status: 'pending',
    })
    .select()
    .single();

  if (soErr) throw soErr;

  // Copy items
  const items = (quotation as any).quotation_items || [];
  if (items.length > 0) {
    const soItems = items.map((item: any, idx: number) => ({
      sales_order_id: so.id,
      product_category: item.product_category,
      product_name: item.product_name,
      description: item.description,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      cost_per_unit: item.cost_per_unit,
      line_total: item.line_total,
      sort_order: idx,
    }));
    await supabase.from('sales_order_items').insert(soItems);
  }

  // Mark quotation as converted
  await supabase
    .from('quotations')
    .update({ status: 'converted', converted_to_so: so.id })
    .eq('id', quotationId);

  return so.id;
}

// =====================================================================
// LIST
// =====================================================================
export async function listQuotations(filters: ListQuotationFilters = {}): Promise<{
  data: Quotation[];
  count: number;
}> {
  const supabase = getSupabaseClient();
  const page = filters.page || 1;
  const pageSize = filters.page_size || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('quotations')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.customer_id) query = query.eq('customer_id', filters.customer_id);
  if (filters.start_date) query = query.gte('created_at', filters.start_date);
  if (filters.end_date) query = query.lte('created_at', filters.end_date);
  if (filters.search) {
    query = query.or(`quotation_no.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data || []) as Quotation[], count: count || 0 };
}

// =====================================================================
// GET
// =====================================================================
export async function getQuotation(id: Uuid): Promise<Quotation & { items: QuotationItem[] }> {
  const supabase = getSupabaseClient();

  const [{ data: quotation, error: qErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from('quotations').select('*').eq('id', id).single(),
    supabase.from('quotation_items').select('*').eq('quotation_id', id).order('sort_order'),
  ]);

  if (qErr) throw qErr;
  if (iErr) throw iErr;

  return { ...(quotation as Quotation), items: (items || []) as QuotationItem[] };
}
