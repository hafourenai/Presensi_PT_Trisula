import { createServerSupabaseClient } from '$lib/server/supabase.js';
import { supabaseAdmin } from '$lib/server/admin.js';
import { portalConfig, portalForHost, portalUrl } from '$lib/server/domains.js';
import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const reqStart = performance.now();
  let sessionDur = 0;
  event.locals.supabase = createServerSupabaseClient(event);

  /**
   * Helper aman untuk mendapatkan session & user
   */
  const readSession = async () => {
    const t0 = performance.now();
    const {
      data: { user },
      error
    } = await event.locals.supabase.auth.getUser();
    if (error || !user) {
      sessionDur = performance.now() - t0;
      return { session: null, user: null, profile: null };
    }

    // Ambil profile dari database
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*, department:departments(name)')
      .eq('id', user.id)
      .single();

    sessionDur = performance.now() - t0;
    return { session: { user }, user, profile };
  };

  // Share in-flight verification within a navigation, never between users/requests.
  // Actions may change auth or profile state, so retain fresh reads for mutations.
  let sessionPromise;
  event.locals.safeGetSession = () => {
    if (!['GET', 'HEAD'].includes(event.request.method)) {
      supabaseAdmin.invalidateCache?.('profiles');
      return readSession();
    }
    return sessionPromise ??= readSession();
  };

  const { user, profile } = await event.locals.safeGetSession();
  event.locals.user = user;
  event.locals.profile = profile;

  const url = event.url.pathname;

  const domains = portalConfig(env, env.NODE_ENV);
  const portal = portalForHost(event.url.hostname, domains);
  if (!portal) {
    throw error(400, 'Host tidak diizinkan.');
  }

  const isAdminSubdomain = portal === 'admin';
  const isEmployeeDomain = portal === 'employee';
  const isKaryawanRole = profile?.role === 'karyawan';
  const isAdminRole = ['administrator', 'admin_hr'].includes(profile?.role);

  if (isEmployeeDomain && url.startsWith('/admin')) {
    throw redirect(303, portalUrl(domains.adminOrigin, url, event.url.search));
  }

  if (isAdminSubdomain && (url.startsWith('/presensi') || url.startsWith('/riwayat') || url.startsWith('/api/presensi'))) {
    throw error(404, 'Halaman tidak ditemukan.');
  }

  if (isEmployeeDomain && url.startsWith('/api/resolve-maps')) {
    throw error(404, 'Halaman tidak ditemukan.');
  }

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

    if (profile.must_change_password && url !== '/ganti-password' && url !== '/auth/logout') {
      throw redirect(303, '/ganti-password');
    }

    if (!profile.must_change_password && url === '/ganti-password') {
      let needsDeviceRegistration = false;
      if (isKaryawanRole) {
        const { data: trustedDevices } = await supabaseAdmin
          .from('user_devices')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_trusted', true)
          .limit(1);
        needsDeviceRegistration = !trustedDevices || trustedDevices.length === 0;
      }
      if (!needsDeviceRegistration) {
        throw redirect(303, isKaryawanRole ? '/presensi' : '/admin/dashboard');
      }
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

    if (isEmployeeDomain && isAdminRole) {
      throw redirect(303, portalUrl(domains.adminOrigin, '/admin/dashboard'));
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

  const response = await resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    }
  });

  try {
    const totalDur = performance.now() - reqStart;
    const dbMode = supabaseAdmin.isLocalPg ? 'local_pg' : 'cloud_rest';
    response.headers.set(
      'server-timing',
      `session;dur=${sessionDur.toFixed(2)}, total;dur=${totalDur.toFixed(2)};desc="${dbMode}"`
    );
  } catch {
    // Ignore immutable synthetic headers in unit tests
  }

  return response;
}
