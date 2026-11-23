import { createServerClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import {
  clearVerifiedAuthCache,
  getAuthCookieFingerprint,
  getCachedVerifiedUser,
  setCachedVerifiedUser
} from '$lib/server/auth-cache.js';

/**
 * Membuat Supabase client untuk server-side request dengan cookies
 * dilengkapi short-TTL verified token cache untuk menghilangkan round-trip
 * berulang ke Supabase Sydney saat navigasi antar-menu.
 * @param {import('@sveltejs/kit').RequestEvent} event
 */
export function createServerSupabaseClient(event) {
  const supabaseUrl = publicEnv.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const publishableKey =
    publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const client = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return event.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, {
            ...options,
            path: options?.path ?? '/'
          });
        });
      }
    }
  });

  const rawTtl = privateEnv.AUTH_CACHE_TTL_MS ?? process.env.AUTH_CACHE_TTL_MS ?? 30000;
  const cacheTtlMs = Number.isFinite(Number(rawTtl)) ? Number(rawTtl) : 30000;
  const isReadMethod = ['GET', 'HEAD'].includes(event.request?.method || 'GET');

  const originalGetUser = client.auth.getUser.bind(client.auth);
  const originalSignOut = client.auth.signOut.bind(client.auth);
  const originalUpdateUser = client.auth.updateUser.bind(client.auth);

  client.auth.getUser = async (...args) => {
    const fingerprint = getAuthCookieFingerprint(event.cookies.getAll());

    if (isReadMethod && args.length === 0 && cacheTtlMs > 0 && fingerprint) {
      const cachedUser = getCachedVerifiedUser(fingerprint);
      if (cachedUser) {
        return { data: { user: cachedUser }, error: null };
      }
    }

    const result = await originalGetUser(...args);
    if (!result.error && result.data?.user && fingerprint && cacheTtlMs > 0) {
      setCachedVerifiedUser(fingerprint, result.data.user, cacheTtlMs);
    }
    return result;
  };

  client.auth.signOut = async (...args) => {
    const fingerprint = getAuthCookieFingerprint(event.cookies.getAll());
    clearVerifiedAuthCache(fingerprint);
    return originalSignOut(...args);
  };

  client.auth.updateUser = async (...args) => {
    const fingerprint = getAuthCookieFingerprint(event.cookies.getAll());
    clearVerifiedAuthCache(fingerprint);
    return originalUpdateUser(...args);
  };

  return client;
}
