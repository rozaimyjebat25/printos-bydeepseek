// =====================================================================
// PRINT OS — Quotation Routes
// =====================================================================

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseForUser } from '../lib/supabase';

const quotation = new Hono();

quotation.use('*', authMiddleware);

// =====================================================================
// POST /quotations — Create new quotation
// =====================================================================
quotation.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json();
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  // Generate quotation number
  const year = new Date().getFullYear().toString().slice(-2);
  const { count } = await supabase
    .from('quotations')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', auth.companyId)
    .like('quotation_no', `QT-${year}%`);

  const quotationNo = `QT-${year}${String((count || 0) + 1).padStart(5, '0')}`;

  // Calculate totals
  const items = body.items || [];
  const subtotal = items.reduce((s: number, i: any) => s + (i.unit_price * i.quantity), 0);
  const discountAmount = (subtotal * (body.discount_percent || 0)) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * (body.tax_percent || 0)) / 100;
  const total = afterDiscount + taxAmount;

  // Create header
  const { data: quotationRow, error: qErr } = await supabase
    .from('quotations')
    .insert({
      company_id: auth.companyId,
      branch_id: body.branch_id,
      quotation_no: quotationNo,
      customer_id: body.customer_id,
      lead_id: body.lead_id,
      valid_until: body.valid_until,
      notes: body.notes,
      terms: body.terms,
      status: 'draft',
      subtotal,
      discount_amount: discountAmount,
      discount_percent: body.discount_percent || 0,
      tax_percent: body.tax_percent || 0,
      tax_amount: taxAmount,
      total,
      cost_total: body.cost_total || 0,
      gross_profit: body.cost_total ? total - body.cost_total : 0,
      margin_percent: body.cost_total && total > 0 ? ((total - body.cost_total) / total) * 100 : 0,
    })
    .select()
    .single();

  if (qErr) return c.json({ error: qErr.message }, 400);

  // Insert items
  if (items.length > 0) {
    const itemsPayload = items.map((item: any, idx: number) => ({
      quotation_id: quotationRow.id,
      product_category: item.product_category,
      product_name: item.product_name,
      description: item.description,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      unit_price: item.unit_price,
      cost_per_unit: item.cost_per_unit || 0,
      line_total: item.unit_price * item.quantity,
      sort_order: idx,
    }));

    const { error: iErr } = await supabase.from('quotation_items').insert(itemsPayload);
    if (iErr) return c.json({ error: iErr.message }, 400);
  }

  return c.json({ data: quotationRow }, 201);
});

// =====================================================================
// GET /quotations — List quotations
// =====================================================================
quotation.get('/', async (c) => {
  const auth = c.get('auth');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const status = c.req.query('status');
  const customerId = c.req.query('customer_id');
  const search = c.req.query('search');
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('page_size') || '20');

  let query = supabase
    .from('quotations')
    .select('*', { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq('status', status);
  if (customerId) query = query.eq('customer_id', customerId);
  if (search) {
    query = query.or(`quotation_no.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error('[quotations/list] error:', error.message, 'code:', error.code, 'details:', error.details, 'hint:', error.hint);
    return c.json({ error: error.message, code: error.code }, 400);
  }

  return c.json({ data, count });
});

// =====================================================================
// GET /quotations/:id — Get single quotation
// =====================================================================
quotation.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const [{ data: quotation }, { data: items }] = await Promise.all([
    supabase.from('quotations').select('*').eq('id', id).eq('company_id', auth.companyId).single(),
    supabase.from('quotation_items').select('*').eq('quotation_id', id).order('sort_order'),
  ]);

  if (!quotation) return c.json({ error: 'Quotation not found' }, 404);

  // Filter cost fields if role is sales
  let filtered = quotation;
  if (!['owner', 'management'].includes(auth.role)) {
    filtered = { ...quotation, cost_total: 0, gross_profit: 0, margin_percent: 0 };
  }

  let filteredItems = items || [];
  if (!['owner', 'management'].includes(auth.role)) {
    filteredItems = filteredItems.map((item: any) => ({ ...item, cost_per_unit: 0 }));
  }

  return c.json({ data: { ...filtered, items: filteredItems } });
});

// =====================================================================
// PATCH /quotations/:id — Update quotation
// =====================================================================
quotation.patch('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json();
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  // Check status
  const { data: current } = await supabase
    .from('quotations')
    .select('status')
    .eq('id', id)
    .single();

  if (current?.status !== 'draft') {
    return c.json({ error: `Cannot edit quotation in status "${current?.status}". Only draft quotations can be modified.` }, 400);
  }

  const updates: Record<string, any> = {};
  if (body.valid_until !== undefined) updates.valid_until = body.valid_until;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.terms !== undefined) updates.terms = body.terms;
  if (body.tax_percent !== undefined) updates.tax_percent = body.tax_percent;
  if (body.discount_percent !== undefined) updates.discount_percent = body.discount_percent;

  // Recalculate if items
  if (body.items) {
    const subtotal = body.items.reduce((s: number, i: any) => s + (i.unit_price * i.quantity), 0);
    const discountAmount = (subtotal * (body.discount_percent || 0)) / 100;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * (body.tax_percent || 0)) / 100;
    const total = afterDiscount + taxAmount;

    Object.assign(updates, {
      subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total,
    });

    await supabase.from('quotation_items').delete().eq('quotation_id', id);
    const itemsPayload = body.items.map((item: any, idx: number) => ({
      quotation_id: id,
      product_category: item.product_category,
      product_name: item.product_name,
      description: item.description,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      unit_price: item.unit_price,
      cost_per_unit: ['owner', 'management'].includes(auth.role) ? (item.cost_per_unit || 0) : 0,
      line_total: item.unit_price * item.quantity,
      sort_order: idx,
    }));
    await supabase.from('quotation_items').insert(itemsPayload);
  }

  const { data, error } = await supabase
    .from('quotations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data });
});

// =====================================================================
// POST /quotations/:id/transition — Transition status
// =====================================================================
quotation.post('/:id/transition', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json();
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const allowed: Record<string, string[]> = {
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

  if (fErr || !current) return c.json({ error: 'Quotation not found' }, 404);

  const toStatus = body.to_status;
  if (!allowed[current.status]?.includes(toStatus)) {
    return c.json({ error: `Invalid transition: ${current.status} → ${toStatus}` }, 400);
  }

  const updates: Record<string, any> = { status: toStatus };
  if (toStatus === 'approved') updates.approved_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('quotations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data });
});

// =====================================================================
// POST /quotations/:id/convert-to-so — Convert approved quotation to SO
// =====================================================================
quotation.post('/:id/convert-to-so', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const { data: quotation, error: qErr } = await supabase
    .from('quotations')
    .select('*, quotation_items(*)')
    .eq('id', id)
    .single();

  if (qErr || !quotation) return c.json({ error: 'Quotation not found' }, 404);
  if (quotation.status !== 'approved') {
    return c.json({ error: 'Quotation must be approved before conversion' }, 400);
  }

  // Generate SO number
  const year = new Date().getFullYear().toString().slice(-2);
  const { count } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', auth.companyId)
    .like('so_number', `SO-${year}%`);
  const soNumber = `SO-${year}${String((count || 0) + 1).padStart(5, '0')}`;

  // Create SO
  const { data: so, error: soErr } = await supabase
    .from('sales_orders')
    .insert({
      company_id: auth.companyId,
      branch_id: quotation.branch_id,
      so_number: soNumber,
      customer_id: quotation.customer_id,
      quotation_id: quotation.id,
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
      paid_amount: 0,
      outstanding_amount: quotation.total,
    })
    .select()
    .single();

  if (soErr) return c.json({ error: soErr.message }, 400);

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
    .eq('id', id);

  return c.json({ data: { sales_order_id: so.id, so_number: soNumber } });
});

export default quotation;
