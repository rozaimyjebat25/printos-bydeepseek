// =====================================================================
// PRINT OS — Customer Routes
// =====================================================================

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseForUser } from '../lib/supabase';

const customer = new Hono();

customer.use('*', authMiddleware);

// =====================================================================
// GET /customers — List
// =====================================================================
customer.get('/', async (c) => {
  const auth = c.get('auth');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const search = c.req.query('search');
  const industry = c.req.query('industry_tag');
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('page_size') || '20');

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (search) {
    query = query.or(`name.ilike.%${search}%,company_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  if (industry) query = query.eq('industry_tag', industry);

  const { data, count, error } = await query;
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data, count });
});

// =====================================================================
// POST /customers — Create
// =====================================================================
customer.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json();
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  // Generate customer code
  const { count } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', auth.companyId);

  const customerCode = `CUST-${String((count || 0) + 1).padStart(4, '0')}`;

  const { data, error } = await supabase
    .from('customers')
    .insert({
      company_id: auth.companyId,
      branch_id: body.branch_id,
      customer_code: customerCode,
      name: body.name,
      company_name: body.company_name,
      email: body.email,
      phone: body.phone,
      whatsapp_no: body.whatsapp_no,
      address: body.address,
      customer_type: body.customer_type || 'individual',
      industry_tag: body.industry_tag,
      source: body.source,
      notes: body.notes,
      tags: body.tags,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data }, 201);
});

// =====================================================================
// GET /customers/:id — Get single with orders summary
// =====================================================================
customer.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const [{ data: customer }, { data: orders }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).eq('company_id', auth.companyId).single(),
    supabase.from('sales_orders').select('id, so_number, total, status, created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(50),
  ]);

  if (!customer) return c.json({ error: 'Customer not found' }, 404);

  return c.json({ data: { ...customer, recent_orders: orders || [] } });
});

export default customer;
