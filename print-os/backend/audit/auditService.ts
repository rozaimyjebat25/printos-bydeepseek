// =====================================================================
// PRINT OS — AUDIT TRAIL SERVICE V1.0
// Application-level audit logger (database trigger is auto-backup)
// Every sensitive action must go through this service
// =====================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditAction, AuditLog, Uuid } from '../types/domain';

export type AuditContext = {
  userId: Uuid;
  companyId: Uuid;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  metadata?: Record<string, any>;
};

export type AuditWriteInput = {
  action: AuditAction;
  module: string;
  recordId?: Uuid | null;
  recordType?: string | null;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  metadata?: Record<string, any>;
};

// ============================
// CORE: WRITE AUDIT LOG
// ============================
export async function writeAudit(
  supabase: SupabaseClient,
  context: AuditContext,
  input: AuditWriteInput
): Promise<AuditLog | null> {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      company_id: context.companyId,
      user_id: context.userId,
      action: input.action,
      module: input.module,
      record_id: input.recordId,
      record_type: input.recordType,
      old_value: input.oldValue,
      new_value: input.newValue,
      ip_address: context.ipAddress,
      user_agent: context.userAgent,
      device: context.device,
      metadata: input.metadata || context.metadata || {},
    })
    .select()
    .single();

  if (error) {
    // Audit log failure tidak boleh halt operation
    // tapi kita log ke console untuk investigation
    console.error('[AUDIT] Failed to write audit log:', error);
    return null;
  }

  return data as AuditLog;
}

// ============================
// QUERY AUDIT LOGS
// ============================
export type AuditQueryOptions = {
  companyId: Uuid;
  module?: string;
  recordId?: Uuid;
  userId?: Uuid;
  action?: AuditAction;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
};

export async function queryAuditLogs(
  supabase: SupabaseClient,
  options: AuditQueryOptions
): Promise<AuditLog[]> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('company_id', options.companyId)
    .order('created_at', { ascending: false });

  if (options.module) query = query.eq('module', options.module);
  if (options.recordId) query = query.eq('record_id', options.recordId);
  if (options.userId) query = query.eq('user_id', options.userId);
  if (options.action) query = query.eq('action', options.action);
  if (options.startDate) query = query.gte('created_at', options.startDate);
  if (options.endDate) query = query.lte('created_at', options.endDate);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[AUDIT] Query failed:', error);
    return [];
  }
  return (data || []) as AuditLog[];
}

// ============================
// CHANGE TRACKING — diff helper
// ============================
export function diffFields(
  oldRecord: Record<string, any> | null,
  newRecord: Record<string, any>,
  ignoreFields: string[] = ['updated_at', 'created_at']
): { changed: string[]; before: Record<string, any>; after: Record<string, any> } {
  const changed: string[] = [];
  const before: Record<string, any> = {};
  const after: Record<string, any> = {};

  if (!oldRecord) {
    return { changed: Object.keys(newRecord), before: {}, after: newRecord };
  }

  for (const key of Object.keys(newRecord)) {
    if (ignoreFields.includes(key)) continue;
    if (JSON.stringify(oldRecord[key]) !== JSON.stringify(newRecord[key])) {
      changed.push(key);
      before[key] = oldRecord[key];
      after[key] = newRecord[key];
    }
  }

  return { changed, before, after };
}

// ============================
// HIGH-LEVEL AUDIT WRAPPERS
// ============================
export async function auditCreate(
  supabase: SupabaseClient,
  context: AuditContext,
  module: string,
  newRecord: Record<string, any>
) {
  return writeAudit(supabase, context, {
    action: 'CREATE',
    module,
    recordId: newRecord.id,
    recordType: module,
    newValue: newRecord,
  });
}

export async function auditUpdate(
  supabase: SupabaseClient,
  context: AuditContext,
  module: string,
  oldRecord: Record<string, any>,
  newRecord: Record<string, any>,
  ignoreFields: string[] = ['updated_at']
) {
  const diff = diffFields(oldRecord, newRecord, ignoreFields);
  if (diff.changed.length === 0) return null; // tiada perubahan

  return writeAudit(supabase, context, {
    action: 'UPDATE',
    module,
    recordId: newRecord.id,
    recordType: module,
    oldValue: diff.before,
    newValue: diff.after,
  });
}

export async function auditDelete(
  supabase: SupabaseClient,
  context: AuditContext,
  module: string,
  oldRecord: Record<string, any>
) {
  return writeAudit(supabase, context, {
    action: 'DELETE',
    module,
    recordId: oldRecord.id,
    recordType: module,
    oldValue: oldRecord,
  });
}

export async function auditApprove(
  supabase: SupabaseClient,
  context: AuditContext,
  module: string,
  record: Record<string, any>,
  approved: boolean
) {
  return writeAudit(supabase, context, {
    action: approved ? 'APPROVE' : 'REJECT',
    module,
    recordId: record.id,
    recordType: module,
    newValue: { approved, at: new Date().toISOString() },
  });
}

export async function auditLogin(
  supabase: SupabaseClient,
  context: AuditContext,
  success: boolean
) {
  return writeAudit(supabase, context, {
    action: success ? 'LOGIN' : 'LOGOUT',
    module: 'auth',
    metadata: { success },
  });
}

export async function auditExport(
  supabase: SupabaseClient,
  context: AuditContext,
  module: string,
  format: 'csv' | 'pdf' | 'excel',
  filters?: Record<string, any>
) {
  return writeAudit(supabase, context, {
    action: 'EXPORT',
    module,
    metadata: { format, filters },
  });
}

// ============================
// AUDIT MIDDLEWARE — wraps Supabase operations
// ============================
export class AuditableClient {
  constructor(
    private supabase: SupabaseClient,
    private context: AuditContext
  ) {}

  // INSERT dengan auto-audit
  async insert<T extends Record<string, any>>(
    table: string,
    payload: T
  ): Promise<{ data: T | null; error: any }> {
    const { data, error } = await this.supabase
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      await auditCreate(this.supabase, this.context, table, data);
    }

    return { data: data as T | null, error };
  }

  // UPDATE dengan auto-audit + diff
  async update<T extends Record<string, any>>(
    table: string,
    id: Uuid,
    payload: Partial<T>,
    ignoreFields: string[] = ['updated_at']
  ): Promise<{ data: T | null; error: any }> {
    // Fetch old record first
    const { data: oldData } = await this.supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await this.supabase
      .from(table)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (!error && data && oldData) {
      await auditUpdate(this.supabase, this.context, table, oldData, data, ignoreFields);
    }

    return { data: data as T | null, error };
  }

  // SOFT DELETE dengan auto-audit
  async softDelete(
    table: string,
    id: Uuid
  ): Promise<{ data: any; error: any }> {
    const { data: oldData } = await this.supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await this.supabase
      .from(table)
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: this.context.userId,
      })
      .eq('id', id)
      .select()
      .single();

    if (!error && data && oldData) {
      await auditDelete(this.supabase, this.context, table, oldData);
    }

    return { data, error };
  }
}

// ============================
// EXTRACT CONTEXT FROM REQUEST
// ============================
export function extractContext(
  userId: Uuid,
  companyId: Uuid,
  request?: {
    ip?: string;
    userAgent?: string;
  }
): AuditContext {
  return {
    userId,
    companyId,
    ipAddress: request?.ip,
    userAgent: request?.userAgent,
    device: detectDevice(request?.userAgent),
  };
}

function detectDevice(ua?: string): string {
  if (!ua) return 'unknown';
  if (/mobile/i.test(ua)) return 'mobile';
  if (/tablet/i.test(ua)) return 'tablet';
  if (/windows/i.test(ua)) return 'desktop-windows';
  if (/mac/i.test(ua)) return 'desktop-mac';
  if (/linux/i.test(ua)) return 'desktop-linux';
  return 'unknown';
}
