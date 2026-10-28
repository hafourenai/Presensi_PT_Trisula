import { supabaseAdmin } from '$lib/server/admin.js';
import { fail } from '@sveltejs/kit';
import { createAuditLog } from '$lib/server/audit.js';

export const load = async () => {
  const { data: settings } = await supabaseAdmin.from('settings').select('*').eq('id', 1).single();
  const { data: holidays } = await supabaseAdmin.from('holidays').select('*').order('holiday_date');

  return {
    settings: settings || {},
    holidays: holidays || []
  };
};

export const actions = {
  updateSettings: async ({ request, locals }) => {
    const { user, profile: actor } = await locals.safeGetSession();
    if (!user || actor?.role !== 'administrator') {
      return fail(403, { error: 'Hanya Super Administrator yang berwenang.' });
    }

    const formData = await request.formData();
    const work_start = String(formData.get('work_start') || '08:00');
    const work_end = String(formData.get('work_end') || '16:00');
    const late_tolerance_min = parseInt(String(formData.get('late_tolerance_min') || '0'), 10);
    const office_lat = formData.get('office_lat') ? parseFloat(String(formData.get('office_lat'))) : null;
    const office_lng = formData.get('office_lng') ? parseFloat(String(formData.get('office_lng'))) : null;
    const office_radius_m = parseInt(String(formData.get('office_radius_m') || '100'), 10);
    const photo_retention_days = parseInt(String(formData.get('photo_retention_days') || '30'), 10);

    const { error: updErr } = await supabaseAdmin
      .from('settings')
      .update({
        work_start,
        work_end,
        late_tolerance_min,
        office_lat,
        office_lng,
        office_radius_m,
        photo_retention_days,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    if (updErr) {
      return fail(500, { error: 'Gagal memperbarui pengaturan sistem.' });
    }

    await createAuditLog({
      actorId: user.id,
      action: 'update_system_settings',
      targetType: 'settings',
      targetId: '1',
      detail: { work_start, work_end, office_lat, office_lng, office_radius_m }
    });

    return { successSettings: true };
  },

  addHoliday: async ({ request, locals }) => {
    const { user, profile: actor } = await locals.safeGetSession();
    if (!user || actor?.role !== 'administrator') {
      return fail(403, { error: 'Akses ditolak.' });
    }

    const formData = await request.formData();
    const holiday_date = String(formData.get('holiday_date') || '').trim();
    const name = String(formData.get('name') || '').trim();

    if (!holiday_date || !name) {
      return fail(400, { errorHoliday: 'Tanggal dan nama hari libur wajib diisi.' });
    }

    const { error: insErr } = await supabaseAdmin.from('holidays').insert({
      holiday_date,
      name
    });

    if (insErr) {
      return fail(500, { errorHoliday: 'Gagal menambahkan hari libur.' });
    }

    await createAuditLog({
      actorId: user.id,
      action: 'add_holiday',
      targetType: 'holidays',
      targetId: holiday_date,
      detail: { name }
    });

    return { successHoliday: true };
  }
};
