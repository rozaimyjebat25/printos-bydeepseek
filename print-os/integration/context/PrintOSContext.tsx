// =====================================================================
// PRINT OS — Auth Context Provider
// Wrap app dengan <PrintOSProvider> untuk enable semua hooks
// =====================================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User as AuthUser } from '@supabase/supabase-js';
import { getSupabaseClient, signIn as supabaseSignIn, signOut as supabaseSignOut } from '../utils/supabase';
import type { Company, User, RoleKey } from '../types/domain';

export type PrintOSContextValue = {
  // Auth
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  // User context (from JWT metadata)
  userId: string | null;
  companyId: string | null;
  role: RoleKey | null;
  roleId: string | null;

  // Profile (from public.users + companies)
  profile: User | null;
  company: Company | null;
  refreshProfile: () => Promise<void>;
};

const PrintOSContext = createContext<PrintOSContextValue | undefined>(undefined);

export function PrintOSProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const loadProfile = useCallback(async (userId: string, companyId: string) => {
    const supabase = getSupabaseClient();
    const [{ data: userData }, { data: companyData }] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('companies').select('*').eq('id', companyId).single(),
    ]);

    if (userData) setProfile(userData as User);
    if (companyData) setCompany(companyData as Company);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);

      if (s?.user?.app_metadata?.company_id) {
        loadProfile(s.user.id, s.user.app_metadata.company_id);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user?.app_metadata?.company_id) {
        loadProfile(s.user.id, s.user.app_metadata.company_id);
      } else {
        setProfile(null);
        setCompany(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    await supabaseSignIn(email, password);
  }, []);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
    setProfile(null);
    setCompany(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.app_metadata?.company_id) {
      await loadProfile(user.id, user.app_metadata.company_id);
    }
  }, [user, loadProfile]);

  const value: PrintOSContextValue = {
    session,
    user,
    loading,
    signIn,
    signOut,
    userId: user?.id ?? null,
    companyId: user?.app_metadata?.company_id ?? null,
    role: (user?.app_metadata?.role as RoleKey) ?? null,
    roleId: user?.app_metadata?.role_id ?? null,
    profile,
    company,
    refreshProfile,
  };

  return <PrintOSContext.Provider value={value}>{children}</PrintOSContext.Provider>;
}

export function usePrintOS(): PrintOSContextValue {
  const ctx = useContext(PrintOSContext);
  if (!ctx) throw new Error('usePrintOS must be used within PrintOSProvider');
  return ctx;
}

// =====================================================================
// Shorthand hook
// =====================================================================
export function useAuth() {
  const ctx = usePrintOS();
  return {
    user: ctx.user,
    session: ctx.session,
    loading: ctx.loading,
    signIn: ctx.signIn,
    signOut: ctx.signOut,
    company: ctx.company,
    profile: ctx.profile,
    role: ctx.role,
    companyId: ctx.companyId,
  };
}
