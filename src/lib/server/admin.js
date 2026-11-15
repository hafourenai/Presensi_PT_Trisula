import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

const { PUBLIC_SUPABASE_URL } = publicEnv;
const { SUPABASE_SECRET_KEY } = privateEnv;

if (!SUPABASE_SECRET_KEY) {
  throw new Error('SUPABASE_SECRET_KEY wajib tersedia untuk server admin client.');
}


export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
