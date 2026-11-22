import { fail } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/admin.js';
import { createAuditLog } from '$lib/server/audit.js';
import { employeeLocation } from '$lib/server/employee-location.js';

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
    if (!user || !actor || !['administrator', 'admin_hr'].includes(actor.role)) {
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
    const initialPassword = String(formData.get('password') || '').trim();

    if (!nip || !full_name || !email || !initialPassword) {
      return fail(400, { error: 'Semua field bertanda bintang wajib diisi.' });
    }

    if (!['admin_hr', 'karyawan'].includes(role)) {
      return fail(400, { error: 'Role akun tidak valid. Administrator hanya dapat ditetapkan melalui rotasi CLI.' });
    }

    let location;
    try {
      location = employeeLocation(formData);
    } catch (error) {
      return fail(400, { error: error.message });
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
      ...location,
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

    return { created: { id: createdAuth.user.id, nip, password: initialPassword } };
  }
};
