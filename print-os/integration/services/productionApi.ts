// =====================================================================
// PRINT OS — Production / QC / Delivery API Service
// =====================================================================

import { getSupabaseClient } from '../utils/supabase';
import type {
  ProductionJob,
  QCRecord,
  Delivery,
  ProductionStatus,
  QCStatus,
  DeliveryStatus,
  Uuid,
} from '../types/domain';

export type ListProductionFilters = {
  status?: ProductionStatus | ProductionStatus[];
  sales_order_id?: Uuid;
  operator_id?: Uuid;
  start_date?: string;
  end_date?: string;
  due_before?: string;
  overdue_only?: boolean;
  page?: number;
  page_size?: number;
};

// =====================================================================
// PRODUCTION: TRANSITION
// =====================================================================
const PROD_TRANSITIONS: Record<ProductionStatus, ProductionStatus[]> = {
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

export async function transitionProductionJob(
  id: Uuid,
  to_status: ProductionStatus,
  options?: {
    reason?: string;
    operator_id?: Uuid;
    machine_id?: Uuid;
    scheduled_at?: string;
  }
): Promise<ProductionJob> {
  const supabase = getSupabaseClient();

  const { data: current, error: fErr } = await supabase
    .from('production_jobs')
    .select('status')
    .eq('id', id)
    .single();
  if (fErr) throw fErr;

  const currentStatus = current.status as ProductionStatus;
  if (!PROD_TRANSITIONS[currentStatus]?.includes(to_status)) {
    throw new Error(`Invalid transition: ${currentStatus} → ${to_status}`);
  }

  const updates: Record<string, any> = { status: to_status };
  if (to_status === 'scheduled') updates.scheduled_at = options?.scheduled_at || new Date().toISOString();
  if (to_status === 'printing') updates.started_at = new Date().toISOString();
  if (to_status === 'packing') updates.finished_at = new Date().toISOString();
  if (options?.operator_id) updates.operator_id = options.operator_id;
  if (options?.machine_id) updates.machine_id = options.machine_id;

  const { data, error } = await supabase
    .from('production_jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ProductionJob;
}

// =====================================================================
// PRODUCTION: LIST
// =====================================================================
export async function listProductionJobs(filters: ListProductionFilters = {}): Promise<{
  data: ProductionJob[];
  count: number;
}> {
  const supabase = getSupabaseClient();
  const page = filters.page || 1;
  const pageSize = filters.page_size || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('production_jobs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.status) {
    if (Array.isArray(filters.status)) query = query.in('status', filters.status);
    else query = query.eq('status', filters.status);
  }
  if (filters.sales_order_id) query = query.eq('sales_order_id', filters.sales_order_id);
  if (filters.operator_id) query = query.eq('operator_id', filters.operator_id);
  if (filters.start_date) query = query.gte('created_at', filters.start_date);
  if (filters.end_date) query = query.lte('created_at', filters.end_date);
  if (filters.due_before) query = query.lte('due_date', filters.due_before);
  if (filters.overdue_only) {
    query = query
      .lt('due_date', new Date().toISOString().split('T')[0])
      .not('status', 'in', '("delivered","cancelled")');
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data || []) as ProductionJob[], count: count || 0 };
}

// =====================================================================
// QC: CREATE
// =====================================================================
export async function createQCRecord(input: {
  production_job_id: Uuid;
  checklist: Record<string, any>;
  defects?: string[];
  notes?: string;
  photos?: string[];
}): Promise<QCRecord> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.app_metadata?.company_id) throw new Error('No company context');

  const { data, error } = await supabase
    .from('qc_records')
    .insert({
      company_id: user.app_metadata.company_id,
      production_job_id: input.production_job_id,
      qc_staff_id: user.id,
      status: 'pending',
      checklist: input.checklist,
      defects: input.defects,
      notes: input.notes,
      photos: input.photos,
    })
    .select()
    .single();

  if (error) throw error;
  return data as QCRecord;
}

// =====================================================================
// QC: TRANSITION
// =====================================================================
const QC_TRANSITIONS: Record<QCStatus, QCStatus[]> = {
  pending: ['passed', 'failed', 'rework'],
  passed: [],
  failed: ['rework'],
  rework: ['pending'],
};

export async function transitionQC(
  qcId: Uuid,
  to_status: QCStatus,
  options?: { reason?: string; notes?: string; defects?: string[] }
): Promise<QCRecord> {
  const supabase = getSupabaseClient();

  const { data: current, error: fErr } = await supabase
    .from('qc_records')
    .select('*')
    .eq('id', qcId)
    .single();
  if (fErr) throw fErr;

  const currentStatus = current.status as QCStatus;
  if (!QC_TRANSITIONS[currentStatus]?.includes(to_status)) {
    throw new Error(`Invalid transition: ${currentStatus} → ${to_status}`);
  }

  const updates: Record<string, any> = { status: to_status };
  if (to_status === 'passed') {
    updates.passed_at = new Date().toISOString();
    updates.rework_required = false;
  } else if (to_status === 'failed') {
    updates.failed_at = new Date().toISOString();
    updates.rework_required = true;
  } else if (to_status === 'rework') {
    updates.rework_required = true;
    if (options?.notes) updates.rework_notes = options.notes;
  }
  if (options?.defects) updates.defects = options.defects;
  if (options?.notes) updates.notes = options.notes;

  const { data, error } = await supabase
    .from('qc_records')
    .update(updates)
    .eq('id', qcId)
    .select()
    .single();

  if (error) throw error;

  // Side effect: update production status
  if (to_status === 'passed') {
    await supabase
      .from('production_jobs')
      .update({ status: 'packing' })
      .eq('id', current.production_job_id);
  } else if (to_status === 'failed' || to_status === 'rework') {
    await supabase
      .from('production_jobs')
      .update({ status: 'printing' })
      .eq('id', current.production_job_id);
  }

  return data as QCRecord;
}

// =====================================================================
// DELIVERY: TRANSITION
// =====================================================================
const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ['packed'],
  packed: ['booked', 'delivered'],
  booked: ['in_transit'],
  in_transit: ['delivered', 'failed'],
  delivered: [],
  failed: ['packed'],
};

export async function transitionDelivery(
  id: Uuid,
  to_status: DeliveryStatus,
  options?: {
    reason?: string;
    tracking_no?: string;
    courier_name?: string;
    picked_up_by_name?: string;
  }
): Promise<Delivery> {
  const supabase = getSupabaseClient();

  const { data: current, error: fErr } = await supabase
    .from('deliveries')
    .select('*')
    .eq('id', id)
    .single();
  if (fErr) throw fErr;

  const currentStatus = current.status as DeliveryStatus;
  if (!DELIVERY_TRANSITIONS[currentStatus]?.includes(to_status)) {
    throw new Error(`Invalid transition: ${currentStatus} → ${to_status}`);
  }

  const updates: Record<string, any> = { status: to_status };
  if (to_status === 'booked') {
    updates.booked_at = new Date().toISOString();
    if (options?.courier_name) updates.courier_name = options.courier_name;
    if (options?.tracking_no) updates.tracking_no = options.tracking_no;
  }
  if (to_status === 'in_transit') updates.collected_at = new Date().toISOString();
  if (to_status === 'delivered') {
    updates.delivered_at = new Date().toISOString();
    if (current.delivery_type === 'self_collect' && options?.picked_up_by_name) {
      updates.picked_up_at = new Date().toISOString();
      updates.picked_up_by_name = options.picked_up_by_name;
    }
  }

  const { data, error } = await supabase
    .from('deliveries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Side effect: when delivered, update SO and create invoice
  if (to_status === 'delivered' && data) {
    await supabase
      .from('sales_orders')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', data.sales_order_id);
  }

  return data as Delivery;
}

// =====================================================================
// BOTTLENECK DETECTION
// =====================================================================
export async function detectBottlenecks(): Promise<{
  waiting_schedule: number;
  overdue: number;
  qc_pending: number;
  stuck_in_production: number;
}> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('production_jobs')
    .select('status, due_date, started_at')
    .not('status', 'in', '("delivered","cancelled")');

  if (!data) return { waiting_schedule: 0, overdue: 0, qc_pending: 0, stuck_in_production: 0 };

  const today = new Date().toISOString().split('T')[0];
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  return {
    waiting_schedule: data.filter((j) => j.status === 'waiting_schedule').length,
    overdue: data.filter((j: any) => j.due_date && j.due_date < today).length,
    qc_pending: data.filter((j) => j.status === 'qc').length,
    stuck_in_production: data.filter(
      (j) => ['printing', 'finishing', 'scheduled'].includes(j.status) && j.started_at && j.started_at < fourHoursAgo
    ).length,
  };
}
