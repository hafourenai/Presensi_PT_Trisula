import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

/**
 * Membuat Supabase client untuk server-side request dengan cookies
 * @param {import('@sveltejs/kit').RequestEvent} event
 */
export function createServerSupabaseClient(event) {
  return createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
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
}
