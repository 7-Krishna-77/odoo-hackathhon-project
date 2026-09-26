import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/**
 * Verifies the Supabase JWT sent as `Authorization: Bearer <token>`.
 * On success, attaches `req.user` (Supabase auth user) and `req.profile`
 * (row from users_profiles, if one exists) to the request.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = data.user;

    const { data: profile } = await supabaseAdmin
      .from('users_profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    req.profile = profile || null;

    next();
  } catch (err) {
    console.error('[auth] verification error:', err.message);
    res.status(500).json({ error: 'Auth verification failed' });
  }
}

/** Restrict a route to specific roles, e.g. requireRole('Inventory Manager') */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.profile || !roles.includes(req.profile.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
