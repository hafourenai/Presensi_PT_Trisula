import { fail, redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/admin.js';
import { createAuditLog } from '$lib/server/audit.js';

export const load = async () => {
  const { data: departments } = await supabaseAdmin
    .from('departments')
    .select('*')
    .order('name', { ascending: true });

  return {
    departments: departments || []
  };
};

export const actions = {
  default: async ({ request, locals }) => {
    const { user, profile: actor } = await locals.safeGetSession();
    if (!user || !actor || !['administrator', 'hr'].includes(actor.role)) {
      return fail(403, { error: 'Akses ditolak.' });
    }

    const formData = await request.formData();
    const nip = String(formData.get('nip') || '').trim();
    const full_name = String(formData.get('full_name') || '').trim();
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const role = String(formData.get('role') || 'karyawan');
    const department_id = String(formData.get('department_id') || '') || null;
    const position = String(formData.get('position') || '').trim() || null;
    const work_location_name = String(formData.get('work_location_name') || '').trim() || null;
    const work_lat = formData.get('work_lat') ? parseFloat(String(formData.get('work_lat'))) : null;
    const work_lng = formData.get('work_lng') ? parseFloat(String(formData.get('work_lng'))) : null;
    const work_radius_m = formData.get('work_radius_m') ? parseInt(String(formData.get('work_radius_m')), 10) : null;
    const initialPassword = String(formData.get('password') || '').trim();

    if (!nip || !full_name || !email || !initialPassword) {
      return fail(400, { error: 'Semua field bertanda bintang wajib diisi.' });
    }

    // Role HR tidak boleh membuat akun administrator
    if (role === 'administrator' && actor.role !== 'administrator') {
      return fail(403, { error: 'Hanya Administrator yang dapat membuat akun Administrator.' });
    }

    // Buat akun di Supabase Auth
    const { data: createdAuth, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: initialPassword,
      email_confirm: true
    });

    if (authErr || !createdAuth?.user) {
      return fail(400, {
        error: `Gagal membuat akun auth: ${authErr?.message || 'Email mungkin sudah terdaftar'}`
      });
    }

    // Buat profil di database
    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id: createdAuth.user.id,
      nip,
      full_name,
      email,
      role,
      department_id,
      position,
      work_location_name,
      work_lat,
      work_lng,
      work_radius_m,
      must_change_password: true,
      is_active: true
    });

    if (profileErr) {
      // Rollback Auth jika profil gagal
      await supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id);
      return fail(400, {
        error: `Gagal membuat profil: ${profileErr.message}`
      });
    }

    await createAuditLog({
      actorId: user.id,
      action: 'create_employee_account',
      targetType: 'profiles',
      targetId: createdAuth.user.id,
      detail: { nip, email, role }
    });

    throw redirect(303, `/admin/karyawan/${createdAuth.user.id}?created=true&pwd=${encodeURIComponent(initialPassword)}`);
  }
};
