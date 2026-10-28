import { createServerSupabaseClient } from '$lib/server/supabase.js';
import { supabaseAdmin } from '$lib/server/admin.js';
import { redirect } from '@sveltejs/kit';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  event.locals.supabase = createServerSupabaseClient(event);

  /**
   * Helper aman untuk mendapatkan session & user
   */
  event.locals.safeGetSession = async () => {
    const {
      data: { user },
      error
    } = await event.locals.supabase.auth.getUser();
    if (error || !user) {
      return { session: null, user: null, profile: null };
    }

    // Ambil profile dari database
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*, department:departments(name)')
      .eq('id', user.id)
      .single();

    return { session: { user }, user, profile };
  };

  const { user, profile } = await event.locals.safeGetSession();
  event.locals.user = user;
  event.locals.profile = profile;

  const url = event.url.pathname;

  const hostname = event.url.hostname;
  const isAdminSubdomain = hostname.startsWith('admin.');
  const isKaryawanRole = profile?.role === 'karyawan';
  const isAdminRole = ['administrator', 'pemilik', 'admin_hr'].includes(profile?.role);

  // 1. Publik / Tanpa Login
  if (!user && url !== '/login') {
    if (url === '/') {
      throw redirect(303, '/login');
    }
    throw redirect(303, `/login?redirect=${encodeURIComponent(url)}`);
  }

  // 2. Jika sudah Login
  if (user && profile) {
    if (!profile.is_active && url !== '/login') {
      await event.locals.supabase.auth.signOut();
      throw redirect(303, '/login?error=inactive');
    }

    if (profile.must_change_password && url !== '/ganti-password') {
      throw redirect(303, '/ganti-password');
    }

    if (!profile.must_change_password && url === '/ganti-password') {
      throw redirect(303, isKaryawanRole ? '/presensi' : '/admin/dashboard');
    }

    if (url === '/login' || url === '/') {
      if (profile.must_change_password) {
        throw redirect(303, '/ganti-password');
      }
      throw redirect(303, isKaryawanRole ? '/presensi' : '/admin/dashboard');
    }

    // Isolasi Subdomain: Admin Subdomain vs Domain Utama
    if (isAdminSubdomain && isKaryawanRole) {
      // Karyawan dilarang login/akses di subdomain admin
      await event.locals.supabase.auth.signOut();
      throw redirect(303, '/login?error=unauthorized_domain');
    }

    // Role route guards
    if (isKaryawanRole) {
      const allowedPrefixes = ['/presensi', '/riwayat', '/profil', '/ganti-password', '/auth', '/api'];
      if (!allowedPrefixes.some((p) => url.startsWith(p))) {
        throw redirect(303, '/presensi');
      }
    } else if (isAdminRole) {
      if (url.startsWith('/presensi') || url.startsWith('/riwayat')) {
        throw redirect(303, '/admin/dashboard');
      }

      const superAdminRoutes = ['/admin/akun', '/admin/audit-log', '/admin/pengaturan'];
      if (superAdminRoutes.some((r) => url.startsWith(r)) && profile.role !== 'administrator') {
        throw redirect(303, '/admin/dashboard');
      }
    }
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    }
  });
}
