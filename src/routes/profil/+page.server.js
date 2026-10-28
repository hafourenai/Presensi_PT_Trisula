import { fail } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/admin.js';
import { createAuditLog } from '$lib/server/audit.js';

export const load = async ({ locals }) => {
  const { user } = await locals.safeGetSession();

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*, department:departments(name)')
    .eq('id', user.id)
    .single();

  return {
    profile
  };
};

export const actions = {
  updateBiodata: async ({ request, locals }) => {
    const { user } = await locals.safeGetSession();
    const formData = await request.formData();
    const phone = String(formData.get('phone') || '').trim();
    const address = String(formData.get('address') || '').trim();

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        phone: phone || null,
        address: address || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      return fail(500, { error: 'Gagal memperbarui biodata.' });
    }

    await createAuditLog({
      actorId: user.id,
      action: 'update_biodata',
      targetType: 'profiles',
      targetId: user.id
    });

    return { successBiodata: true };
  },

  updatePassword: async ({ request, locals }) => {
    const { user } = await locals.safeGetSession();
    const formData = await request.formData();
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');

    if (!password || password.length < 8) {
      return fail(400, { errorPassword: 'Kata sandi minimal 8 karakter.' });
    }
    if (password !== confirmPassword) {
      return fail(400, { errorPassword: 'Konfirmasi kata sandi tidak cocok.' });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password
    });

    if (error) {
      return fail(500, { errorPassword: 'Gagal memperbarui kata sandi.' });
    }

    await createAuditLog({
      actorId: user.id,
      action: 'change_password',
      targetType: 'auth',
      targetId: user.id
    });

    return { successPassword: true };
  }
};
