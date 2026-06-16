// =====================================================================
// PRINT OS — PRODUCTION / QC / DELIVERY SERVICES V1.0
// Production job workflow + QC records + Delivery tracking
// =====================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ProductionJob,
  QCRecord,
  Delivery,
  ProductionStatus,
  QCStatus,
  DeliveryStatus,
  Uuid,
  RoleKey,
} from '../types/domain';
import {
  validateTransition,
  getAllowedNextStates,
} from '../workflows/stateMachines';
import { AuditableClient, extractContext } from '../audit/auditService';

// ============================
// CONTEXT TYPE
// ============================
type Context = { userId: Uuid; companyId: Uuid; role: RoleKey };

// ============================
// PRODUCTION: TRANSITION STATUS
// ============================
export async function transitionProductionJob(
  supabase: SupabaseClient,
  context: Context,
  jobId: Uuid,
  toStatus: ProductionStatus,
  options?: {
    reason?: string;
    operator_id?: Uuid;
    machine_id?: Uuid;
    scheduled_at?: string;
  }
): Promise<{ data: ProductionJob | null; error: any }> {
  const { data: current, error: fetchError } = await supabase
    .from('production_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (fetchError || !current) {
    return { data: null, error: fetchError || { message: 'Production job not found' } };
  }

  const validation = validateTransition(
    'production',
    current.status,
    toStatus,
    context.role,
    { reason: options?.reason }
  );

  if (!validation.ok) {
    return { data: null, error: { message: validation.message, code: validation.reason } };
  }

  const audit = new AuditableClient(supabase, extractContext(context.userId, context.companyId));

  const updatePayload: Record<string, any> = {
    status: toStatus,
  };

  // Set timestamps based on transition
  if (toStatus === 'scheduled') {
    updatePayload.scheduled_at = options?.scheduled_at || new Date().toISOString();
  }
  if (toStatus === 'printing') {
    updatePayload.started_at = new Date().toISOString();
  }
  if (toStatus === 'packing') {
    updatePayload.finished_at = new Date().toISOString();
  }
  if (toStatus === 'ready') {
    // create_delivery trigger handled separately
  }
  if (options?.operator_id) {
    updatePayload.operator_id = options.operator_id;
  }
  if (options?.machine_id) {
    updatePayload.machine_id = options.machine_id;
  }

  const { data, error } = await audit.update<ProductionJob>('production_jobs', jobId, updatePayload as any);

  // Side effects
  if (validation.triggers.includes('create_delivery') && data) {
    await autoCreateDeliveryForJob(supabase, context, data);
  }

  if (validation.triggers.includes('update_so_status') && data) {
    await cascadeSOStatus(supabase, context, data.sales_order_id, toStatus);
  }

  return { data, error };
}

async function autoCreateDeliveryForJob(
  supabase: SupabaseClient,
  context: Context,
  job: ProductionJob
) {
  // Get SO for delivery type
  const { data: so } = await supabase
    .from('sales_orders')
    .select('delivery_type, delivery_address, customer_id')
    .eq('id', job.sales_order_id)
    .single();

  if (!so) return;

  // Check if delivery already exists
  const { data: existing } = await supabase
    .from('deliveries')
    .select('id')
    .eq('sales_order_id', job.sales_order_id)
    .maybeSingle();

  if (existing) return;

  await supabase.from('deliveries').insert({
    company_id: context.companyId,
    sales_order_id: job.sales_order_id,
    delivery_type: so.delivery_type,
    status: 'packed',
  });
}

async function cascadeSOStatus(
  supabase: SupabaseClient,
  context: Context,
  soId: Uuid,
  productionStatus: ProductionStatus
) {
  const soStatusMap: Partial<Record<ProductionStatus, any>> = {
    packing: 'packing',
    ready: 'ready',
    delivered: 'out_for_delivery',
  };

  const newSOStatus = soStatusMap[productionStatus];
  if (!newSOStatus) return;

  await supabase
    .from('sales_orders')
    .update({ status: newSOStatus })
    .eq('id', soId);
}

// ============================
// PRODUCTION: LIST
// ============================
export async function listProductionJobs(
  supabase: SupabaseClient,
  context: Context,
  filters: {
    status?: ProductionStatus | ProductionStatus[];
    sales_order_id?: Uuid;
    operator_id?: Uuid;
    start_date?: string;
    end_date?: string;
    due_before?: string;
    overdue_only?: boolean;
    page?: number;
    page_size?: number;
  }
): Promise<{ data: ProductionJob[]; count: number; error: any }> {
  const page = filters.page || 1;
  const pageSize = filters.page_size || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('production_jobs')
    .select('*', { count: 'exact' })
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
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
  return { data: (data || []) as ProductionJob[], count: count || 0, error };
}

// ============================
// QC: CREATE RECORD
// ============================
export type CreateQCInput = {
  production_job_id: Uuid;
  checklist: Record<string, any>;
  defects?: string[];
  notes?: string;
  photos?: string[];
};

export async function createQCRecord(
  supabase: SupabaseClient,
  context: Context,
  input: CreateQCInput
): Promise<{ data: QCRecord | null; error: any }> {
  const audit = new AuditableClient(supabase, extractContext(context.userId, context.companyId));

  const { data, error } = await audit.insert<QCRecord>('qc_records', {
    company_id: context.companyId,
    production_job_id: input.production_job_id,
    qc_staff_id: context.userId,
    status: 'pending' as QCStatus,
    checklist: input.checklist,
    defects: input.defects,
    notes: input.notes,
    photos: input.photos,
  } as any);

  return { data, error };
}

// ============================
// QC: TRANSITION STATUS
// ============================
export async function transitionQC(
  supabase: SupabaseClient,
  context: Context,
  qcId: Uuid,
  toStatus: QCStatus,
  options?: { reason?: string; notes?: string; defects?: string[] }
): Promise<{ data: QCRecord | null; error: any }> {
  const { data: current, error: fetchError } = await supabase
    .from('qc_records')
    .select('*')
    .eq('id', qcId)
    .single();

  if (fetchError || !current) {
    return { data: null, error: fetchError || { message: 'QC record not found' } };
  }

  const validation = validateTransition(
    'qc',
    current.status,
    toStatus,
    context.role,
    { reason: options?.reason }
  );

  if (!validation.ok) {
    return { data: null, error: { message: validation.message, code: validation.reason } };
  }

  const audit = new AuditableClient(supabase, extractContext(context.userId, context.companyId));

  const updatePayload: Record<string, any> = {
    status: toStatus,
  };

  if (toStatus === 'passed') {
    updatePayload.passed_at = new Date().toISOString();
    updatePayload.rework_required = false;
  } else if (toStatus === 'failed') {
    updatePayload.failed_at = new Date().toISOString();
    updatePayload.rework_required = true;
  } else if (toStatus === 'rework') {
    updatePayload.rework_required = true;
    updatePayload.rework_notes = options?.notes;
  }

  if (options?.defects) updatePayload.defects = options.defects;
  if (options?.notes) updatePayload.notes = options.notes;

  const { data, error } = await audit.update<QCRecord>('qc_records', qcId, updatePayload as any);

  // Side effects
  if (validation.triggers.includes('update_production_status') && data) {
    if (toStatus === 'passed') {
      await supabase
        .from('production_jobs')
        .update({ status: 'packing' })
        .eq('id', data.production_job_id);
    } else if (toStatus === 'failed' || toStatus === 'rework') {
      await supabase
        .from('production_jobs')
        .update({ status: 'printing' })
        .eq('id', data.production_job_id);
    }
  }

  return { data, error };
}

// ============================
// DELIVERY: TRANSITION
// ============================
export async function transitionDelivery(
  supabase: SupabaseClient,
  context: Context,
  deliveryId: Uuid,
  toStatus: DeliveryStatus,
  options?: {
    reason?: string;
    tracking_no?: string;
    courier_name?: string;
    picked_up_by_name?: string;
    pod_signature_url?: string;
    pod_photo_url?: string;
  }
): Promise<{ data: Delivery | null; error: any }> {
  const { data: current, error: fetchError } = await supabase
    .from('deliveries')
    .select('*')
    .eq('id', deliveryId)
    .single();

  if (fetchError || !current) {
    return { data: null, error: fetchError || { message: 'Delivery not found' } };
  }

  const validation = validateTransition(
    'delivery',
    current.status,
    toStatus,
    context.role,
    { reason: options?.reason }
  );

  if (!validation.ok) {
    return { data: null, error: { message: validation.message, code: validation.reason } };
  }

  const audit = new AuditableClient(supabase, extractContext(context.userId, context.companyId));

  const updatePayload: Record<string, any> = {
    status: toStatus,
  };

  if (toStatus === 'booked') {
    updatePayload.booked_at = new Date().toISOString();
    updatePayload.courier_name = options?.courier_name;
    updatePayload.tracking_no = options?.tracking_no;
  }
  if (toStatus === 'in_transit') {
    updatePayload.collected_at = new Date().toISOString();
  }
  if (toStatus === 'delivered') {
    updatePayload.delivered_at = new Date().toISOString();
    if (options?.pod_signature_url) updatePayload.pod_signature_url = options.pod_signature_url;
    if (options?.pod_photo_url) updatePayload.pod_photo_url = options.pod_photo_url;
    if (current.delivery_type === 'self_collect' && options?.picked_up_by_name) {
      updatePayload.picked_up_at = new Date().toISOString();
      updatePayload.picked_up_by_name = options.picked_up_by_name;
    }
  }

  const { data, error } = await audit.update<Delivery>('deliveries', deliveryId, updatePayload as any);

  // Side effects: update SO status when delivered
  if (toStatus === 'delivered' && data) {
    await supabase
      .from('sales_orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', data.sales_order_id);

    // Auto-create invoice if not exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('sales_order_id', data.sales_order_id)
      .maybeSingle();

    if (!existingInvoice) {
      const { data: so } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('id', data.sales_order_id)
        .single();

      if (so) {
        const year = new Date().getFullYear().toString().slice(-2);
        const { count } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', context.companyId)
          .like('invoice_number', `INV-${year}%`);

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        await supabase.from('invoices').insert({
          company_id: context.companyId,
          sales_order_id: so.id,
          customer_id: so.customer_id,
          branch_id: so.branch_id,
          invoice_number: `INV-${year}${String((count || 0) + 1).padStart(5, '0')}`,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          subtotal: so.subtotal,
          discount_amount: so.discount_amount,
          tax_amount: so.tax_amount,
          total: so.total,
          paid_amount: so.paid_amount || 0,
          outstanding_amount: so.outstanding_amount || so.total,
          status: 'unpaid',
        });
      }
    }
  }

  return { data, error };
}

// ============================
// PRODUCTION QUEUE: bottleneck detection
// ============================
export async function detectBottlenecks(
  supabase: SupabaseClient,
  companyId: Uuid
): Promise<{
  waiting_schedule: number;
  overdue: number;
  qc_pending: number;
  stuck_in_production: number;
}> {
  const { data: allJobs } = await supabase
    .from('production_jobs')
    .select('*')
    .eq('company_id', companyId)
    .not('status', 'in', '("delivered","cancelled")');

  if (!allJobs) {
    return { waiting_schedule: 0, overdue: 0, qc_pending: 0, stuck_in_production: 0 };
  }

  const today = new Date().toISOString().split('T')[0];
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  return {
    waiting_schedule: allJobs.filter((j) => j.status === 'waiting_schedule').length,
    overdue: allJobs.filter((j) => j.due_date && j.due_date < today).length,
    qc_pending: allJobs.filter((j) => j.status === 'qc').length,
    stuck_in_production: allJobs.filter(
      (j) => ['printing', 'finishing', 'scheduled'].includes(j.status) && j.started_at && j.started_at < fourHoursAgo
    ).length,
  };
}
