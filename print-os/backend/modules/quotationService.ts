// =====================================================================
// PRINT OS — QUOTATION SERVICE V1.0
// Quotation transaction engine: create, update, send, approve, convert
// Cost fields auto-filtered ikut role (sales tak nampak cost/margin)
// =====================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Quotation,
  QuotationItem,
  QuotationStatus,
  Uuid,
  Money,
  RoleKey,
} from '../types/domain';
import {
  filterSensitiveFields,
  canSeeCost,
  canSeeMargin,
} from '../rbac/defaultMatrix';
import { validateTransition, getAllowedNextStates } from '../workflows/stateMachines';
import { AuditableClient, extractContext } from '../audit/auditService';

// ============================
// TYPES
// ============================
export type CreateQuotationInput = {
  customer_id: Uuid;
  lead_id?: Uuid;
  branch_id?: Uuid;
  valid_until?: string;
  notes?: string;
  terms?: string;
  items: CreateQuotationItemInput[];
  tax_percent?: number;
  discount_percent?: number;
};

export type CreateQuotationItemInput = {
  product_category?: string;
  product_name: string;
  description?: string;
  width?: number;
  height?: number;
  quantity: number;
  unit?: string;
  unit_price: Money;
  cost_per_unit?: Money; // optional, ignored if user is sales
  notes?: string;
};

export type UpdateQuotationInput = Partial<{
  valid_until: string;
  notes: string;
  terms: string;
  items: CreateQuotationItemInput[];
  tax_percent: number;
  discount_percent: number;
}>;

export type TransitionQuotationInput = {
  quotation_id: Uuid;
  to_status: QuotationStatus;
  reason?: string;
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

// ============================
// HELPER: Calculate totals
// ============================
function calculateTotals(
  items: CreateQuotationItemInput[],
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
// HELPER: Generate Quotation Number
// ============================
async function generateQuotationNumber(
  supabase: SupabaseClient,
  companyId: Uuid
): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = `QT-${year}`;

  const { count, error } = await supabase
    .from('quotations')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .like('quotation_no', `${prefix}%`);

  if (error) throw error;

  const nextNum = (count || 0) + 1;
  return `${prefix}${String(nextNum).padStart(5, '0')}`;
}

// ============================
// CREATE QUOTATION
// ============================
export async function createQuotation(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  input: CreateQuotationInput
): Promise<{ data: Quotation | null; error: any }> {
  const audit = new AuditableClient(supabase, extractContext(context.userId, context.companyId));
  const quotationNo = await generateQuotationNumber(supabase, context.companyId);

  const totals = calculateTotals(
    input.items,
    input.discount_percent || 0,
    input.tax_percent || 0
  );

  // Sales tidak boleh set cost — paksa 0
  const items = input.items.map((item) => ({
    ...item,
    cost_per_unit: canSeeCost(context.role) ? item.cost_per_unit || 0 : 0,
  }));

  // 1. Insert quotation header
  const { data: quotation, error: headerError } = await audit.insert<Quotation>(
    'quotations',
    {
      company_id: context.companyId,
      branch_id: input.branch_id,
      quotation_no: quotationNo,
      customer_id: input.customer_id,
      lead_id: input.lead_id,
      valid_until: input.valid_until,
      notes: input.notes,
      terms: input.terms,
      status: 'draft' as QuotationStatus,
      ...totals,
    } as any
  );

  if (headerError || !quotation) {
    return { data: null, error: headerError };
  }

  // 2. Insert items
  const itemsPayload = items.map((item, index) => ({
    quotation_id: quotation.id,
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
    .from('quotation_items')
    .insert(itemsPayload);

  if (itemsError) {
    // Rollback: delete quotation
    await supabase.from('quotations').delete().eq('id', quotation.id);
    return { data: null, error: itemsError };
  }

  return { data: quotation, error: null };
}

// ============================
// UPDATE QUOTATION (only if draft)
// ============================
export async function updateQuotation(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  quotationId: Uuid,
  input: UpdateQuotationInput
): Promise<{ data: Quotation | null; error: any }> {
  // Check status first
  const { data: existing, error: fetchError } = await supabase
    .from('quotations')
    .select('status')
    .eq('id', quotationId)
    .single();

  if (fetchError) return { data: null, error: fetchError };
  if (existing.status !== 'draft') {
    return {
      data: null,
      error: { message: `Cannot edit quotation in status "${existing.status}". Only draft quotations can be modified.` },
    };
  }

  const audit = new AuditableClient(supabase, extractContext(context.userId, context.companyId));

  // Recalculate totals if items changed
  if (input.items) {
    const totals = calculateTotals(
      input.items,
      input.discount_percent || 0,
      input.tax_percent || 0
    );

    // Delete old items
    await supabase
      .from('quotation_items')
      .delete()
      .eq('quotation_id', quotationId);

    // Insert new items
    const itemsPayload = input.items.map((item, index) => ({
      quotation_id: quotationId,
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

    await supabase.from('quotation_items').insert(itemsPayload);

    // Update header with new totals
    const { data, error } = await audit.update<Quotation>(
      'quotations',
      quotationId,
      {
        valid_until: input.valid_until,
        notes: input.notes,
        terms: input.terms,
        ...totals,
      } as any
    );

    return { data, error };
  }

  // No items change — just update header fields
  const { data, error } = await audit.update<Quotation>('quotations', quotationId, {
    valid_until: input.valid_until,
    notes: input.notes,
    terms: input.terms,
  } as any);

  return { data, error };
}

// ============================
// TRANSITION QUOTATION STATUS
// ============================
export async function transitionQuotation(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  input: TransitionQuotationInput
): Promise<{ data: Quotation | null; error: any }> {
  // Get current quotation
  const { data: current, error: fetchError } = await supabase
    .from('quotations')
    .select('*')
    .eq('id', input.quotation_id)
    .single();

  if (fetchError || !current) {
    return { data: null, error: fetchError || { message: 'Quotation not found' } };
  }

  // Validate transition
  const validation = validateTransition(
    'quotation',
    current.status,
    input.to_status,
    context.role,
    { reason: input.reason }
  );

  if (!validation.ok) {
    return { data: null, error: { message: validation.message, code: validation.reason } };
  }

  const audit = new AuditableClient(supabase, extractContext(context.userId, context.companyId));

  // Build update payload
  const updatePayload: Record<string, any> = {
    status: input.to_status,
  };

  if (input.to_status === 'approved') {
    updatePayload.approved_at = new Date().toISOString();
  }

  const { data, error } = await audit.update<Quotation>(
    'quotations',
    input.quotation_id,
    updatePayload as any
  );

  // If converted to SO, set converted_to_so
  if (input.to_status === 'converted' && data) {
    // This will be handled by sales_order service
  }

  return { data, error };
}

// ============================
// GET QUOTATION BY ID (with role-based filtering)
// ============================
export async function getQuotation(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  quotationId: Uuid
): Promise<{ data: (Quotation & { items: QuotationItem[] }) | null; error: any }> {
  const { data: quotation, error: qError } = await supabase
    .from('quotations')
    .select('*')
    .eq('id', quotationId)
    .single();

  if (qError || !quotation) {
    return { data: null, error: qError };
  }

  const { data: items, error: iError } = await supabase
    .from('quotation_items')
    .select('*')
    .eq('quotation_id', quotationId)
    .order('sort_order', { ascending: true });

  if (iError) {
    return { data: null, error: iError };
  }

  // Filter cost fields by role
  const filteredQuotation = filterSensitiveFields(quotation, 'quotations', context.role);
  const filteredItems = (items || []).map((item) =>
    filterSensitiveFields(item, 'quotation_items', context.role)
  );

  return {
    data: { ...filteredQuotation, items: filteredItems } as any,
    error: null,
  };
}

// ============================
// LIST QUOTATIONS (paginated, role-filtered)
// ============================
export async function listQuotations(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  filters: ListQuotationFilters
): Promise<{ data: Quotation[]; count: number; error: any }> {
  const page = filters.page || 1;
  const pageSize = filters.page_size || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('quotations')
    .select('*', { count: 'exact' })
    .eq('company_id', context.companyId)
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

  if (error) {
    return { data: [], count: 0, error };
  }

  // Filter cost fields by role
  const filteredData = (data || []).map((q) => filterSensitiveFields(q, 'quotations', context.role));

  return { data: filteredData as Quotation[], count: count || 0, error: null };
}

// ============================
// GET ALLOWED TRANSITIONS
// ============================
export function getQuotationNextStates(currentStatus: QuotationStatus, role: RoleKey): string[] {
  return getAllowedNextStates('quotation', currentStatus, role);
}

// ============================
// DUPLICATE QUOTATION (clone)
// ============================
export async function duplicateQuotation(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  quotationId: Uuid
): Promise<{ data: Quotation | null; error: any }> {
  const { data: original, error } = await getQuotation(supabase, context, quotationId);

  if (error || !original) {
    return { data: null, error };
  }

  return createQuotation(supabase, context, {
    customer_id: original.customer_id,
    branch_id: original.branch_id,
    valid_until: original.valid_until,
    notes: original.notes,
    terms: original.terms,
    discount_percent: original.discount_percent,
    tax_percent: original.tax_percent,
    items: original.items.map((item) => ({
      product_category: item.product_category || undefined,
      product_name: item.product_name,
      description: item.description || undefined,
      width: item.width || undefined,
      height: item.height || undefined,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      cost_per_unit: canSeeCost(context.role) ? item.cost_per_unit : undefined,
    })),
  });
}

// ============================
// CONVERT QUOTATION TO SALES ORDER
// ============================
export async function convertQuotationToSO(
  supabase: SupabaseClient,
  context: { userId: Uuid; companyId: Uuid; role: RoleKey },
  quotationId: Uuid
): Promise<{ data: { quotation: Quotation; sales_order_id: Uuid } | null; error: any }> {
  // Validate quotation is approved
  const { data: quotation, error: fetchError } = await supabase
    .from('quotations')
    .select('*')
    .eq('id', quotationId)
    .single();

  if (fetchError || !quotation) {
    return { data: null, error: fetchError };
  }

  if (quotation.status !== 'approved') {
    return {
      data: null,
      error: { message: `Quotation must be approved before conversion. Current status: ${quotation.status}` },
    };
  }

  // Get items
  const { data: items } = await supabase
    .from('quotation_items')
    .select('*')
    .eq('quotation_id', quotationId);

  // Generate SO number
  const year = new Date().getFullYear().toString().slice(-2);
  const { count } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', context.companyId)
    .like('so_number', `SO-${year}%`);

  const soNumber = `SO-${year}${String((count || 0) + 1).padStart(5, '0')}`;

  const audit = new AuditableClient(supabase, extractContext(context.userId, context.companyId));

  // Create SO
  const { data: so, error: soError } = await audit.insert<any>('sales_orders', {
    company_id: context.companyId,
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
  });

  if (soError || !so) {
    return { data: null, error: soError };
  }

  // Copy items to SO
  if (items && items.length > 0) {
    const soItems = items.map((item, index) => ({
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
      notes: item.notes,
      sort_order: index,
    }));

    await supabase.from('sales_order_items').insert(soItems);
  }

  // Update quotation status to converted
  await transitionQuotation(supabase, context, {
    quotation_id: quotationId,
    to_status: 'converted',
  });

  // Link SO back to quotation
  await supabase
    .from('quotations')
    .update({ converted_to_so: so.id })
    .eq('id', quotationId);

  return {
    data: { quotation: { ...quotation, status: 'converted' }, sales_order_id: so.id },
    error: null,
  };
}
