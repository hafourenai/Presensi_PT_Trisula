import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SECRET_KEY } from '$env/static/private';

if (!SUPABASE_SECRET_KEY) {
  throw new Error('SUPABASE_SECRET_KEY wajib tersedia untuk server admin client.');
}


export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
