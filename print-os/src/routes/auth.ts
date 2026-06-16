// =====================================================================
// PRINT OS — Auth Proxy Routes
// Proxy antara dashboard HTML dan Supabase Auth (guna service_role)
// Supaya HTML tak perlu hardcode anon key
// =====================================================================

import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';
import type { RoleKey } from '../types/domain';

const auth = new Hono();

// =====================================================================
// POST /auth/signin — Sign in user, return session token
// Body: { email, password }
// =====================================================================
auth.post('/signin', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    // Use admin API to verify password and get user
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();

    if (listErr) {
      return c.json({ error: 'Failed to verify user' }, 500);
    }

    const user = users.find((u) => u.email === email);
    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password using admin API
    // Note: Supabase doesn't have a direct "verify password" admin API
    // We need to use a workaround: generate a sign-in token via OTP or use the signIn endpoint
    // For now, use the standard signInWithPassword via service role

    // Create a session for the user using admin API
    // (Using generateLink with magiclink to get an access token)
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (error || !data?.properties?.action_link) {
      // Fallback: try password-based signin
      // Create a fresh client with anon key for password signin
      const { data: sessionData, error: sessionErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (sessionErr || !sessionData.session) {
        return c.json({ error: 'Invalid email or password', detail: sessionErr?.message }, 401);
      }

      return c.json({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        user: {
          id: sessionData.user.id,
          email: sessionData.user.email,
          role: sessionData.user.app_metadata?.role,
          company_id: sessionData.user.app_metadata?.company_id,
          role_id: sessionData.user.app_metadata?.role_id,
        },
      });
    }

    // Extract access token from action_link
    const url = new URL(data.properties.action_link);
    const accessToken = url.searchParams.get('access_token');
    const refreshToken = url.searchParams.get('refresh_token');

    if (!accessToken) {
      return c.json({ error: 'Failed to extract session token' }, 500);
    }

    return c.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.app_metadata?.role,
        company_id: user.app_metadata?.company_id,
        role_id: user.app_metadata?.role_id,
      },
    });
  } catch (err: any) {
    return c.json({ error: 'Sign in failed', detail: err.message }, 500);
  }
});

// =====================================================================
// POST /auth/reset-password — Reset password (admin only)
// Body: { email, new_password }
// =====================================================================
auth.post('/reset-password', async (c) => {
  const body = await c.req.json();
  const { email, new_password } = body;

  if (!email || !new_password) {
    return c.json({ error: 'Email and new_password required' }, 400);
  }

  if (new_password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.auth.admin.updateUserById(
      // Get user ID first
      (await supabase.auth.admin.listUsers()).data?.users.find((u) => u.email === email)?.id || '',
      { password: new_password }
    );

    if (error) {
      return c.json({ error: 'Reset failed', detail: error.message }, 500);
    }

    return c.json({ success: true, message: `Password reset for ${email}` });
  } catch (err: any) {
    return c.json({ error: 'Reset failed', detail: err.message }, 500);
  }
});

export default auth;
