import { supabaseAdmin } from '$lib/server/admin.js';
import { fail } from '@sveltejs/kit';
import { createAuditLog } from '$lib/server/audit.js';

export const load = async () => {
  const { data: accounts } = await supabaseAdmin
    .from('profiles')
    .select('*, department:departments(name)')
    .order('created_at', { ascending: false });

  return { accounts: accounts || [] };
};

export const actions = {
  updateRole: async ({ request, locals }) => {
    const { user, profile: actor } = await locals.safeGetSession();
    if (!user || actor?.role !== 'administrator') {
      return fail(403, { error: 'Hanya Super Administrator yang berwenang.' });
    }

    const formData = await request.formData();
    const targetId = String(formData.get('targetId') || '');
    const newRole = String(formData.get('newRole') || '');

    if (!targetId || !newRole) {
      return fail(400, { error: 'Data tidak lengkap.' });
    }

    // Jangan ubah role diri sendiri jika itu administrator tunggal
    if (targetId === user.id && newRole !== 'administrator') {
      return fail(400, { error: 'Anda tidak dapat menurunkan role akun sendiri.' });
    }

    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', targetId);

    if (updErr) {
      return fail(500, { error: 'Gagal memperbarui role akun.' });
    }

    await createAuditLog({
      actorId: user.id,
      action: 'change_user_role',
      targetType: 'profiles',
      targetId,
      detail: { newRole }
    });

    return { successRole: true };
  },

  deleteAccount: async ({ request, locals }) => {
    const { user, profile: actor } = await locals.safeGetSession();
    if (!user || actor?.role !== 'administrator') {
      return fail(403, { error: 'Hanya Administrator yang berwenang menghapus akun.' });
    }

    const formData = await request.formData();
    const targetId = String(formData.get('targetId') || '');

    if (!targetId) {
      return fail(400, { error: 'Target akun tidak valid.' });
    }

    if (targetId === user.id) {
      return fail(400, { error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
    }

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('nip, full_name, email, role')
      .eq('id', targetId)
      .single();

    if (!targetProfile) {
      return fail(404, { error: 'Akun tidak ditemukan.' });
    }

    // Bersihkan file storage foto presensi & avatar
    try {
      const { data: attendanceFiles } = await supabaseAdmin.storage
        .from('attendance-photos')
        .list(targetId);
      if (attendanceFiles && attendanceFiles.length > 0) {
        const paths = attendanceFiles.map((f) => `${targetId}/${f.name}`);
        await supabaseAdmin.storage.from('attendance-photos').remove(paths);
      }

      const { data: avatarFiles } = await supabaseAdmin.storage
        .from('avatars')
        .list(targetId);
      if (avatarFiles && avatarFiles.length > 0) {
        const avatarPaths = avatarFiles.map((f) => `${targetId}/${f.name}`);
        await supabaseAdmin.storage.from('avatars').remove(avatarPaths);
      }
    } catch (storageErr) {
      console.warn('Gagal membersihkan storage user (diabaikan):', storageErr);
    }

    // Hapus presensi
    await supabaseAdmin.from('attendances').delete().eq('user_id', targetId);

    // Hapus profil
    const { error: delProfileErr } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', targetId);

    if (delProfileErr) {
      return fail(500, { error: `Gagal menghapus profil: ${delProfileErr.message}` });
    }

    // Hapus auth
    await supabaseAdmin.auth.admin.deleteUser(targetId);

    // Audit log
    await createAuditLog({
      actorId: user.id,
      action: 'delete_employee_account_permanent',
      targetType: 'profiles',
      targetId,
      detail: targetProfile
    });

    return { successDelete: true, deletedName: targetProfile.full_name };
  }
};
