import { fail, redirect } from '@sveltejs/kit';
import { createAuditLog } from '$lib/server/audit.js';
import { supabaseAdmin } from '$lib/server/admin.js';

export const load = async ({ locals, url }) => {
  const { user, profile } = await locals.safeGetSession();
  if (user && profile) {
    if (profile.must_change_password) {
      throw redirect(303, '/ganti-password');
    }
    if (profile.role === 'karyawan') {
      throw redirect(303, '/presensi');
    }
    throw redirect(303, '/admin/dashboard');
  }

  const errorParam = url.searchParams.get('error');
  let errorMessage = '';
  if (errorParam === 'inactive') {
    errorMessage = 'Akun Anda telah dinonaktifkan. Silakan hubungi Administrator.';
  } else if (errorParam === 'unauthorized_domain') {
    errorMessage = 'Portal Admin ini hanya dapat diakses oleh Administrator, Pemilik, atau HR.';
  }

  return { errorMessage };
};

export const actions = {
  default: async ({ request, locals }) => {
    const formData = await request.formData();
    const identifier = String(formData.get('identifier') || '').trim();
    const password = String(formData.get('password') || '');

    if (!identifier || !password) {
      return fail(400, {
        error: 'NIP / Username atau Email dan kata sandi wajib diisi.',
        identifier
      });
    }

    let targetEmail = identifier.toLowerCase();

    // Jika pengguna memasukkan NIP / Username (bukan format email)
    if (!identifier.includes('@')) {
      const { data: profileByNip } = await supabaseAdmin
        .from('profiles')
        .select('email, is_active')
        .eq('nip', identifier)
        .maybeSingle();

      if (!profileByNip) {
        return fail(400, {
          error: 'NIP / Username tidak ditemukan dalam sistem.',
          identifier
        });
      }

      if (!profileByNip.is_active) {
        return fail(403, {
          error: 'Akun Anda telah dinonaktifkan. Silakan hubungi Administrator.',
          identifier
        });
      }

      targetEmail = profileByNip.email;
    }

    // Login ke Supabase Auth menggunakan email & password
    const { data, error } = await locals.supabase.auth.signInWithPassword({
      email: targetEmail,
      password
    });

    if (error || !data.user) {
      return fail(400, {
        error: 'Kata sandi atau identitas masuk salah. Silakan coba lagi.',
        identifier
      });
    }

    // Ambil profil
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!profile || !profile.is_active) {
      await locals.supabase.auth.signOut();
      return fail(403, {
        error: 'Akun Anda tidak aktif atau belum terdaftar di sistem profil.',
        identifier
      });
    }

    // Catat login
    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);

    await createAuditLog({
      actorId: data.user.id,
      action: 'login',
      targetType: 'auth',
      targetId: data.user.id,
      detail: { identifier, email: targetEmail }
    });

    if (profile.must_change_password) {
      throw redirect(303, '/ganti-password');
    }

    if (profile.role === 'karyawan') {
      throw redirect(303, '/presensi');
    } else {
      throw redirect(303, '/admin/dashboard');
    }
  }
};
