// =====================================================================
// PRINT OS — Auth Middleware
// Verify JWT dan extract user context (company_id, role, etc)
// =====================================================================

import { Context, Next } from 'hono';
import { getSupabaseAdmin, getSupabaseForUser } from '../lib/supabase';
import type { RoleKey } from '../types/domain';

export type AuthContext = {
  userId: string;
  email: string;
  companyId: string;
  role: RoleKey;
  roleId: string;
};

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const companyId = user.app_metadata?.company_id as string;
    const role = user.app_metadata?.role as RoleKey;
    const roleId = user.app_metadata?.role_id as string;

    if (!companyId || !role) {
      return c.json({
        error: 'User missing company context. Set app_metadata.company_id and role.',
      }, 403);
    }

    c.set('auth', {
      userId: user.id,
      email: user.email!,
      companyId,
      role,
      roleId,
    });

    await next();
  } catch (err: any) {
    return c.json({ error: 'Authentication failed', detail: err.message }, 401);
  }
}

// =====================================================================
// Role-based authorization middleware
// =====================================================================
export function requireRole(...allowedRoles: RoleKey[]) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Not authenticated' }, 401);
    }
    if (!allowedRoles.includes(auth.role)) {
      return c.json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: auth.role,
      }, 403);
    }
    await next();
  };
}
