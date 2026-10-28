import { fail, redirect } from '@sveltejs/kit';
import { createAuditLog } from '$lib/server/audit.js';
import { supabaseAdmin } from '$lib/server/admin.js';

export const load = async ({ locals }) => {
  const { user, profile } = await locals.safeGetSession();
  if (!user || !profile) {
    throw redirect(303, '/login');
  }

  return {
    profile,
    mustChange: profile.must_change_password,
    needConsent: !profile.consent_accepted_at
  };
};

export const actions = {
  default: async ({ request, locals }) => {
    const { user, profile } = await locals.safeGetSession();
    if (!user || !profile) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();
    const newPassword = String(formData.get('newPassword') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');
    const consent = formData.get('consent') === 'on';

    if (!profile.consent_accepted_at && !consent) {
      return fail(400, {
        error: 'Anda wajib menyetujui kebijakan privasi dan pengumpulan data presensi.'
      });
    }

    if (profile.must_change_password) {
      if (!newPassword || newPassword.length < 8) {
        return fail(400, {
          error: 'Kata sandi baru minimal 8 karakter.'
        });
      }
      if (newPassword !== confirmPassword) {
        return fail(400, {
          error: 'Konfirmasi kata sandi tidak cocok.'
        });
      }

      // Update password via Auth Admin API agar tidak terbentur sesi lama
      const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword
      });

      if (pwdErr) {
        return fail(500, {
          error: 'Gagal memperbarui kata sandi. Silakan coba lagi.'
        });
      }
    }

    // Update profil di database
    const updateData = {
      must_change_password: false,
      updated_at: new Date().toISOString()
    };

    if (!profile.consent_accepted_at) {
      updateData.consent_accepted_at = new Date().toISOString();
      updateData.consent_version = 'v1.0';
    }

    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (profileErr) {
      return fail(500, {
        error: 'Gagal memperbarui data profil akun.'
      });
    }

    await createAuditLog({
      actorId: user.id,
      action: 'change_initial_password_and_consent',
      targetType: 'profiles',
      targetId: user.id
    });

    if (profile.role === 'karyawan') {
      throw redirect(303, '/presensi');
    } else {
      throw redirect(303, '/dashboard');
    }
  }
};
