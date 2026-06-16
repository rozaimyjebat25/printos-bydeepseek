// =====================================================================
// PRINT OS — Supabase Client Utility
// =====================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      '[PRINT OS] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Set these in your .env file or Replit Secrets.'
    );
  }

  _client = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return _client;
}

// =====================================================================
// Auth helpers
// =====================================================================
export async function signIn(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserContext() {
  const user = await getCurrentUser();
  if (!user) return null;

  return {
    userId: user.id,
    companyId: user.app_metadata?.company_id as string,
    role: user.app_metadata?.role as string,
    roleId: user.app_metadata?.role_id as string,
    email: user.email,
    fullName: (user.user_metadata?.full_name as string) || user.email,
  };
}
