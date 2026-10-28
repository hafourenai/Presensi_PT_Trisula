import { fail, redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/admin.js';
import { createAuditLog } from '$lib/server/audit.js';

export const load = async () => {
  const { data: departments } = await supabaseAdmin.from('departments').select('*').order('name');
  return { departments: departments || [] };
};

export const actions = {
  default: async ({ request, locals }) => {
    const { user, profile: actor } = await locals.safeGetSession();
    if (!user || !actor || !['administrator', 'pemilik', 'admin_hr'].includes(actor.role)) {
      return fail(403, { error: 'Akses ditolak.' });
    }

    const formData = await request.formData();
    const csvContent = String(formData.get('csvContent') || '').trim();

    if (!csvContent) {
      return fail(400, { error: 'Silakan tempel atau unggah data CSV karyawan.' });
    }

    const lines = csvContent.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return fail(400, { error: 'Format CSV harus berisi baris header dan minimal 1 baris data.' });
    }

    // Header expected: NIP,Nama,Email,Password,Departemen,Jabatan
    const rows = lines.slice(1);
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Ambil mapping departemen
    const { data: depts } = await supabaseAdmin.from('departments').select('id, name');
    const deptMap = {};
    (depts || []).forEach((d) => {
      deptMap[d.name.toLowerCase()] = d.id;
    });

    for (let i = 0; i < rows.length; i++) {
      const line = rows[i];
      const parts = line.split(',').map((p) => p.trim());
      const [nip, full_name, email, password, deptName, position] = parts;

      if (!nip || !full_name || !email || !password) {
        results.failed++;
        results.errors.push(`Baris ${i + 2}: NIP, Nama, Email, dan Password wajib diisi.`);
        continue;
      }

      try {
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: email.toLowerCase(),
          password,
          email_confirm: true
        });

        if (authErr || !authUser?.user) {
          results.failed++;
          results.errors.push(`Baris ${i + 2} (${nip}): ${authErr?.message || 'Gagal membuat auth'}`);
          continue;
        }

        const deptId = deptName ? deptMap[deptName.toLowerCase()] || null : null;

        const { error: profErr } = await supabaseAdmin.from('profiles').insert({
          id: authUser.user.id,
          nip,
          full_name,
          email: email.toLowerCase(),
          role: 'karyawan',
          department_id: deptId,
          position: position || null,
          must_change_password: true,
          is_active: true
        });

        if (profErr) {
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          results.failed++;
          results.errors.push(`Baris ${i + 2} (${nip}): ${profErr.message}`);
          continue;
        }

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Baris ${i + 2} (${nip}): Gagal diproses.`);
      }
    }

    await createAuditLog({
      actorId: user.id,
      action: 'bulk_import_employees',
      targetType: 'profiles',
      detail: { success: results.success, failed: results.failed }
    });

    return { importResult: results };
  }
};
