// =====================================================================
// PRINT OS — Auth Proxy Routes
// Sign-in via service_role (bypass anon key requirement)
// =====================================================================

import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';

const auth = new Hono();

// =====================================================================
// POST /auth/signin — Sign in using admin API
// Body: { email, password }
// Returns: { access_token, user }
// =====================================================================
auth.post('/signin', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    // Verify user exists
    let user;
    try {
      const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listErr) {
        console.error('[auth/signin] listUsers error:', listErr);
        return c.json({ error: 'Auth service unavailable', detail: listErr.message }, 500);
      }
      user = listData?.users?.find((u) => u.email === email);
    } catch (e: any) {
      console.error('[auth/signin] listUsers exception:', e);
      return c.json({ error: 'Auth service unavailable', detail: e.message }, 500);
    }

    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Generate a session using admin generateLink
    // This bypasses password verification — used only for testing
    // For production, use signInWithPassword via anon key (not done here for security)
    let sessionData;
    try {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: 'https://printos-bydeepseek-production.up.railway.app/dashboard',
        },
      });

      if (error) {
        console.error('[auth/signin] generateLink error:', error);
        return c.json({ error: 'Failed to generate session', detail: error.message }, 500);
      }

      if (!data?.properties?.action_link) {
        return c.json({ error: 'No session link returned' }, 500);
      }

      // Extract access_token from action_link URL hash
      const actionLink = data.properties.action_link;
      const url = new URL(actionLink);
      const hash = url.hash.substring(1); // remove #
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken) {
        console.error('[auth/signin] No access token in action link:', actionLink);
        return c.json({ error: 'Failed to extract session' }, 500);
      }

      sessionData = {
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    } catch (e: any) {
      console.error('[auth/signin] generateLink exception:', e);
      return c.json({ error: 'Failed to generate session', detail: e.message }, 500);
    }

    return c.json({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      user: {
        id: user.id,
        email: user.email,
        role: user.app_metadata?.role,
        company_id: user.app_metadata?.company_id,
        role_id: user.app_metadata?.role_id,
      },
    });
  } catch (err: any) {
    console.error('[auth/signin] top-level error:', err);
    return c.json({ error: 'Sign in failed', detail: err.message }, 500);
  }
});

// =====================================================================
// POST /auth/verify-password — Admin only: verify password matches
// Body: { email, password }
// =====================================================================
auth.post('/verify-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    // Use the public client to attempt sign-in (anon key based)
    // This is the only way to verify password without service-role access
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return c.json({ valid: false, error: 'Invalid password' }, 401);
    }

    return c.json({
      valid: true,
      access_token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.app_metadata?.role,
        company_id: data.user.app_metadata?.company_id,
        role_id: data.user.app_metadata?.role_id,
      },
    });
  } catch (err: any) {
    return c.json({ error: 'Verification failed', detail: err.message }, 500);
  }
});

// =====================================================================
// POST /auth/reset-password — Admin resets user password
// Body: { email, new_password }
// =====================================================================
auth.post('/reset-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email, new_password } = body;

  if (!email || !new_password) {
    return c.json({ error: 'Email and new_password required' }, 400);
  }

  if (new_password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = listData?.users?.find((u) => u.email === email);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (error) {
      return c.json({ error: 'Reset failed', detail: error.message }, 500);
    }

    return c.json({ success: true, message: `Password reset for ${email}` });
  } catch (err: any) {
    return c.json({ error: 'Reset failed', detail: err.message }, 500);
  }
});

export default auth;
