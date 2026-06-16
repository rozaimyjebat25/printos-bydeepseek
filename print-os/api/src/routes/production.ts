// =====================================================================
// PRINT OS — Production / QC / Delivery Routes
// =====================================================================

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseForUser } from '../lib/supabase';

const production = new Hono();

production.use('*', authMiddleware);

const PROD_TRANSITIONS: Record<string, string[]> = {
  waiting_schedule: ['scheduled', 'cancelled'],
  scheduled: ['printing', 'cancelled'],
  printing: ['finishing'],
  finishing: ['qc'],
  qc: ['packing', 'printing'],
  packing: ['ready'],
  ready: ['delivered'],
  delivered: [],
  cancelled: [],
};

const QC_TRANSITIONS: Record<string, string[]> = {
  pending: ['passed', 'failed', 'rework'],
  passed: [],
  failed: ['rework'],
  rework: ['pending'],
};

const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  pending: ['packed'],
  packed: ['booked', 'delivered'],
  booked: ['in_transit'],
  in_transit: ['delivered', 'failed'],
  delivered: [],
  failed: ['packed'],
};

// =====================================================================
// PRODUCTION JOBS
// =====================================================================
production.get('/jobs', async (c) => {
  const auth = c.get('auth');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const status = c.req.query('status');
  const salesOrderId = c.req.query('sales_order_id');
  const overdueOnly = c.req.query('overdue_only') === 'true';
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('page_size') || '20');

  let query = supabase
    .from('production_jobs')
    .select('*', { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) {
    if (status.includes(',')) query = query.in('status', status.split(','));
    else query = query.eq('status', status);
  }
  if (salesOrderId) query = query.eq('sales_order_id', salesOrderId);
  if (overdueOnly) {
    query = query
      .lt('due_date', new Date().toISOString().split('T')[0])
      .not('status', 'in', '("delivered","cancelled")');
  }

  const { data, count, error } = await query;
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data, count });
});

production.post('/jobs/:id/transition', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json();
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const { data: current } = await supabase
    .from('production_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (!current) return c.json({ error: 'Job not found' }, 404);

  const toStatus = body.to_status;
  if (!PROD_TRANSITIONS[current.status]?.includes(toStatus)) {
    return c.json({ error: `Invalid transition: ${current.status} → ${toStatus}` }, 400);
  }

  const updates: Record<string, any> = { status: toStatus };
  if (toStatus === 'scheduled') updates.scheduled_at = body.scheduled_at || new Date().toISOString();
  if (toStatus === 'printing') updates.started_at = new Date().toISOString();
  if (toStatus === 'packing') updates.finished_at = new Date().toISOString();
  if (body.operator_id) updates.operator_id = body.operator_id;
  if (body.machine_id) updates.machine_id = body.machine_id;

  const { data, error } = await supabase
    .from('production_jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data });
});

production.get('/bottlenecks', async (c) => {
  const auth = c.get('auth');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const { data } = await supabase
    .from('production_jobs')
    .select('status, due_date, started_at')
    .eq('company_id', auth.companyId)
    .not('status', 'in', '("delivered","cancelled")');

  if (!data) return c.json({ data: { waiting_schedule: 0, overdue: 0, qc_pending: 0, stuck_in_production: 0 } });

  const today = new Date().toISOString().split('T')[0];
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  return c.json({
    data: {
      waiting_schedule: data.filter((j) => j.status === 'waiting_schedule').length,
      overdue: data.filter((j: any) => j.due_date && j.due_date < today).length,
      qc_pending: data.filter((j) => j.status === 'qc').length,
      stuck_in_production: data.filter(
        (j) => ['printing', 'finishing', 'scheduled'].includes(j.status) && j.started_at && j.started_at < fourHoursAgo
      ).length,
    },
  });
});

// =====================================================================
// QC
// =====================================================================
production.post('/qc', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json();
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const { data, error } = await supabase
    .from('qc_records')
    .insert({
      company_id: auth.companyId,
      production_job_id: body.production_job_id,
      qc_staff_id: auth.userId,
      status: 'pending',
      checklist: body.checklist || {},
      defects: body.defects,
      notes: body.notes,
      photos: body.photos,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data }, 201);
});

production.post('/qc/:id/transition', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json();
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const { data: current } = await supabase
    .from('qc_records')
    .select('*')
    .eq('id', id)
    .single();

  if (!current) return c.json({ error: 'QC record not found' }, 404);

  const toStatus = body.to_status;
  if (!QC_TRANSITIONS[current.status]?.includes(toStatus)) {
    return c.json({ error: `Invalid transition: ${current.status} → ${toStatus}` }, 400);
  }

  const updates: Record<string, any> = { status: toStatus };
  if (toStatus === 'passed') {
    updates.passed_at = new Date().toISOString();
    updates.rework_required = false;
  } else if (toStatus === 'failed') {
    updates.failed_at = new Date().toISOString();
    updates.rework_required = true;
  } else if (toStatus === 'rework') {
    updates.rework_required = true;
    if (body.notes) updates.rework_notes = body.notes;
  }
  if (body.defects) updates.defects = body.defects;
  if (body.notes) updates.notes = body.notes;

  const { data, error } = await supabase
    .from('qc_records')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);

  // Side effect: update production status
  if (toStatus === 'passed') {
    await supabase
      .from('production_jobs')
      .update({ status: 'packing' })
      .eq('id', current.production_job_id);
  } else if (toStatus === 'failed' || toStatus === 'rework') {
    await supabase
      .from('production_jobs')
      .update({ status: 'printing' })
      .eq('id', current.production_job_id);
  }

  return c.json({ data });
});

// =====================================================================
// DELIVERY
// =====================================================================
production.post('/delivery/:id/transition', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json();
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const { data: current } = await supabase
    .from('deliveries')
    .select('*')
    .eq('id', id)
    .single();

  if (!current) return c.json({ error: 'Delivery not found' }, 404);

  const toStatus = body.to_status;
  if (!DELIVERY_TRANSITIONS[current.status]?.includes(toStatus)) {
    return c.json({ error: `Invalid transition: ${current.status} → ${toStatus}` }, 400);
  }

  const updates: Record<string, any> = { status: toStatus };
  if (toStatus === 'booked') {
    updates.booked_at = new Date().toISOString();
    if (body.courier_name) updates.courier_name = body.courier_name;
    if (body.tracking_no) updates.tracking_no = body.tracking_no;
  }
  if (toStatus === 'in_transit') updates.collected_at = new Date().toISOString();
  if (toStatus === 'delivered') {
    updates.delivered_at = new Date().toISOString();
    if (current.delivery_type === 'self_collect' && body.picked_up_by_name) {
      updates.picked_up_at = new Date().toISOString();
      updates.picked_up_by_name = body.picked_up_by_name;
    }
  }

  const { data, error } = await supabase
    .from('deliveries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);

  if (toStatus === 'delivered') {
    await supabase
      .from('sales_orders')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', current.sales_order_id);
  }

  return c.json({ data });
});

export default production;
