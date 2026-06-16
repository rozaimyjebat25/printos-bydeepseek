// =====================================================================
// PRINT OS — REPORTING & KPI V1.0
// 5 core KPI queries + dashboard data aggregation
// Cost fields auto-filtered ikut role
// =====================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Uuid, RoleKey, SOStatus } from '../types/domain';
import { canSeeCost, canSeeMargin, canSeeProfit } from '../rbac/defaultMatrix';

type Context = { userId: Uuid; companyId: Uuid; role: RoleKey };

// ============================
// KPI 1: Transaction Capture Rate
// ============================
export type KPITransactionCapture = {
  captured_count: number;
  // estimated_total: this is filled by app — actual count from manual sources
  capture_rate_percent: number;
  period: { start: string; end: string };
};

export async function getTransactionCaptureRate(
  supabase: SupabaseClient,
  context: Context,
  period: { start: string; end: string }
): Promise<KPITransactionCapture> {
  // Count SO created in period
  const { count: captured } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', context.companyId)
    .gte('created_at', period.start)
    .lte('created_at', period.end);

  // For MVP, estimate = captured (when no external system to compare)
  // App can override this with manual count
  const capturedCount = captured || 0;
  const estimatedTotal = capturedCount; // placeholder

  return {
    captured_count: capturedCount,
    capture_rate_percent: estimatedTotal > 0 ? (capturedCount / estimatedTotal) * 100 : 0,
    period,
  };
}

// ============================
// KPI 2: Order Coverage %
// ============================
export async function getOrderCoverage(
  supabase: SupabaseClient,
  context: Context
): Promise<{
  total_orders: number;
  in_system: number;
  coverage_percent: number;
}> {
  const { count: total } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', context.companyId);

  const totalOrders = total || 0;

  return {
    total_orders: totalOrders,
    in_system: totalOrders,
    coverage_percent: totalOrders > 0 ? 100 : 0, // if it's in DB, it's covered
  };
}

// ============================
// KPI 3: Workflow Completion %
// ============================
export async function getWorkflowCompletion(
  supabase: SupabaseClient,
  context: Context,
  period?: { start: string; end: string }
): Promise<{
  total: number;
  completed: number;
  completion_percent: number;
  by_status: Record<string, number>;
}> {
  let query = supabase
    .from('sales_orders')
    .select('status', { count: 'exact' })
    .eq('company_id', context.companyId);

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
    completion_percent: totalCount > 0 ? (completed / totalCount) * 100 : 0,
    by_status: byStatus,
  };
}

// ============================
// KPI 4: Owner Dependency Reduction
// ============================
// Metric: ratio of orders processed without owner activity
// Simplified: count orders where owner is NOT the only actor
export async function getOwnerDependencyScore(
  supabase: SupabaseClient,
  context: Context
): Promise<{
  owner_actions: number;
  total_actions: number;
  dependency_percent: number;
  interpretation: 'high' | 'medium' | 'low';
}> {
  // Audit logs are the source of truth
  const { count: totalActions } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', context.companyId)
    .not('action', 'in', '("LOGIN","LOGOUT")');

  // Find owner user IDs
  const { data: ownerUsers } = await supabase
    .from('users')
    .select('id, role_id, roles!inner(key)')
    .eq('company_id', context.companyId);

  const ownerIds = (ownerUsers || [])
    .filter((u: any) => u.roles?.key === 'owner')
    .map((u) => u.id);

  let ownerActions = 0;
  if (ownerIds.length > 0) {
    const { count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', context.companyId)
      .in('user_id', ownerIds);

    ownerActions = count || 0;
  }

  const total = totalActions || 0;
  const depPercent = total > 0 ? (ownerActions / total) * 100 : 0;

  return {
    owner_actions: ownerActions,
    total_actions: total,
    dependency_percent: round2(depPercent),
    interpretation: depPercent > 60 ? 'high' : depPercent > 30 ? 'medium' : 'low',
  };
}

// ============================
// KPI 5: Gross Profit Visibility %
// ============================
export async function getGrossProfitVisibility(
  supabase: SupabaseClient,
  context: Context
): Promise<{
  total_orders: number;
  orders_with_cost: number;
  visibility_percent: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  avg_margin_percent: number;
}> {
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('total, cost_total, gross_profit, margin_percent')
    .eq('company_id', context.companyId)
    .in('status', ['completed', 'delivered', 'in_production', 'qc', 'packing', 'ready']);

  if (!orders) {
    return {
      total_orders: 0,
      orders_with_cost: 0,
      visibility_percent: 0,
      total_revenue: 0,
      total_cost: 0,
      total_profit: 0,
      avg_margin_percent: 0,
    };
  }

  const totalOrders = orders.length;
  const withCost = orders.filter((o) => o.cost_total > 0);
  const visibilityPercent = totalOrders > 0 ? (withCost.length / totalOrders) * 100 : 0;

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalCost = withCost.reduce((sum, o) => sum + (o.cost_total || 0), 0);
  const totalProfit = withCost.reduce((sum, o) => sum + (o.gross_profit || 0), 0);
  const avgMargin = withCost.length > 0
    ? withCost.reduce((sum, o) => sum + (o.margin_percent || 0), 0) / withCost.length
    : 0;

  return {
    total_orders: totalOrders,
    orders_with_cost: withCost.length,
    visibility_percent: round2(visibilityPercent),
    total_revenue: round2(totalRevenue),
    total_cost: round2(totalCost),
    total_profit: round2(totalProfit),
    avg_margin_percent: round2(avgMargin),
  };
}

// ============================
// DASHBOARD: Owner Overview
// ============================
export type OwnerDashboard = {
  today: {
    new_orders: number;
    revenue: number;
    pending_artwork: number;
    in_production: number;
    awaiting_delivery: number;
  };
  month: {
    total_revenue: number;
    total_profit: number;
    margin_percent: number;
    total_orders: number;
    completed_orders: number;
    completion_rate: number;
  };
  outstanding: {
    total: number;
    overdue: number;
    invoice_count: number;
  };
  production: {
    queue: number;
    overdue: number;
    qc_pending: number;
  };
  kpi: {
    transaction_capture: number;
    order_coverage: number;
    workflow_completion: number;
    owner_dependency: number;
    profit_visibility: number;
  };
};

export async function getOwnerDashboard(
  supabase: SupabaseClient,
  context: Context
): Promise<OwnerDashboard> {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // TODAY
  const { count: todayNew } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', context.companyId)
    .gte('created_at', todayStart);

  const { data: todayOrders } = await supabase
    .from('sales_orders')
    .select('total, cost_total, status')
    .eq('company_id', context.companyId)
    .gte('created_at', todayStart);

  const todayRevenue = (todayOrders || []).reduce((s, o) => s + (o.total || 0), 0);

  const { count: pendingArtwork } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', context.companyId)
    .in('status', ['pending_artwork', 'design_in_progress', 'approval_pending']);

  const { count: inProduction } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', context.companyId)
    .in('status', ['artwork_approved', 'in_production', 'qc', 'packing']);

  const { count: awaitingDelivery } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', context.companyId)
    .in('status', ['ready', 'out_for_delivery']);

  // MONTH
  const { data: monthOrders } = await supabase
    .from('sales_orders')
    .select('total, cost_total, gross_profit, status')
    .eq('company_id', context.companyId)
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
    .eq('company_id', context.companyId)
    .in('status', ['unpaid', 'partial', 'overdue']);

  const outstandingTotal = (outstandingInvoices || []).reduce((s, i) => s + (i.outstanding_amount || 0), 0);
  const today2 = new Date().toISOString().split('T')[0];
  const overdueInvoices = (outstandingInvoices || []).filter((i) => i.due_date && i.due_date < today2);
  const overdueTotal = overdueInvoices.reduce((s, i) => s + (i.outstanding_amount || 0), 0);

  // PRODUCTION BOTTLENECKS
  const { data: prodJobs } = await supabase
    .from('production_jobs')
    .select('status, due_date')
    .eq('company_id', context.companyId)
    .not('status', 'in', '("delivered","cancelled")');

  const queueCount = (prodJobs || []).filter((j) =>
    ['waiting_schedule', 'scheduled', 'printing', 'finishing', 'qc', 'packing'].includes(j.status)
  ).length;
  const overdueJobs = (prodJobs || []).filter((j) => j.due_date && j.due_date < today2).length;
  const qcPending = (prodJobs || []).filter((j) => j.status === 'qc').length;

  // KPI
  const capture = await getTransactionCaptureRate(supabase, context, { start: monthStart, end: monthEnd });
  const coverage = await getOrderCoverage(supabase, context);
  const workflow = await getWorkflowCompletion(supabase, context, { start: monthStart, end: monthEnd });
  const dependency = await getOwnerDependencyScore(supabase, context);
  const profitVis = await getGrossProfitVisibility(supabase, context);

  const result: OwnerDashboard = {
    today: {
      new_orders: todayNew || 0,
      revenue: round2(todayRevenue),
      pending_artwork: pendingArtwork || 0,
      in_production: inProduction || 0,
      awaiting_delivery: awaitingDelivery || 0,
    },
    month: {
      total_revenue: round2(monthRevenue),
      total_profit: round2(monthProfit),
      margin_percent: round2(monthMargin),
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
      transaction_capture: round2(capture.capture_rate_percent),
      order_coverage: round2(coverage.coverage_percent),
      workflow_completion: round2(workflow.completion_percent),
      owner_dependency: dependency.dependency_percent,
      profit_visibility: profitVis.visibility_percent,
    },
  };

  // Strip cost data if role cannot see
  if (!canSeeCost(context.role)) {
    result.month.total_profit = 0;
    result.month.margin_percent = 0;
  }

  return result;
}

// ============================
// REVENUE REPORT (time series)
// ============================
export async function getRevenueTrend(
  supabase: SupabaseClient,
  context: Context,
  period: { start: string; end: string },
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<Array<{ period: string; revenue: number; orders: number; profit: number }>> {
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('total, cost_total, gross_profit, created_at, status')
    .eq('company_id', context.companyId)
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

    if (!grouped[key]) {
      grouped[key] = { revenue: 0, orders: 0, profit: 0 };
    }
    grouped[key].revenue += order.total || 0;
    grouped[key].orders += 1;
    grouped[key].profit += order.gross_profit || 0;
  }

  return Object.entries(grouped)
    .map(([period, data]) => ({
      period,
      revenue: round2(data.revenue),
      orders: data.orders,
      profit: canSeeCost(context.role) ? round2(data.profit) : 0,
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

// ============================
// TOP CUSTOMERS
// ============================
export async function getTopCustomers(
  supabase: SupabaseClient,
  context: Context,
  limit: number = 10
): Promise<Array<{
  customer_id: Uuid;
  name: string;
  total_orders: number;
  total_revenue: number;
  last_order_at: string | null;
}>> {
  const { data } = await supabase
    .from('customers')
    .select('id, name, total_orders, total_revenue, last_order_at')
    .eq('company_id', context.companyId)
    .order('total_revenue', { ascending: false })
    .limit(limit);

  return (data || []).map((c) => ({
    customer_id: c.id,
    name: c.name,
    total_orders: c.total_orders,
    total_revenue: c.total_revenue,
    last_order_at: c.last_order_at,
  }));
}

// ============================
// REPEAT ORDER PREDICTION
// ============================
// Find customers yang order secara berkala
export async function predictRepeatOrders(
  supabase: SupabaseClient,
  context: Context
): Promise<Array<{
  customer_id: Uuid;
  customer_name: string;
  last_product: string;
  days_since_last: number;
  predicted_due_in: number;
  urgency: 'low' | 'medium' | 'high';
}>> {
  // Get all completed SO with customer info
  const { data: orders } = await supabase
    .from('sales_orders')
    .select(`
      customer_id,
      customers!inner(name),
      sales_order_items(product_name, product_category, created_at),
      created_at
    `)
    .eq('company_id', context.companyId)
    .in('status', ['completed', 'delivered'])
    .order('created_at', { ascending: false })
    .limit(500);

  if (!orders) return [];

  // Group by customer
  const byCustomer: Record<Uuid, any[]> = {};
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
    const lastDate = new Date(latest.created_at).getTime();
    const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

    // Calculate avg interval if multiple orders
    let avgInterval = 30; // default
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
    const urgency = daysSince > avgInterval * 0.8 ? 'high' : daysSince > avgInterval * 0.5 ? 'medium' : 'low';

    predictions.push({
      customer_id: customerId,
      customer_name: latest.customers?.name || 'Unknown',
      last_product: lastProduct,
      days_since_last: daysSince,
      predicted_due_in: predictedDueIn,
      urgency,
    });
  }

  // Sort by urgency + days_since
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  predictions.sort((a, b) => {
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return b.days_since_last - a.days_since_last;
  });

  return predictions;
}

// ============================
// HELPER
// ============================
function round2(num: number): number {
  return Math.round(num * 100) / 100;
}
