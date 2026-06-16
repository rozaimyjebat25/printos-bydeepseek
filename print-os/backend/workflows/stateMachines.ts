// =====================================================================
// PRINT OS — WORKFLOW STATE MACHINE V1.0
// Defines allowed transitions, role permissions, triggers, automations
// untuk semua modul teras.
// =====================================================================

import type {
  SOStatus,
  ProductionStatus,
  QCStatus,
  DeliveryStatus,
  InvoiceStatus,
  QuotationStatus,
  ArtworkLifecycleStatus,
  LeadStatus,
  RoleKey,
} from '../types/domain';

// ============================
// TRANSITION TYPES
// ============================
export type Transition = {
  from: string;
  to: string;
  allowedRoles: RoleKey[];
  requiresReason?: boolean;
  triggers?: WorkflowTrigger[];
};

export type WorkflowTrigger =
  | 'create_production_job'
  | 'create_delivery'
  | 'create_invoice'
  | 'send_notification'
  | 'send_whatsapp'
  | 'update_health_score'
  | 'lock_artwork'
  | 'unlock_artwork'
  | 'log_audit'
  | 'recalculate_totals'
  | 'create_revision'
  | 'update_artwork_status'
  | 'update_so_status';

// ============================
// LEAD WORKFLOW
// ============================
export const LEAD_TRANSITIONS: Transition[] = [
  { from: 'new', to: 'contacted', allowedRoles: ['owner', 'management', 'manager', 'sales'], triggers: ['send_notification', 'log_audit'] },
  { from: 'contacted', to: 'qualified', allowedRoles: ['owner', 'management', 'manager', 'sales'], triggers: ['send_notification', 'log_audit'] },
  { from: 'contacted', to: 'lost', allowedRoles: ['owner', 'management', 'manager', 'sales'], requiresReason: true, triggers: ['send_notification', 'log_audit'] },
  { from: 'qualified', to: 'quotation_sent', allowedRoles: ['owner', 'management', 'manager', 'sales'], triggers: ['log_audit'] },
  { from: 'qualified', to: 'lost', allowedRoles: ['owner', 'management', 'manager', 'sales'], requiresReason: true, triggers: ['send_notification', 'log_audit'] },
  { from: 'quotation_sent', to: 'won', allowedRoles: ['owner', 'management', 'manager', 'sales'], triggers: ['send_notification', 'log_audit'] },
  { from: 'quotation_sent', to: 'lost', allowedRoles: ['owner', 'management', 'manager', 'sales'], requiresReason: true, triggers: ['send_notification', 'log_audit'] },
];

// ============================
// QUOTATION WORKFLOW
// ============================
export const QUOTATION_TRANSITIONS: Transition[] = [
  { from: 'draft', to: 'sent', allowedRoles: ['owner', 'management', 'manager', 'sales'], triggers: ['send_whatsapp', 'send_notification', 'log_audit'] },
  { from: 'sent', to: 'approved', allowedRoles: ['owner', 'management', 'manager', 'sales'], triggers: ['send_notification', 'log_audit'] },
  { from: 'sent', to: 'rejected', allowedRoles: ['owner', 'management', 'manager', 'sales'], requiresReason: true, triggers: ['send_notification', 'log_audit'] },
  { from: 'sent', to: 'expired', allowedRoles: ['owner', 'management', 'manager', 'sales'], triggers: ['send_notification', 'log_audit'] },
  { from: 'approved', to: 'converted', allowedRoles: ['owner', 'management', 'manager', 'sales'], triggers: ['log_audit'] },
  { from: 'draft', to: 'rejected', allowedRoles: ['owner', 'management', 'manager', 'sales'], requiresReason: true, triggers: ['log_audit'] },
  { from: 'rejected', to: 'draft', allowedRoles: ['owner', 'management', 'manager', 'sales'], triggers: ['log_audit'] },
  { from: 'expired', to: 'draft', allowedRoles: ['owner', 'management', 'manager', 'sales'], triggers: ['log_audit'] },
];

// ============================
// SALES ORDER WORKFLOW
// ============================
export const SO_TRANSITIONS: Transition[] = [
  {
    from: 'pending_artwork',
    to: 'design_in_progress',
    allowedRoles: ['owner', 'management', 'manager', 'designer'],
    triggers: ['log_audit'],
  },
  {
    from: 'design_in_progress',
    to: 'approval_pending',
    allowedRoles: ['owner', 'management', 'manager', 'designer'],
    triggers: ['send_whatsapp', 'send_notification', 'log_audit'],
  },
  {
    from: 'approval_pending',
    to: 'artwork_approved',
    allowedRoles: ['owner', 'management', 'manager', 'customer'],
    triggers: ['lock_artwork', 'log_audit'],
  },
  {
    from: 'approval_pending',
    to: 'design_in_progress',
    allowedRoles: ['owner', 'management', 'manager', 'customer', 'designer'],
    requiresReason: true,
    triggers: ['create_revision', 'log_audit'],
  },
  {
    from: 'artwork_approved',
    to: 'in_production',
    allowedRoles: ['owner', 'management', 'manager', 'production'],
    triggers: ['create_production_job', 'send_notification', 'log_audit'],
  },
  {
    from: 'in_production',
    to: 'qc',
    allowedRoles: ['owner', 'management', 'manager', 'production'],
    triggers: ['log_audit'],
  },
  {
    from: 'qc',
    to: 'packing',
    allowedRoles: ['owner', 'management', 'manager', 'production'],
    triggers: ['log_audit'],
  },
  {
    from: 'qc',
    to: 'in_production',
    allowedRoles: ['owner', 'management', 'manager', 'production'],
    requiresReason: true,
    triggers: ['send_notification', 'log_audit'],
  },
  {
    from: 'packing',
    to: 'ready',
    allowedRoles: ['owner', 'management', 'manager', 'production'],
    triggers: ['create_delivery', 'send_whatsapp', 'log_audit'],
  },
  {
    from: 'ready',
    to: 'out_for_delivery',
    allowedRoles: ['owner', 'management', 'manager', 'production'],
    triggers: ['send_whatsapp', 'log_audit'],
  },
  {
    from: 'ready',
    to: 'delivered',
    allowedRoles: ['owner', 'management', 'manager', 'customer'],
    triggers: ['create_invoice', 'log_audit'],
  },
  {
    from: 'out_for_delivery',
    to: 'delivered',
    allowedRoles: ['owner', 'management', 'manager', 'production', 'customer'],
    triggers: ['create_invoice', 'log_audit'],
  },
  {
    from: 'delivered',
    to: 'completed',
    allowedRoles: ['owner', 'management', 'manager'],
    triggers: ['send_whatsapp', 'log_audit'],
  },
  {
    from: 'pending_artwork',
    to: 'cancelled',
    allowedRoles: ['owner', 'management'],
    requiresReason: true,
    triggers: ['send_notification', 'log_audit'],
  },
  {
    from: 'design_in_progress',
    to: 'cancelled',
    allowedRoles: ['owner', 'management'],
    requiresReason: true,
    triggers: ['send_notification', 'log_audit'],
  },
  {
    from: 'approval_pending',
    to: 'cancelled',
    allowedRoles: ['owner', 'management'],
    requiresReason: true,
    triggers: ['send_notification', 'log_audit'],
  },
];

// ============================
// ARTWORK WORKFLOW
// ============================
export const ARTWORK_TRANSITIONS: Transition[] = [
  { from: 'pending_assignment', to: 'assigned', allowedRoles: ['owner', 'management', 'manager', 'designer'], triggers: ['send_notification', 'log_audit'] },
  { from: 'assigned', to: 'in_design', allowedRoles: ['owner', 'management', 'manager', 'designer'], triggers: ['log_audit'] },
  { from: 'in_design', to: 'internal_review', allowedRoles: ['owner', 'management', 'manager', 'designer'], triggers: ['log_audit'] },
  { from: 'internal_review', to: 'ready_for_approval', allowedRoles: ['owner', 'management', 'manager', 'designer'], triggers: ['send_whatsapp', 'log_audit'] },
  { from: 'internal_review', to: 'in_design', allowedRoles: ['owner', 'management', 'manager', 'designer'], requiresReason: true, triggers: ['log_audit'] },
  { from: 'ready_for_approval', to: 'revision_requested', allowedRoles: ['owner', 'management', 'manager', 'customer'], requiresReason: true, triggers: ['create_revision', 'log_audit'] },
  { from: 'ready_for_approval', to: 'approved', allowedRoles: ['owner', 'management', 'manager', 'customer'], triggers: ['lock_artwork', 'log_audit'] },
  { from: 'revision_requested', to: 'in_design', allowedRoles: ['owner', 'management', 'manager', 'designer'], triggers: ['log_audit'] },
  { from: 'approved', to: 'released', allowedRoles: ['owner', 'management', 'manager', 'designer', 'production'], triggers: ['update_so_status', 'send_notification', 'log_audit'] },
];

// ============================
// PRODUCTION WORKFLOW
// ============================
export const PRODUCTION_TRANSITIONS: Transition[] = [
  { from: 'waiting_schedule', to: 'scheduled', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['send_notification', 'log_audit'] },
  { from: 'scheduled', to: 'printing', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['log_audit'] },
  { from: 'printing', to: 'finishing', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['log_audit'] },
  { from: 'finishing', to: 'qc', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['log_audit'] },
  { from: 'qc', to: 'packing', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['log_audit'] },
  { from: 'qc', to: 'printing', allowedRoles: ['owner', 'management', 'manager', 'production'], requiresReason: true, triggers: ['send_notification', 'log_audit'] },
  { from: 'packing', to: 'ready', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['create_delivery', 'send_whatsapp', 'log_audit'] },
  { from: 'ready', to: 'delivered', allowedRoles: ['owner', 'management', 'manager', 'production', 'customer'], triggers: ['update_so_status', 'log_audit'] },
  { from: 'waiting_schedule', to: 'cancelled', allowedRoles: ['owner', 'management'], requiresReason: true, triggers: ['log_audit'] },
  { from: 'scheduled', to: 'cancelled', allowedRoles: ['owner', 'management'], requiresReason: true, triggers: ['log_audit'] },
];

// ============================
// QC WORKFLOW
// ============================
export const QC_TRANSITIONS: Transition[] = [
  { from: 'pending', to: 'passed', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['update_production_status', 'log_audit'] },
  { from: 'pending', to: 'failed', allowedRoles: ['owner', 'management', 'manager', 'production'], requiresReason: true, triggers: ['send_notification', 'log_audit'] },
  { from: 'pending', to: 'rework', allowedRoles: ['owner', 'management', 'manager', 'production'], requiresReason: true, triggers: ['send_notification', 'update_production_status', 'log_audit'] },
  { from: 'failed', to: 'rework', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['send_notification', 'update_production_status', 'log_audit'] },
  { from: 'rework', to: 'pending', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['log_audit'] },
];

// ============================
// DELIVERY WORKFLOW
// ============================
export const DELIVERY_TRANSITIONS: Transition[] = [
  { from: 'pending', to: 'packed', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['log_audit'] },
  { from: 'packed', to: 'booked', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['send_whatsapp', 'log_audit'] },
  { from: 'booked', to: 'in_transit', allowedRoles: ['owner', 'management', 'manager', 'production'], triggers: ['log_audit'] },
  { from: 'in_transit', to: 'delivered', allowedRoles: ['owner', 'management', 'manager', 'production', 'customer'], triggers: ['update_so_status', 'send_whatsapp', 'create_invoice', 'log_audit'] },
  { from: 'in_transit', to: 'failed', allowedRoles: ['owner', 'management', 'manager', 'production'], requiresReason: true, triggers: ['send_notification', 'log_audit'] },
  { from: 'packed', to: 'delivered', allowedRoles: ['owner', 'management', 'manager', 'production', 'customer'], triggers: ['update_so_status', 'create_invoice', 'log_audit'] },
];

// ============================
// INVOICE WORKFLOW
// ============================
export const INVOICE_TRANSITIONS: Transition[] = [
  { from: 'unpaid', to: 'partial', allowedRoles: ['owner', 'management', 'manager'], triggers: ['log_audit'] },
  { from: 'unpaid', to: 'paid', allowedRoles: ['owner', 'management', 'manager'], triggers: ['send_whatsapp', 'log_audit'] },
  { from: 'partial', to: 'paid', allowedRoles: ['owner', 'management', 'manager'], triggers: ['send_whatsapp', 'log_audit'] },
  { from: 'partial', to: 'unpaid', allowedRoles: ['owner', 'management', 'manager'], triggers: ['log_audit'] },
  { from: 'unpaid', to: 'overdue', allowedRoles: ['owner', 'management', 'manager'], triggers: ['send_whatsapp', 'send_notification', 'log_audit'] },
  { from: 'partial', to: 'overdue', allowedRoles: ['owner', 'management', 'manager'], triggers: ['send_whatsapp', 'send_notification', 'log_audit'] },
  { from: 'unpaid', to: 'cancelled', allowedRoles: ['owner', 'management'], requiresReason: true, triggers: ['log_audit'] },
  { from: 'partial', to: 'cancelled', allowedRoles: ['owner', 'management'], requiresReason: true, triggers: ['log_audit'] },
];

// ============================
// WORKFLOW REGISTRY
// ============================
export const WORKFLOWS = {
  lead: LEAD_TRANSITIONS,
  quotation: QUOTATION_TRANSITIONS,
  sales_order: SO_TRANSITIONS,
  artwork: ARTWORK_TRANSITIONS,
  production: PRODUCTION_TRANSITIONS,
  qc: QC_TRANSITIONS,
  delivery: DELIVERY_TRANSITIONS,
  invoice: INVOICE_TRANSITIONS,
} as const;

export type WorkflowModule = keyof typeof WORKFLOWS;

// ============================
// TRANSITION VALIDATION
// ============================
export type TransitionResult =
  | { ok: true; transition: Transition; triggers: WorkflowTrigger[] }
  | { ok: false; reason: 'not_found' | 'role_not_allowed' | 'reason_required'; message: string };

export function validateTransition(
  module: WorkflowModule,
  fromStatus: string,
  toStatus: string,
  userRole: RoleKey,
  options?: { reason?: string }
): TransitionResult {
  const transitions = WORKFLOWS[module];
  const transition = transitions.find((t) => t.from === fromStatus && t.to === toStatus);

  if (!transition) {
    return {
      ok: false,
      reason: 'not_found',
      message: `Transition from "${fromStatus}" to "${toStatus}" is not allowed in ${module}.`,
    };
  }

  if (!transition.allowedRoles.includes(userRole)) {
    return {
      ok: false,
      reason: 'role_not_allowed',
      message: `Role "${userRole}" cannot perform this transition. Required: ${transition.allowedRoles.join(', ')}.`,
    };
  }

  if (transition.requiresReason && !options?.reason) {
    return {
      ok: false,
      reason: 'reason_required',
      message: `This transition (${fromStatus} → ${toStatus}) requires a reason.`,
    };
  }

  return {
    ok: true,
    transition,
    triggers: transition.triggers || [],
  };
}

// ============================
// ALLOWED NEXT STATES HELPER
// ============================
export function getAllowedNextStates(
  module: WorkflowModule,
  currentStatus: string,
  userRole: RoleKey
): string[] {
  return WORKFLOWS[module]
    .filter((t) => t.from === currentStatus && t.allowedRoles.includes(userRole))
    .map((t) => t.to);
}

// ============================
// WORKFLOW VISUALIZATION (for UI)
// ============================
export type WorkflowNode = {
  status: string;
  label: string;
  description: string;
  category: 'start' | 'middle' | 'success' | 'failure';
};

export const WORKFLOW_VISUAL: Record<WorkflowModule, WorkflowNode[]> = {
  lead: [
    { status: 'new', label: 'New', description: 'Fresh lead masuk', category: 'start' },
    { status: 'contacted', label: 'Contacted', description: 'Sudah hubungi', category: 'middle' },
    { status: 'qualified', label: 'Qualified', description: 'Layak untuk quotation', category: 'middle' },
    { status: 'quotation_sent', label: 'Quotation Sent', description: 'Quotation dihantar', category: 'middle' },
    { status: 'won', label: 'Won', description: 'Convert jadi customer', category: 'success' },
    { status: 'lost', label: 'Lost', description: 'Pelanggan tak convert', category: 'failure' },
  ],
  quotation: [
    { status: 'draft', label: 'Draft', description: 'Sedang disediakan', category: 'start' },
    { status: 'sent', label: 'Sent', description: 'Dihantar ke pelanggan', category: 'middle' },
    { status: 'approved', label: 'Approved', description: 'Pelanggan lulus', category: 'middle' },
    { status: 'converted', label: 'Converted', description: 'Jadi Sales Order', category: 'success' },
    { status: 'rejected', label: 'Rejected', description: 'Pelanggan tolak', category: 'failure' },
    { status: 'expired', label: 'Expired', description: 'Tempoh tamat', category: 'failure' },
  ],
  sales_order: [
    { status: 'pending_artwork', label: 'Pending Artwork', description: 'Belum ada artwork', category: 'start' },
    { status: 'design_in_progress', label: 'Design In Progress', description: 'Designer sedang buat', category: 'middle' },
    { status: 'approval_pending', label: 'Approval Pending', description: 'Menunggu approval', category: 'middle' },
    { status: 'artwork_approved', label: 'Artwork Approved', description: 'Pelanggan lulus artwork', category: 'middle' },
    { status: 'in_production', label: 'In Production', description: 'Sedang cetak', category: 'middle' },
    { status: 'qc', label: 'QC', description: 'Quality control', category: 'middle' },
    { status: 'packing', label: 'Packing', description: 'Sedang pack', category: 'middle' },
    { status: 'ready', label: 'Ready', description: 'Siap untuk pickup/delivery', category: 'middle' },
    { status: 'out_for_delivery', label: 'Out For Delivery', description: 'Dalam perjalanan', category: 'middle' },
    { status: 'delivered', label: 'Delivered', description: 'Sampai', category: 'middle' },
    { status: 'completed', label: 'Completed', description: 'Order selesai sepenuhnya', category: 'success' },
    { status: 'cancelled', label: 'Cancelled', description: 'Order dibatalkan', category: 'failure' },
  ],
  artwork: [
    { status: 'pending_assignment', label: 'Pending Assignment', description: 'Belum assign designer', category: 'start' },
    { status: 'assigned', label: 'Assigned', description: 'Designer sudah assigned', category: 'middle' },
    { status: 'in_design', label: 'In Design', description: 'Designer sedang kerja', category: 'middle' },
    { status: 'internal_review', label: 'Internal Review', description: 'Semakan dalaman', category: 'middle' },
    { status: 'ready_for_approval', label: 'Ready For Approval', description: 'Menunggu pelanggan', category: 'middle' },
    { status: 'revision_requested', label: 'Revision Requested', description: 'Pelanggan minta ubah', category: 'middle' },
    { status: 'approved', label: 'Approved', description: 'Pelanggan lulus', category: 'middle' },
    { status: 'released', label: 'Released', description: 'Hantar ke production', category: 'success' },
  ],
  production: [
    { status: 'waiting_schedule', label: 'Waiting Schedule', description: 'Belum dijadualkan', category: 'start' },
    { status: 'scheduled', label: 'Scheduled', description: 'Sudah dijadualkan', category: 'middle' },
    { status: 'printing', label: 'Printing', description: 'Sedang cetak', category: 'middle' },
    { status: 'finishing', label: 'Finishing', description: 'Finishing (cutting, laminating)', category: 'middle' },
    { status: 'qc', label: 'QC', description: 'Quality check', category: 'middle' },
    { status: 'packing', label: 'Packing', description: 'Sedang pack', category: 'middle' },
    { status: 'ready', label: 'Ready', description: 'Siap untuk delivery', category: 'middle' },
    { status: 'delivered', label: 'Delivered', description: 'Sampai', category: 'success' },
    { status: 'cancelled', label: 'Cancelled', description: 'Batal', category: 'failure' },
  ],
  qc: [
    { status: 'pending', label: 'Pending', description: 'Belum check', category: 'start' },
    { status: 'passed', label: 'Passed', description: 'Lulus QC', category: 'success' },
    { status: 'failed', label: 'Failed', description: 'Gagal QC', category: 'failure' },
    { status: 'rework', label: 'Rework', description: 'Perlu buat semula', category: 'middle' },
  ],
  delivery: [
    { status: 'pending', label: 'Pending', description: 'Belum dipack', category: 'start' },
    { status: 'packed', label: 'Packed', description: 'Sudah dipack', category: 'middle' },
    { status: 'booked', label: 'Booked', description: 'Courier sudah booked', category: 'middle' },
    { status: 'in_transit', label: 'In Transit', description: 'Dalam perjalanan', category: 'middle' },
    { status: 'delivered', label: 'Delivered', description: 'Sampai', category: 'success' },
    { status: 'failed', label: 'Failed', description: 'Gagal hantar', category: 'failure' },
  ],
  invoice: [
    { status: 'unpaid', label: 'Unpaid', description: 'Belum bayar', category: 'start' },
    { status: 'partial', label: 'Partial', description: 'Bayar sebahagian', category: 'middle' },
    { status: 'paid', label: 'Paid', description: 'Lunas', category: 'success' },
    { status: 'overdue', label: 'Overdue', description: 'Lewat bayar', category: 'failure' },
    { status: 'cancelled', label: 'Cancelled', description: 'Invoice batal', category: 'failure' },
  ],
};
