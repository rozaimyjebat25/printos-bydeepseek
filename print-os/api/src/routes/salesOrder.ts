// =====================================================================
// PRINT OS — Sales Order Routes
// =====================================================================

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseForUser } from '../lib/supabase';

const salesOrder = new Hono();

salesOrder.use('*', authMiddleware);

const SO_TRANSITIONS: Record<string, string[]> = {
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

// =====================================================================
// POST /sales-orders — Create
// =====================================================================
salesOrder.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json();
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const items = body.items || [];
  const subtotal = items.reduce((s: number, i: any) => s + (i.unit_price * i.quantity), 0);
  const discountAmount = (subtotal * (body.discount_percent || 0)) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * (body.tax_percent || 0)) / 100;
  const total = afterDiscount + taxAmount;

  const year = new Date().getFullYear().toString().slice(-2);
  const { count } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', auth.companyId)
    .like('so_number', `SO-${year}%`);
  const soNumber = `SO-${year}${String((count || 0) + 1).padStart(5, '0')}`;

  const { data: so, error: soErr } = await supabase
    .from('sales_orders')
    .insert({
      company_id: auth.companyId,
      branch_id: body.branch_id,
      so_number: soNumber,
      customer_id: body.customer_id,
      quotation_id: body.quotation_id,
      status: 'pending_artwork',
      production_type: body.production_type || 'inhouse',
      due_date: body.due_date,
      rush_order: body.rush_order || false,
      delivery_type: body.delivery_type || 'self_collect',
      delivery_address: body.delivery_address,
      notes: body.notes,
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

  if (soErr) return c.json({ error: soErr.message }, 400);

  if (items.length > 0) {
    const itemsPayload = items.map((item: any, idx: number) => ({
      sales_order_id: so.id,
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
    await supabase.from('sales_order_items').insert(itemsPayload);
  }

  return c.json({ data: so }, 201);
});

// =====================================================================
// GET /sales-orders — List
// =====================================================================
salesOrder.get('/', async (c) => {
  const auth = c.get('auth');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const status = c.req.query('status');
  const customerId = c.req.query('customer_id');
  const rushOnly = c.req.query('rush_only') === 'true';
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('page_size') || '20');
  const sortBy = c.req.query('sort_by') || 'created_at';
  const sortOrder = c.req.query('sort_order') || 'desc';

  let query = supabase
    .from('sales_orders')
    .select('*', { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) {
    if (status.includes(',')) {
      query = query.in('status', status.split(','));
    } else {
      query = query.eq('status', status);
    }
  }
  if (customerId) query = query.eq('customer_id', customerId);
  if (rushOnly) query = query.eq('rush_order', true);

  const { data, count, error } = await query;
  if (error) return c.json({ error: error.message }, 400);

  return c.json({ data, count });
});

// =====================================================================
// GET /sales-orders/:id — Get single
// =====================================================================
salesOrder.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const [{ data: so }, { data: items }] = await Promise.all([
    supabase.from('sales_orders').select('*').eq('id', id).eq('company_id', auth.companyId).single(),
    supabase.from('sales_order_items').select('*').eq('sales_order_id', id).order('sort_order'),
  ]);

  if (!so) return c.json({ error: 'Sales order not found' }, 404);

  let filtered = so;
  if (!['owner', 'management'].includes(auth.role)) {
    filtered = { ...so, cost_total: 0, gross_profit: 0, margin_percent: 0, internal_notes: null };
  }

  let filteredItems = items || [];
  if (!['owner', 'management'].includes(auth.role)) {
    filteredItems = filteredItems.map((item: any) => ({ ...item, cost_per_unit: 0 }));
  }

  return c.json({ data: { ...filtered, items: filteredItems } });
});

// =====================================================================
// PATCH /sales-orders/:id — Update
// =====================================================================
salesOrder.patch('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json();
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const { data: current } = await supabase
    .from('sales_orders')
    .select('status')
    .eq('id', id)
    .single();

  const editableStatuses = ['pending_artwork', 'design_in_progress', 'approval_pending'];
  if (!editableStatuses.includes(current?.status)) {
    return c.json({ error: `Cannot edit SO in status "${current?.status}"` }, 400);
  }

  const updates: Record<string, any> = {};
  if (body.due_date !== undefined) updates.due_date = body.due_date;
  if (body.rush_order !== undefined) updates.rush_order = body.rush_order;
  if (body.delivery_type !== undefined) updates.delivery_type = body.delivery_type;
  if (body.delivery_address !== undefined) updates.delivery_address = body.delivery_address;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.production_type !== undefined) updates.production_type = body.production_type;
  if (['owner', 'management', 'manager'].includes(auth.role) && body.internal_notes !== undefined) {
    updates.internal_notes = body.internal_notes;
  }

  const { data, error } = await supabase
    .from('sales_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data });
});

// =====================================================================
// POST /sales-orders/:id/transition — Status transition with side effects
// =====================================================================
salesOrder.post('/:id/transition', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json();
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const { data: current, error: fErr } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', id)
    .single();

  if (fErr || !current) return c.json({ error: 'Sales order not found' }, 404);

  const toStatus = body.to_status;
  if (!SO_TRANSITIONS[current.status]?.includes(toStatus)) {
    return c.json({ error: `Invalid transition: ${current.status} → ${toStatus}` }, 400);
  }

  const updates: Record<string, any> = { status: toStatus };
  if (toStatus === 'delivered') updates.delivered_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('sales_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);

  // Side effect: create production job when artwork approved
  if (toStatus === 'in_production') {
    const { data: existing } = await supabase
      .from('production_jobs')
      .select('id')
      .eq('sales_order_id', id)
      .maybeSingle();

    if (!existing) {
      const now = new Date();
      const yearMonth = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const day = String(now.getDate()).padStart(2, '0');
      const prefix = `JOB-${yearMonth}${day}`;

      const { count } = await supabase
        .from('production_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', auth.companyId)
        .like('job_number', `${prefix}%`);

      const jobNumber = `${prefix}-${String((count || 0) + 1).padStart(3, '0')}`;

      await supabase.from('production_jobs').insert({
        company_id: auth.companyId,
        sales_order_id: id,
        branch_id: current.branch_id,
        job_number: jobNumber,
        production_type: current.production_type,
        status: 'waiting_schedule',
        due_date: current.due_date,
      });
    }
  }

  // Side effect: create delivery when ready
  if (toStatus === 'ready') {
    const { data: existing } = await supabase
      .from('deliveries')
      .select('id')
      .eq('sales_order_id', id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('deliveries').insert({
        company_id: auth.companyId,
        sales_order_id: id,
        delivery_type: current.delivery_type,
        status: 'packed',
      });
    }
  }

  // Side effect: create invoice when delivered
  if (toStatus === 'delivered') {
    const { data: existing } = await supabase
      .from('invoices')
      .select('id')
      .eq('sales_order_id', id)
      .maybeSingle();

    if (!existing) {
      const year = new Date().getFullYear().toString().slice(-2);
      const { count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', auth.companyId)
        .like('invoice_number', `INV-${year}%`);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      await supabase.from('invoices').insert({
        company_id: auth.companyId,
        sales_order_id: id,
        customer_id: current.customer_id,
        branch_id: current.branch_id,
        invoice_number: `INV-${year}${String((count || 0) + 1).padStart(5, '0')}`,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        subtotal: current.subtotal,
        discount_amount: current.discount_amount,
        tax_amount: current.tax_amount,
        total: current.total,
        paid_amount: current.paid_amount || 0,
        outstanding_amount: current.outstanding_amount || current.total,
        status: 'unpaid',
      });
    }
  }

  return c.json({ data });
});

export default salesOrder;
