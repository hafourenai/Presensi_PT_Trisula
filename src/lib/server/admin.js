import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

const { PUBLIC_SUPABASE_URL } = publicEnv;
const { SUPABASE_SECRET_KEY } = privateEnv;

let client;

function getAdminClient() {
  if (!PUBLIC_SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error('Environment Supabase wajib tersedia saat server dijalankan.');
  }

  client ??= createClient(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return client;
}

// SvelteKit mengimpor modul server ketika menganalisis hasil build. Proxy ini
// menunda pembuatan client sampai request runtime pertama sehingga secret tidak
// perlu dan tidak pernah disalin ke dalam Docker build context.
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, property) {
      const adminClient = getAdminClient();
      const value = adminClient[property];
      return typeof value === 'function' ? value.bind(adminClient) : value;
    }
  }
);
