// =====================================================================
// PRINT OS — Dashboard & KPI API Service
// =====================================================================

import { getSupabaseClient } from '../utils/supabase';
import type { OwnerDashboard, Uuid, Customer } from '../types/domain';

export type TransactionCapture = {
  captured_count: number;
  capture_rate_percent: number;
  period: { start: string; end: string };
};

export type WorkflowCompletion = {
  total: number;
  completed: number;
  completion_percent: number;
  by_status: Record<string, number>;
};

export type TopCustomer = {
  customer_id: Uuid;
  name: string;
  total_orders: number;
  total_revenue: number;
  last_order_at: string | null;
};

export type RepeatPrediction = {
  customer_id: Uuid;
  customer_name: string;
  last_product: string;
  days_since_last: number;
  predicted_due_in: number;
  urgency: 'low' | 'medium' | 'high';
};

// =====================================================================
// OWNER DASHBOARD (full)
// =====================================================================
export async function getOwnerDashboard(): Promise<OwnerDashboard> {
  const supabase = getSupabaseClient();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // TODAY
  const [
    { count: todayNew },
    { data: todayOrders },
    { count: pendingArtwork },
    { count: inProduction },
    { count: awaitingDelivery },
  ] = await Promise.all([
    supabase.from('sales_orders').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    supabase.from('sales_orders').select('total, cost_total, status').gte('created_at', todayStart),
    supabase.from('sales_orders').select('*', { count: 'exact', head: true }).in('status', ['pending_artwork', 'design_in_progress', 'approval_pending']),
    supabase.from('sales_orders').select('*', { count: 'exact', head: true }).in('status', ['artwork_approved', 'in_production', 'qc', 'packing']),
    supabase.from('sales_orders').select('*', { count: 'exact', head: true }).in('status', ['ready', 'out_for_delivery']),
  ]);

  const todayRevenue = (todayOrders || []).reduce((s, o) => s + (o.total || 0), 0);

  // MONTH
  const { data: monthOrders } = await supabase
    .from('sales_orders')
    .select('total, cost_total, gross_profit, status')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd);

  const monthRevenue = (monthOrders || []).reduce((s, o) => s + (o.total || 0), 0);
  const monthProfit = (monthOrders || []).reduce((s, o) => s + (o.gross_profit || 0), 0);
  const monthMargin = monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0;
  const monthCompleted = (monthOrders || []).filter(
    (o) => o.status === 'completed' || o.status === 'delivered'
  ).length;
  const monthCompletionRate = (monthOrders?.length || 0) > 0
    ? (monthCompleted / monthOrders!.length) * 100
    : 0;

  // OUTSTANDING
  const { data: outstandingInvoices } = await supabase
    .from('invoices')
    .select('outstanding_amount, due_date, status')
    .in('status', ['unpaid', 'partial', 'overdue']);

  const outstandingTotal = (outstandingInvoices || []).reduce((s, i) => s + (i.outstanding_amount || 0), 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueInvoices = (outstandingInvoices || []).filter((i) => i.due_date && i.due_date < todayStr);
  const overdueTotal = overdueInvoices.reduce((s, i) => s + (i.outstanding_amount || 0), 0);

  // PRODUCTION BOTTLENECKS
  const { data: prodJobs } = await supabase
    .from('production_jobs')
    .select('status, due_date')
    .not('status', 'in', '("delivered","cancelled")');

  const queueCount = (prodJobs || []).filter((j) =>
    ['waiting_schedule', 'scheduled', 'printing', 'finishing', 'qc', 'packing'].includes(j.status)
  ).length;
  const overdueJobs = (prodJobs || []).filter((j) => j.due_date && j.due_date < todayStr).length;
  const qcPending = (prodJobs || []).filter((j) => j.status === 'qc').length;

  return {
    today: {
      new_orders: todayNew || 0,
      revenue: Math.round(todayRevenue * 100) / 100,
      pending_artwork: pendingArtwork || 0,
      in_production: inProduction || 0,
      awaiting_delivery: awaitingDelivery || 0,
    },
    month: {
      total_revenue: Math.round(monthRevenue * 100) / 100,
      total_profit: Math.round(monthProfit * 100) / 100,
      margin_percent: Math.round(monthMargin * 100) / 100,
      total_orders: monthOrders?.length || 0,
      completed_orders: monthCompleted,
      completion_rate: Math.round(monthCompletionRate * 100) / 100,
    },
    outstanding: {
      total: Math.round(outstandingTotal * 100) / 100,
      overdue: Math.round(overdueTotal * 100) / 100,
      invoice_count: outstandingInvoices?.length || 0,
    },
    production: {
      queue: queueCount,
      overdue: overdueJobs,
      qc_pending: qcPending,
    },
    kpi: {
      transaction_capture: 100, // placeholder
      order_coverage: 100,
      workflow_completion: Math.round(monthCompletionRate * 100) / 100,
      owner_dependency: 0, // calculated separately
      profit_visibility: monthOrders && monthOrders.length > 0
        ? Math.round((monthOrders.filter((o) => o.cost_total > 0).length / monthOrders.length) * 10000) / 100
        : 0,
    },
  };
}

// =====================================================================
// TRANSACTION CAPTURE RATE
// =====================================================================
export async function getTransactionCaptureRate(period: { start: string; end: string }): Promise<TransactionCapture> {
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', period.start)
    .lte('created_at', period.end);

  return {
    captured_count: count || 0,
    capture_rate_percent: 100, // default — all in system
    period,
  };
}

// =====================================================================
// WORKFLOW COMPLETION
// =====================================================================
export async function getWorkflowCompletion(period?: { start: string; end: string }): Promise<WorkflowCompletion> {
  const supabase = getSupabaseClient();
  let query = supabase.from('sales_orders').select('status', { count: 'exact' });
  if (period) {
    query = query.gte('created_at', period.start).lte('created_at', period.end);
  }

  const { data, count } = await query;
  const rows = data || [];

  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  }

  const completed = (byStatus['completed'] || 0) + (byStatus['delivered'] || 0);
  const totalCount = count || 0;

  return {
    total: totalCount,
    completed,
    completion_percent: totalCount > 0 ? Math.round((completed / totalCount) * 10000) / 100 : 0,
    by_status: byStatus,
  };
}

// =====================================================================
// REVENUE TREND
// =====================================================================
export type RevenueTrendPoint = {
  period: string;
  revenue: number;
  orders: number;
  profit: number;
};

export async function getRevenueTrend(
  period: { start: string; end: string },
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<RevenueTrendPoint[]> {
  const supabase = getSupabaseClient();
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('total, cost_total, gross_profit, created_at, status')
    .gte('created_at', period.start)
    .lte('created_at', period.end)
    .in('status', ['completed', 'delivered', 'in_production', 'qc', 'packing', 'ready']);

  if (!orders) return [];

  const grouped: Record<string, { revenue: number; orders: number; profit: number }> = {};

  for (const order of orders) {
    const date = new Date(order.created_at);
    let key: string;
    if (groupBy === 'day') {
      key = date.toISOString().split('T')[0];
    } else if (groupBy === 'week') {
      const week = getWeekNumber(date);
      key = `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!grouped[key]) grouped[key] = { revenue: 0, orders: 0, profit: 0 };
    grouped[key].revenue += order.total || 0;
    grouped[key].orders += 1;
    grouped[key].profit += order.gross_profit || 0;
  }

  return Object.entries(grouped)
    .map(([period, data]) => ({
      period,
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
      profit: Math.round(data.profit * 100) / 100,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// =====================================================================
// TOP CUSTOMERS
// =====================================================================
export async function getTopCustomers(limit = 10): Promise<TopCustomer[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('customers')
    .select('id, name, total_orders, total_revenue, last_order_at')
    .order('total_revenue', { ascending: false })
    .limit(limit);

  return (data || []).map((c: any) => ({
    customer_id: c.id,
    name: c.name,
    total_orders: c.total_orders,
    total_revenue: c.total_revenue,
    last_order_at: c.last_order_at,
  }));
}

// =====================================================================
// REPEAT ORDER PREDICTION
// =====================================================================
export async function predictRepeatOrders(): Promise<RepeatPrediction[]> {
  const supabase = getSupabaseClient();
  const { data: orders } = await supabase
    .from('sales_orders')
    .select(`
      customer_id,
      customers!inner(name),
      sales_order_items(product_name),
      created_at
    `)
    .in('status', ['completed', 'delivered'])
    .order('created_at', { ascending: false })
    .limit(500);

  if (!orders) return [];

  const byCustomer: Record<string, any[]> = {};
  for (const o of orders) {
    if (!byCustomer[o.customer_id]) byCustomer[o.customer_id] = [];
    byCustomer[o.customer_id].push(o);
  }

  const predictions: RepeatPrediction[] = [];
  const now = Date.now();

  for (const [customerId, customerOrders] of Object.entries(byCustomer)) {
    if (customerOrders.length < 1) continue;

    const sorted = customerOrders.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latest = sorted[0];
    const lastDate = new Date(latest.created_at).getTime();
    const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

    let avgInterval = 30;
    if (sorted.length >= 2) {
      const intervals: number[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const diff = (new Date(sorted[i].created_at).getTime() - new Date(sorted[i + 1].created_at).getTime()) / (1000 * 60 * 60 * 24);
        intervals.push(diff);
      }
      avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }

    const lastProduct = latest.sales_order_items?.[0]?.product_name || 'Unknown';
    const predictedDueIn = Math.max(0, Math.floor(avgInterval - daysSince));
    const urgency: 'low' | 'medium' | 'high' = daysSince > avgInterval * 0.8 ? 'high' : daysSince > avgInterval * 0.5 ? 'medium' : 'low';

    predictions.push({
      customer_id: customerId,
      customer_name: latest.customers?.name || 'Unknown',
      last_product: lastProduct,
      days_since_last: daysSince,
      predicted_due_in: predictedDueIn,
      urgency,
    });
  }

  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  predictions.sort((a, b) => {
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return b.days_since_last - a.days_since_last;
  });

  return predictions;
}

// =====================================================================
// LIST CUSTOMERS (bonus)
// =====================================================================
export async function listCustomers(filters: {
  search?: string;
  industry_tag?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<{ data: Customer[]; count: number }> {
  const supabase = getSupabaseClient();
  const page = filters.page || 1;
  const pageSize = filters.page_size || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }
  if (filters.industry_tag) query = query.eq('industry_tag', filters.industry_tag);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data || []) as Customer[], count: count || 0 };
}
