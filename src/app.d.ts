/// <reference types="@sveltejs/kit" />

declare namespace App {
  interface Locals {
    supabase: import('@supabase/supabase-js').SupabaseClient;
    safeGetSession: () => Promise<{
      session: { user: import('@supabase/supabase-js').User } | null;
      user: import('@supabase/supabase-js').User | null;
      profile: any | null;
    }>;
    user: import('@supabase/supabase-js').User | null;
    profile: any | null;
  }
}
