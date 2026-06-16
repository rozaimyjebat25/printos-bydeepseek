// =====================================================================
// PRINT OS — Supabase Client (API server side)
// =====================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _adminClient: SupabaseClient | null = null;
let _publicClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      '[PRINT OS API] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set these in Railway environment variables.'
    );
  }

  _adminClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _adminClient;
}

export function getSupabasePublic(): SupabaseClient {
  if (_publicClient) return _publicClient;

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      '[PRINT OS API] Missing SUPABASE_URL or SUPABASE_ANON_KEY.'
    );
  }

  _publicClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _publicClient;
}

// =====================================================================
// Create client with user's JWT (for RLS)
// =====================================================================
export function getSupabaseForUser(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY!;

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
