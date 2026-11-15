import { createBrowserClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';

const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } = env;


export function createBrowserSupabaseClient() {
  return createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
