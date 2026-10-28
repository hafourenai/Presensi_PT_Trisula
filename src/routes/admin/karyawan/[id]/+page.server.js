import { error, fail, redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/admin.js';
import { createAuditLog } from '$lib/server/audit.js';

export const load = async ({ params, url }) => {
  const id = params.id;

  // Profil Karyawan
  const { data: employee, error: empErr } = await supabaseAdmin
    .from('profiles')
    .select('*, department:departments(name)')
    .eq('id', id)
    .single();

  if (empErr || !employee) {
    throw error(404, 'Karyawan tidak ditemukan.');
  }

  // Departemen List
  const { data: departments } = await supabaseAdmin
    .from('departments')
    .select('*')
    .order('name', { ascending: true });

  // 10 Riwayat Presensi Terakhir
  const { data: recentAttendances } = await supabaseAdmin
    .from('attendances')
    .select('*')
    .eq('user_id', id)
    .order('work_date', { ascending: false })
    .limit(10);

  const isNewlyCreated = url.searchParams.get('created') === 'true';
  const initialPwd = url.searchParams.get('pwd') || '';

  return {
    employee,
    departments: departments || [],
    recentAttendances: recentAttendances || [],
    isNewlyCreated,
    initialPwd
  };
};

export const actions = {
  updateStatus: async ({ params, request, locals }) => {
    const { user, profile: actor } = await locals.safeGetSession();
    if (!user || !actor || !['administrator', 'pemilik', 'admin_hr'].includes(actor.role)) {
      return fail(403, { error: 'Akses ditolak.' });
    }

    const id = params.id;
    const formData = await request.formData();
    const isActive = formData.get('is_active') === 'true';

    // Cek target
    const { data: target } = await supabaseAdmin.from('profiles').select('role').eq('id', id).single();
    if (target?.role === 'administrator' && actor.role !== 'administrator') {
      return fail(403, { error: 'Anda tidak dapat mengubah akun Administrator.' });
    }

    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updErr) {
      return fail(500, { error: 'Gagal memperbarui status akun.' });
    }

    await createAuditLog({
      actorId: user.id,
      action: isActive ? 'activate_account' : 'deactivate_account',
      targetType: 'profiles',
      targetId: id
    });

    return { successStatus: true };
  },

  resetPassword: async ({ params, request, locals }) => {
    const { user, profile: actor } = await locals.safeGetSession();
    if (!user || !actor || !['administrator', 'pemilik', 'admin_hr'].includes(actor.role)) {
      return fail(403, { error: 'Akses ditolak.' });
    }

    const id = params.id;
    const formData = await request.formData();
    const newPassword = String(formData.get('password') || '').trim();

    if (!newPassword || newPassword.length < 8) {
      return fail(400, { errorReset: 'Kata sandi baru minimal 8 karakter.' });
    }

    const { data: target } = await supabaseAdmin.from('profiles').select('role').eq('id', id).single();
    if (target?.role === 'administrator' && actor.role !== 'administrator') {
      return fail(403, { errorReset: 'Anda tidak dapat mereset password akun Administrator.' });
    }

    const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: newPassword
    });

    if (resetErr) {
      return fail(500, { errorReset: 'Gagal mereset kata sandi di Auth server.' });
    }

    // Set must_change_password = true
    await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    await createAuditLog({
      actorId: user.id,
      action: 'admin_reset_employee_password',
      targetType: 'profiles',
      targetId: id
    });

    return { successReset: true, resetPwd: newPassword };
  },

  updateLocation: async ({ params, request, locals }) => {
    const { user, profile: actor } = await locals.safeGetSession();
    if (!user || !actor || !['administrator', 'pemilik', 'admin_hr'].includes(actor.role)) {
      return fail(403, { errorLocation: 'Akses ditolak.' });
    }

    const id = params.id;
    const formData = await request.formData();
    const work_location_name = String(formData.get('work_location_name') || '').trim() || null;
    const work_lat = formData.get('work_lat') ? parseFloat(String(formData.get('work_lat'))) : null;
    const work_lng = formData.get('work_lng') ? parseFloat(String(formData.get('work_lng'))) : null;
    const work_radius_m = formData.get('work_radius_m') ? parseInt(String(formData.get('work_radius_m')), 10) : null;

    if ((work_lat !== null && work_lng === null) || (work_lat === null && work_lng !== null)) {
      return fail(400, { errorLocation: 'Latitude dan Longitude harus diisi berpasangan atau dikosongkan keduanya.' });
    }

    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update({
        work_location_name,
        work_lat,
        work_lng,
        work_radius_m,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updErr) {
      return fail(500, { errorLocation: `Gagal memperbarui lokasi kerja: ${updErr.message}` });
    }

    await createAuditLog({
      actorId: user.id,
      action: 'update_employee_work_location',
      targetType: 'profiles',
      targetId: id,
      detail: { work_location_name, work_lat, work_lng, work_radius_m }
    });

    return { successLocation: true };
  },

  deleteAccount: async ({ params, locals }) => {
    const { user, profile: actor } = await locals.safeGetSession();
    if (!user || !actor || actor.role !== 'administrator') {
      return fail(403, { errorDelete: 'Hanya Administrator yang dapat menghapus akun secara permanen.' });
    }

    const id = params.id;

    if (id === user.id) {
      return fail(400, { errorDelete: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
    }

    // Ambil data profil sebelum dihapus untuk detail audit log
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('nip, full_name, email, role')
      .eq('id', id)
      .single();

    if (!targetProfile) {
      return fail(404, { errorDelete: 'Data karyawan tidak ditemukan.' });
    }

    // 1. Bersihkan file foto di storage bucket attendance-photos dan avatars jika ada
    try {
      const { data: attendanceFiles } = await supabaseAdmin.storage
        .from('attendance-photos')
        .list(id);
      if (attendanceFiles && attendanceFiles.length > 0) {
        const paths = attendanceFiles.map((f) => `${id}/${f.name}`);
        await supabaseAdmin.storage.from('attendance-photos').remove(paths);
      }

      const { data: avatarFiles } = await supabaseAdmin.storage
        .from('avatars')
        .list(id);
      if (avatarFiles && avatarFiles.length > 0) {
        const avatarPaths = avatarFiles.map((f) => `${id}/${f.name}`);
        await supabaseAdmin.storage.from('avatars').remove(avatarPaths);
      }
    } catch (storageErr) {
      console.warn('Gagal membersihkan storage user (diabaikan):', storageErr);
    }

    // 2. Hapus data presensi karyawan (jika cascade belum terpicu)
    await supabaseAdmin.from('attendances').delete().eq('user_id', id);

    // 3. Hapus profil database
    const { error: delProfileErr } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);

    if (delProfileErr) {
      return fail(500, { errorDelete: `Gagal menghapus profil database: ${delProfileErr.message}` });
    }

    // 4. Hapus akun Supabase Auth
    const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (delAuthErr) {
      console.warn('Gagal menghapus auth user:', delAuthErr);
    }

    // 5. Catat audit log
    await createAuditLog({
      actorId: user.id,
      action: 'delete_employee_account_permanent',
      targetType: 'profiles',
      targetId: id,
      detail: targetProfile
    });

    throw redirect(303, '/admin/karyawan?deleted=true');
  }
};
