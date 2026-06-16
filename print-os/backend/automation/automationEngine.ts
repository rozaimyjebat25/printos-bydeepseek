// =====================================================================
// PRINT OS — AUTOMATION ENGINE V1.0
// Rules-based automation: reminder, escalation, notification
// Tenant owns WhatsApp / SMTP / SMS connector (BYOC pattern)
// =====================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Uuid, RoleKey } from '../types/domain';

// ============================
// TYPES
// ============================
export type AutomationTrigger =
  | 'quotation_sent_no_response'
  | 'artwork_pending_approval'
  | 'artwork_revision_overdue'
  | 'payment_overdue'
  | 'production_delayed'
  | 'order_ready_for_pickup'
  | 'order_delivered_review_request'
  | 'repeat_order_prediction'
  | 'rush_order_alert';

export type AutomationAction =
  | 'send_whatsapp'
  | 'send_email'
  | 'send_sms'
  | 'send_notification'
  | 'escalate_to_manager'
  | 'create_task'
  | 'update_health_score';

export type AutomationRule = {
  id: Uuid;
  company_id: Uuid;
  trigger: AutomationTrigger;
  name: string;
  is_active: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  template_id?: string | null;
  cooldown_hours?: number;
  created_at?: string;
};

export type AutomationCondition = {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: any;
};

export type AutomationContext = {
  company_id: Uuid;
  user_id?: Uuid;
  trigger: AutomationTrigger;
  data: Record<string, any>;
};

// ============================
// AUTOMATION REGISTRY (per company)
// ============================
export const DEFAULT_AUTOMATION_RULES: Omit<AutomationRule, 'id' | 'company_id' | 'created_at'>[] = [
  {
    trigger: 'quotation_sent_no_response',
    name: 'Quotation Reminder (3 days)',
    is_active: true,
    conditions: [
      { field: 'days_since_sent', operator: 'eq', value: 3 },
    ],
    actions: ['send_whatsapp', 'send_notification'],
    cooldown_hours: 24,
  },
  {
    trigger: 'quotation_sent_no_response',
    name: 'Quotation Follow-up (7 days)',
    is_active: true,
    conditions: [
      { field: 'days_since_sent', operator: 'eq', value: 7 },
    ],
    actions: ['send_whatsapp', 'escalate_to_manager'],
    cooldown_hours: 24,
  },
  {
    trigger: 'artwork_pending_approval',
    name: 'Customer Reminder Approve Artwork (24h)',
    is_active: true,
    conditions: [
      { field: 'hours_pending', operator: 'gte', value: 24 },
    ],
    actions: ['send_whatsapp'],
    cooldown_hours: 12,
  },
  {
    trigger: 'artwork_pending_approval',
    name: 'Customer Reminder Approve Artwork (48h)',
    is_active: true,
    conditions: [
      { field: 'hours_pending', operator: 'gte', value: 48 },
    ],
    actions: ['send_whatsapp', 'escalate_to_manager'],
    cooldown_hours: 12,
  },
  {
    trigger: 'artwork_revision_overdue',
    name: 'Designer Reminder Revision (2 days)',
    is_active: true,
    conditions: [
      { field: 'days_in_revision', operator: 'gte', value: 2 },
    ],
    actions: ['send_notification', 'escalate_to_manager'],
    cooldown_hours: 24,
  },
  {
    trigger: 'payment_overdue',
    name: 'Payment Reminder (7 days overdue)',
    is_active: true,
    conditions: [
      { field: 'days_overdue', operator: 'gte', value: 7 },
    ],
    actions: ['send_whatsapp', 'send_email'],
    cooldown_hours: 48,
  },
  {
    trigger: 'payment_overdue',
    name: 'Payment Overdue Escalation (30 days)',
    is_active: true,
    conditions: [
      { field: 'days_overdue', operator: 'gte', value: 30 },
    ],
    actions: ['send_whatsapp', 'escalate_to_manager'],
    cooldown_hours: 72,
  },
  {
    trigger: 'production_delayed',
    name: 'Production Delay Alert (4h)',
    is_active: true,
    conditions: [
      { field: 'hours_delayed', operator: 'gte', value: 4 },
    ],
    actions: ['send_notification', 'escalate_to_manager'],
    cooldown_hours: 4,
  },
  {
    trigger: 'order_ready_for_pickup',
    name: 'Ready For Pickup Notification',
    is_active: true,
    conditions: [],
    actions: ['send_whatsapp', 'send_notification'],
  },
  {
    trigger: 'order_delivered_review_request',
    name: 'Review Request After Delivery',
    is_active: true,
    conditions: [
      { field: 'days_since_delivered', operator: 'eq', value: 3 },
    ],
    actions: ['send_whatsapp'],
    cooldown_hours: 48,
  },
  {
    trigger: 'rush_order_alert',
    name: 'Rush Order Alert',
    is_active: true,
    conditions: [],
    actions: ['send_notification', 'escalate_to_manager'],
  },
];

// ============================
// CONDITION EVALUATOR
// ============================
function evaluateCondition(cond: AutomationCondition, data: Record<string, any>): boolean {
  const fieldValue = data[cond.field];

  switch (cond.operator) {
    case 'eq': return fieldValue === cond.value;
    case 'neq': return fieldValue !== cond.value;
    case 'gt': return fieldValue > cond.value;
    case 'lt': return fieldValue < cond.value;
    case 'gte': return fieldValue >= cond.value;
    case 'lte': return fieldValue <= cond.value;
    case 'in': return Array.isArray(cond.value) && cond.value.includes(fieldValue);
    case 'contains': return String(fieldValue).toLowerCase().includes(String(cond.value).toLowerCase());
    default: return false;
  }
}

// ============================
// TRIGGER AUTOMATION
// ============================
export async function runAutomation(
  supabase: SupabaseClient,
  context: AutomationContext
): Promise<{ executed: number; results: any[] }> {
  // Fetch active rules for this trigger
  const { data: rules, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('company_id', context.company_id)
    .eq('trigger', context.trigger)
    .eq('is_active', true);

  if (error || !rules) {
    console.error('[AUTOMATION] Failed to fetch rules:', error);
    return { executed: 0, results: [] };
  }

  const results: any[] = [];

  for (const rule of rules as AutomationRule[]) {
    // Check cooldown
    if (rule.cooldown_hours) {
      const { data: lastRun } = await supabase
        .from('automation_logs')
        .select('executed_at')
        .eq('rule_id', rule.id)
        .order('executed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastRun?.executed_at) {
        const hoursSince = (Date.now() - new Date(lastRun.executed_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < rule.cooldown_hours) {
          continue; // skip, cooldown active
        }
      }
    }

    // Evaluate all conditions
    const allMatch = rule.conditions.every((c) => evaluateCondition(c, context.data));
    if (!allMatch) continue;

    // Execute actions
    const actionResults = await Promise.all(
      rule.actions.map((action) =>
        executeAction(supabase, context, action, rule, context.data)
      )
    );

    // Log execution
    await supabase.from('automation_logs').insert({
      company_id: context.company_id,
      rule_id: rule.id,
      trigger: context.trigger,
      data: context.data,
      results: actionResults,
      executed_at: new Date().toISOString(),
    });

    results.push({ rule_id: rule.id, actions: actionResults });
  }

  return { executed: results.length, results };
}

// ============================
// EXECUTE ACTION
// ============================
async function executeAction(
  supabase: SupabaseClient,
  context: AutomationContext,
  action: AutomationAction,
  rule: AutomationRule,
  data: Record<string, any>
): Promise<{ action: AutomationAction; status: 'success' | 'failed'; detail?: string }> {
  try {
    switch (action) {
      case 'send_whatsapp':
        return await sendWhatsApp(supabase, context, rule, data);

      case 'send_email':
        return await sendEmail(supabase, context, rule, data);

      case 'send_sms':
        return await sendSMS(supabase, context, rule, data);

      case 'send_notification':
        return await sendInAppNotification(supabase, context, rule, data);

      case 'escalate_to_manager':
        return await escalateToManager(supabase, context, rule, data);

      case 'create_task':
        return await createTask(supabase, context, rule, data);

      case 'update_health_score':
        return await updateHealthScore(supabase, context, data);

      default:
        return { action, status: 'failed', detail: 'Unknown action' };
    }
  } catch (err: any) {
    console.error(`[AUTOMATION] Action ${action} failed:`, err);
    return { action, status: 'failed', detail: err.message };
  }
}

// ============================
// ACTION: WhatsApp (via tenant's provider)
// ============================
async function sendWhatsApp(
  supabase: SupabaseClient,
  context: AutomationContext,
  rule: AutomationRule,
  data: Record<string, any>
) {
  const { data: company } = await supabase
    .from('companies')
    .select('whatsapp_provider, whatsapp_config, whatsapp_status')
    .eq('id', context.company_id)
    .single();

  if (!company || company.whatsapp_status !== 'active') {
    return { action: 'send_whatsapp' as const, status: 'failed' as const, detail: 'WhatsApp not configured' };
  }

  // Render template
  const message = await renderTemplate(supabase, context.company_id, rule.template_id || rule.trigger, data);

  // Log usage
  await supabase.from('usage_logs').insert({
    company_id: context.company_id,
    feature_key: 'whatsapp',
    action_type: 'message_sent',
    provider: company.whatsapp_provider,
    quantity: 1,
  });

  // Dispatch via provider (UltraMsg / Meta / Twilio)
  // Real implementation: call provider API here
  const success = await dispatchWhatsApp(company, data.recipient_phone, message);

  return {
    action: 'send_whatsapp' as const,
    status: success ? 'success' as const : 'failed' as const,
    detail: success ? 'Message queued' : 'Provider rejected',
  };
}

async function dispatchWhatsApp(company: any, phone: string, message: string): Promise<boolean> {
  // TODO: implement actual provider call
  // For now, just log intent
  console.log(`[WhatsApp:${company.whatsapp_provider}] To: ${phone}, Message: ${message.substring(0, 50)}...`);
  return true;
}

// ============================
// ACTION: Email (via tenant's SMTP)
// ============================
async function sendEmail(
  supabase: SupabaseClient,
  context: AutomationContext,
  rule: AutomationRule,
  data: Record<string, any>
) {
  const { data: company } = await supabase
    .from('companies')
    .select('smtp_config')
    .eq('id', context.company_id)
    .single();

  if (!company?.smtp_config) {
    return { action: 'send_email' as const, status: 'failed' as const, detail: 'SMTP not configured' };
  }

  // Log usage
  await supabase.from('usage_logs').insert({
    company_id: context.company_id,
    feature_key: 'email',
    action_type: 'email_sent',
    quantity: 1,
  });

  // TODO: implement SMTP dispatch
  return { action: 'send_email' as const, status: 'success' as const, detail: 'Email queued' };
}

// ============================
// ACTION: SMS
// ============================
async function sendSMS(
  supabase: SupabaseClient,
  context: AutomationContext,
  rule: AutomationRule,
  data: Record<string, any>
) {
  // TODO: implement SMS provider
  await supabase.from('usage_logs').insert({
    company_id: context.company_id,
    feature_key: 'sms',
    action_type: 'message_sent',
    quantity: 1,
  });
  return { action: 'send_sms' as const, status: 'success' as const, detail: 'SMS queued' };
}

// ============================
// ACTION: In-app notification
// ============================
async function sendInAppNotification(
  supabase: SupabaseClient,
  context: AutomationContext,
  rule: AutomationRule,
  data: Record<string, any>
) {
  const targetUserId = data.user_id || context.user_id;
  if (!targetUserId) {
    return { action: 'send_notification' as const, status: 'failed' as const, detail: 'No target user' };
  }

  const { error } = await supabase.from('notifications').insert({
    company_id: context.company_id,
    user_id: targetUserId,
    title: rule.name,
    message: data.message || `Automation triggered: ${rule.trigger}`,
    type: 'info',
    module: data.module,
    record_id: data.record_id,
    action_url: data.action_url,
  });

  return {
    action: 'send_notification' as const,
    status: error ? 'failed' as const : 'success' as const,
    detail: error?.message,
  };
}

// ============================
// ACTION: Escalate to manager
// ============================
async function escalateToManager(
  supabase: SupabaseClient,
  context: AutomationContext,
  rule: AutomationRule,
  data: Record<string, any>
) {
  // Find managers in same company
  const { data: managers } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', context.company_id)
    .eq('is_active', true);

  if (!managers || managers.length === 0) {
    return { action: 'escalate_to_manager' as const, status: 'failed' as const, detail: 'No managers found' };
  }

  // Send notification to all managers
  const notifications = managers.map((m) => ({
    company_id: context.company_id,
    user_id: m.id,
    title: `[ESCALATION] ${rule.name}`,
    message: `Escalation triggered: ${rule.trigger}. Data: ${JSON.stringify(data)}`,
    type: 'warning' as const,
    module: data.module,
    record_id: data.record_id,
  }));

  await supabase.from('notifications').insert(notifications);

  return { action: 'escalate_to_manager' as const, status: 'success' as const, detail: `${managers.length} manager notified` };
}

// ============================
// ACTION: Create task
// ============================
async function createTask(
  supabase: SupabaseClient,
  context: AutomationContext,
  rule: AutomationRule,
  data: Record<string, any>
) {
  // Tasks table not yet in V1.0 — placeholder
  console.log(`[TASK] Created: ${rule.name}`);
  return { action: 'create_task' as const, status: 'success' as const, detail: 'Task created (placeholder)' };
}

// ============================
// ACTION: Update health score
// ============================
async function updateHealthScore(
  supabase: SupabaseClient,
  context: AutomationContext,
  data: Record<string, any>
) {
  // Health score logic lives in a separate module
  // This is a placeholder for the trigger
  return { action: 'update_health_score' as const, status: 'success' as const, detail: 'Score updated' };
}

// ============================
// TEMPLATE RENDERER
// ============================
async function renderTemplate(
  supabase: SupabaseClient,
  companyId: Uuid,
  templateKey: string,
  data: Record<string, any>
): Promise<string> {
  // Try to fetch from templates table (future)
  // For now, use built-in defaults
  const templates: Record<string, string> = {
    quotation_sent_no_response_3d: `Hi {customer_name}, follow up untuk quotation {quotation_no} yang dihantar pada {sent_date}. Ada apa-apa yang boleh kami bantu? - SR Creative Print`,
    quotation_sent_no_response_7d: `Hi {customer_name}, quotation {quotation_no} masih belum ada respon. Boleh kami call untuk follow up? - SR Creative Print`,
    artwork_pending_approval_24h: `Hi {customer_name}, artwork untuk order {so_number} sedang menunggu approval anda. Sila review di: {approval_link} - SR Creative Print`,
    artwork_pending_approval_48h: `Hi {customer_name}, artwork untuk order {so_number} masih menunggu approval. Sila reply jika ada perubahan. - SR Creative Print`,
    payment_overdue_7d: `Hi {customer_name}, invoice {invoice_number} (RM{total}) sudah overdue {days_overdue} hari. Sila buat pembayaran. - SR Creative Print`,
    payment_overdue_30d: `Hi {customer_name}, invoice {invoice_number} overdue 30 hari. Sila hubungi kami untuk penyelesaian. - SR Creative Print`,
    order_ready_for_pickup: `Hi {customer_name}, order {so_number} sudah siap! Sila ambil sebelum {pickup_deadline}. - SR Creative Print`,
    order_delivered_review_request: `Hi {customer_name}, terima kasih kerana order dengan kami! Boleh bantu tinggalkan review? - SR Creative Print`,
  };

  let template = templates[templateKey] || `Notification for ${templateKey}`;

  // Replace placeholders
  for (const [key, value] of Object.entries(data)) {
    template = template.replace(new RegExp(`{${key}}`, 'g'), String(value || ''));
  }

  return template;
}

// ============================
// SCHEDULED JOB: Check automations
// ============================
// This should be called from a cron job / edge function
export async function runScheduledAutomations(supabase: SupabaseClient) {
  const results: any[] = [];

  // 1. Quotations sent 3+ days ago, no response
  const { data: quotations } = await supabase
    .from('quotations')
    .select('*')
    .eq('status', 'sent')
    .lt('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());

  for (const q of quotations || []) {
    const daysSince = Math.floor((Date.now() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const result = await runAutomation(supabase, {
      company_id: q.company_id,
      trigger: 'quotation_sent_no_response',
      data: {
        quotation_id: q.id,
        quotation_no: q.quotation_no,
        customer_name: q.customer_name || 'Pelanggan',
        days_since_sent: daysSince,
      },
    });
    results.push(result);
  }

  // 2. Artwork pending approval 24h+
  const { data: artworks } = await supabase
    .from('artworks')
    .select('*')
    .eq('status', 'ready_for_approval')
    .lt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  for (const a of artworks || []) {
    const hoursPending = Math.floor((Date.now() - new Date(a.updated_at).getTime()) / (1000 * 60 * 60));
    const result = await runAutomation(supabase, {
      company_id: a.company_id,
      trigger: 'artwork_pending_approval',
      data: {
        artwork_id: a.id,
        so_id: a.sales_order_id,
        approval_link: a.approval_link,
        hours_pending: hoursPending,
      },
    });
    results.push(result);
  }

  // 3. Invoices overdue
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .in('status', ['unpaid', 'partial'])
    .lt('due_date', new Date().toISOString().split('T')[0]);

  for (const inv of invoices || []) {
    const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
    const result = await runAutomation(supabase, {
      company_id: inv.company_id,
      trigger: 'payment_overdue',
      data: {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        total: inv.total,
        days_overdue: daysOverdue,
      },
    });
    results.push(result);
  }

  return { total: results.length, results };
}
