// =====================================================================
// PRINT OS — Dashboard & Reporting Routes
// =====================================================================

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseForUser } from '../lib/supabase';

const dashboard = new Hono();

dashboard.use('*', authMiddleware);

// =====================================================================
// GET /dashboard/owner — Full owner dashboard
// =====================================================================
dashboard.get('/owner', async (c) => {
  const auth = c.get('auth');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const todayStr = today.toISOString().split('T')[0];

  // Parallel queries
  const [
    { count: todayNew },
    { data: todayOrders },
    { count: pendingArtwork },
    { count: inProduction },
    { count: awaitingDelivery },
    { data: monthOrders },
    { data: outstandingInvoices },
    { data: prodJobs },
  ] = await Promise.all([
    supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('company_id', auth.companyId).gte('created_at', todayStart),
    supabase.from('sales_orders').select('total, cost_total, status').eq('company_id', auth.companyId).gte('created_at', todayStart),
    supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('company_id', auth.companyId).in('status', ['pending_artwork', 'design_in_progress', 'approval_pending']),
    supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('company_id', auth.companyId).in('status', ['artwork_approved', 'in_production', 'qc', 'packing']),
    supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('company_id', auth.companyId).in('status', ['ready', 'out_for_delivery']),
    supabase.from('sales_orders').select('total, cost_total, gross_profit, status').eq('company_id', auth.companyId).gte('created_at', monthStart).lte('created_at', monthEnd),
    supabase.from('invoices').select('outstanding_amount, due_date, status').eq('company_id', auth.companyId).in('status', ['unpaid', 'partial', 'overdue']),
    supabase.from('production_jobs').select('status, due_date').eq('company_id', auth.companyId).not('status', 'in', '("delivered","cancelled")'),
  ]);

  const todayRevenue = (todayOrders || []).reduce((s, o) => s + (o.total || 0), 0);
  const monthRevenue = (monthOrders || []).reduce((s, o) => s + (o.total || 0), 0);
  const monthProfit = (monthOrders || []).reduce((s, o) => s + (o.gross_profit || 0), 0);
  const monthMargin = monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0;
  const monthCompleted = (monthOrders || []).filter((o) => o.status === 'completed' || o.status === 'delivered').length;
  const monthCompletionRate = (monthOrders?.length || 0) > 0 ? (monthCompleted / monthOrders!.length) * 100 : 0;

  const outstandingTotal = (outstandingInvoices || []).reduce((s, i) => s + (i.outstanding_amount || 0), 0);
  const overdueTotal = (outstandingInvoices || [])
    .filter((i) => i.due_date && i.due_date < todayStr)
    .reduce((s, i) => s + (i.outstanding_amount || 0), 0);

  const queueCount = (prodJobs || []).filter((j) => ['waiting_schedule', 'scheduled', 'printing', 'finishing', 'qc', 'packing'].includes(j.status)).length;
  const overdueJobs = (prodJobs || []).filter((j) => j.due_date && j.due_date < todayStr).length;
  const qcPending = (prodJobs || []).filter((j) => j.status === 'qc').length;

  const result: any = {
    today: {
      new_orders: todayNew || 0,
      revenue: round2(todayRevenue),
      pending_artwork: pendingArtwork || 0,
      in_production: inProduction || 0,
      awaiting_delivery: awaitingDelivery || 0,
    },
    month: {
      total_revenue: round2(monthRevenue),
      total_orders: monthOrders?.length || 0,
      completed_orders: monthCompleted,
      completion_rate: round2(monthCompletionRate),
    },
    outstanding: {
      total: round2(outstandingTotal),
      overdue: round2(overdueTotal),
      invoice_count: outstandingInvoices?.length || 0,
    },
    production: {
      queue: queueCount,
      overdue: overdueJobs,
      qc_pending: qcPending,
    },
    kpi: {
      transaction_capture: 100,
      order_coverage: 100,
      workflow_completion: round2(monthCompletionRate),
      owner_dependency: 0,
      profit_visibility: monthOrders && monthOrders.length > 0
        ? round2((monthOrders.filter((o) => o.cost_total > 0).length / monthOrders.length) * 100)
        : 0,
    },
  };

  // Strip cost for non-finance roles
  if (['owner', 'management'].includes(auth.role)) {
    result.month.total_profit = round2(monthProfit);
    result.month.margin_percent = round2(monthMargin);
  } else {
    result.month.total_profit = 0;
    result.month.margin_percent = 0;
  }

  return c.json({ data: result });
});

// =====================================================================
// GET /dashboard/repeat-predictions
// =====================================================================
dashboard.get('/repeat-predictions', async (c) => {
  const auth = c.get('auth');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const { data: orders } = await supabase
    .from('sales_orders')
    .select(`
      customer_id,
      customers!inner(name),
      sales_order_items(product_name),
      created_at
    `)
    .eq('company_id', auth.companyId)
    .in('status', ['completed', 'delivered'])
    .order('created_at', { ascending: false })
    .limit(500);

  if (!orders) return c.json({ data: [] });

  const byCustomer: Record<string, any[]> = {};
  for (const o of orders) {
    if (!byCustomer[o.customer_id]) byCustomer[o.customer_id] = [];
    byCustomer[o.customer_id].push(o);
  }

  const predictions: any[] = [];
  const now = Date.now();

  for (const [customerId, customerOrders] of Object.entries(byCustomer)) {
    if (customerOrders.length < 1) continue;
    const sorted = customerOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = sorted[0];
    const daysSince = Math.floor((now - new Date(latest.created_at).getTime()) / (1000 * 60 * 60 * 24));

    let avgInterval = 30;
    if (sorted.length >= 2) {
      const intervals: number[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        intervals.push((new Date(sorted[i].created_at).getTime() - new Date(sorted[i + 1].created_at).getTime()) / (1000 * 60 * 60 * 24));
      }
      avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }

    const urgency: 'low' | 'medium' | 'high' = daysSince > avgInterval * 0.8 ? 'high' : daysSince > avgInterval * 0.5 ? 'medium' : 'low';

    predictions.push({
      customer_id: customerId,
      customer_name: latest.customers?.name || 'Unknown',
      last_product: latest.sales_order_items?.[0]?.product_name || 'Unknown',
      days_since_last: daysSince,
      predicted_due_in: Math.max(0, Math.floor(avgInterval - daysSince)),
      urgency,
    });
  }

  const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  predictions.sort((a, b) => {
    const aUrg = urgencyOrder[a.urgency] ?? 99;
    const bUrg = urgencyOrder[b.urgency] ?? 99;
    if (aUrg !== bUrg) return aUrg - bUrg;
    return b.days_since_last - a.days_since_last;
  });

  return c.json({ data: predictions });
});

// =====================================================================
// GET /dashboard/revenue-trend
// =====================================================================
dashboard.get('/revenue-trend', async (c) => {
  const auth = c.get('auth');
  const supabase = getSupabaseForUser(c.req.header('Authorization')!.slice(7));

  const start = c.req.query('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = c.req.query('end') || new Date().toISOString();
  const groupBy = (c.req.query('group_by') || 'day') as 'day' | 'week' | 'month';

  const { data: orders } = await supabase
    .from('sales_orders')
    .select('total, cost_total, gross_profit, created_at, status')
    .eq('company_id', auth.companyId)
    .gte('created_at', start)
    .lte('created_at', end)
    .in('status', ['completed', 'delivered', 'in_production', 'qc', 'packing', 'ready']);

  if (!orders) return c.json({ data: [] });

  const grouped: Record<string, { revenue: number; orders: number; profit: number }> = {};
  for (const o of orders) {
    const date = new Date(o.created_at);
    let key: string;
    if (groupBy === 'day') key = date.toISOString().split('T')[0];
    else if (groupBy === 'week') {
      const week = getWeekNumber(date);
      key = `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
    } else key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!grouped[key]) grouped[key] = { revenue: 0, orders: 0, profit: 0 };
    grouped[key].revenue += o.total || 0;
    grouped[key].orders += 1;
    grouped[key].profit += o.gross_profit || 0;
  }

  const result = Object.entries(grouped)
    .map(([period, data]) => ({
      period,
      revenue: round2(data.revenue),
      orders: data.orders,
      profit: ['owner', 'management'].includes(auth.role) ? round2(data.profit) : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return c.json({ data: result });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default dashboard;
