import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { createLocalDbClient } from '$lib/server/local-db.js';

let cloudClient;
let localDbClient;

function getCloudAdminClient() {
  const supabaseUrl = publicEnv.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const secretKey = privateEnv.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error('Environment Supabase wajib tersedia saat server dijalankan.');
  }

  cloudClient ??= createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return cloudClient;
}

function getLocalDb() {
  const databaseUrl = (privateEnv.DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) return null;

  const cacheTtlMs = Number(
    privateEnv.LOCAL_DB_CACHE_TTL_MS ?? process.env.LOCAL_DB_CACHE_TTL_MS ?? 10000
  );

  localDbClient ??= createLocalDbClient({
    databaseUrl,
    cacheTtlMs: Number.isFinite(cacheTtlMs) ? cacheTtlMs : 10000
  });

  return localDbClient;
}

// Hybrid Admin Client:
// - When DATABASE_URL is configured (VPS local PostgreSQL), `.from()` and `.rpc()`
//   execute locally on the VPS in <2 ms while `.auth` and `.storage` continue using Supabase Cloud.
// - Lazily initialized at runtime so Docker builds never require secret keys in the build context.
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, property) {
      const localDb = getLocalDb();
      if (localDb && (property === 'from' || property === 'rpc' || property === 'isLocalPg' || property === 'invalidateCache')) {
        const value = localDb[property];
        return typeof value === 'function' ? value.bind(localDb) : value;
      }

      const adminClient = getCloudAdminClient();
      const value = adminClient[property];
      return typeof value === 'function' ? value.bind(adminClient) : value;
    }
  }
);
