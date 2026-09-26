import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[stocksense] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — set them in backend/.env'
  );
}

// Service-role client: bypasses RLS. Used ONLY on the server, after we've
// verified the caller's JWT ourselves in middleware/auth.js.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
