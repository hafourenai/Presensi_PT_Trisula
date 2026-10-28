import { supabaseAdmin } from '$lib/server/admin.js';

export const load = async ({ locals }) => {
  const { user, profile } = await locals.safeGetSession();

  // Ambil data hari ini (WIB)
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta'
  }).format(new Date());

  // Ambil presensi hari ini
  const { data: attendance } = await supabaseAdmin
    .from('attendances')
    .select('*')
    .eq('user_id', user.id)
    .eq('work_date', today)
    .maybeSingle();

  // Ambil pengaturan jam kerja & lokasi kantor umum
  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();

  // Tentukan lokasi target (prioritas profil khusus, fallback settings kantor)
  const office_lat = profile?.work_lat ?? (settings?.office_lat || -6.200000);
  const office_lng = profile?.work_lng ?? (settings?.office_lng || 106.816666);
  const office_radius_m = profile?.work_radius_m ?? (settings?.office_radius_m || 100);
  const location_name = profile?.work_location_name || 'Kantor Pusat';

  return {
    today,
    attendance,
    settings: {
      work_start: settings?.work_start || '08:00',
      work_end: settings?.work_end || '16:00',
      office_lat,
      office_lng,
      office_radius_m,
      late_tolerance_min: settings?.late_tolerance_min || 0,
      location_name,
      is_custom_location: !!(profile?.work_lat && profile?.work_lng)
    }
  };
};
