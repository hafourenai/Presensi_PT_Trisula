import { supabaseAdmin } from '$lib/server/admin.js';

export const load = async ({ locals, url }) => {
  const { user } = await locals.safeGetSession();

  const monthParam = url.searchParams.get('bulan') || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 7);
  const startDate = `${monthParam}-01`;
  const endDate = `${monthParam}-31`;

  // Ambil data presensi user pada bulan terpilih
  const { data: list } = await supabaseAdmin
    .from('attendances')
    .select('*')
    .eq('user_id', user.id)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date', { ascending: false });

  const records = list || [];

  // Hitung ringkasan
  const totalHadir = records.filter(r => r.status === 'tepat_waktu').length;
  const totalTerlambat = records.filter(r => r.status === 'terlambat').length;
  const totalTidakHadir = records.filter(r => r.status === 'tidak_hadir').length;

  return {
    monthParam,
    records,
    summary: {
      totalHadir,
      totalTerlambat,
      totalTidakHadir,
      totalSemua: records.length
    }
  };
};
