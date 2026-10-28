import { supabaseAdmin } from '$lib/server/admin.js';

export const load = async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  // Total Karyawan Aktif
  const { count: totalActiveEmployees } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'karyawan')
    .eq('is_active', true);

  // Presensi Hari Ini
  const { data: todayAttendances } = await supabaseAdmin
    .from('attendances')
    .select('*, profile:profiles(nip, full_name, role, department:departments(name))')
    .eq('work_date', today);

  const list = todayAttendances || [];

  const hadirTepatWaktu = list.filter(r => r.status === 'tepat_waktu').length;
  const terlambat = list.filter(r => r.status === 'terlambat').length;
  const totalHadir = hadirTepatWaktu + terlambat;
  const tidakHadir = list.filter(r => r.status === 'tidak_hadir').length;
  const belumPresensi = Math.max(0, (totalActiveEmployees || 0) - totalHadir - tidakHadir);

  // Luar Radius
  const { data: settings } = await supabaseAdmin.from('settings').select('*').eq('id', 1).single();
  const radiusM = settings?.office_radius_m || 100;
  const diLuarRadius = list.filter(r => (r.check_in_distance_m && r.check_in_distance_m > radiusM) || (r.check_out_distance_m && r.check_out_distance_m > radiusM)).length;
  const perangkatTidakDikenal = list.filter(r => r.is_unrecognized_device).length;

  // Notifikasi HR Terbaru (Terutama Perangkat Baru)
  const { data: latestNotifications } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .or('target_role.eq.hr,target_role.is.null')
    .order('created_at', { ascending: false })
    .limit(5);

  // 10 Presensi Terbaru Hari Ini
  const recentAttendances = list
    .filter(r => r.check_in_at)
    .sort((a, b) => new Date(b.check_in_at).getTime() - new Date(a.check_in_at).getTime())
    .slice(0, 10);

  // Paling Sering Terlambat
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data: monthlyLate } = await supabaseAdmin
    .from('attendances')
    .select('user_id, late_minutes, profile:profiles(nip, full_name, department:departments(name))')
    .gte('work_date', monthStart)
    .lte('work_date', today)
    .eq('status', 'terlambat');

  const lateCounts = {};
  (monthlyLate || []).forEach(item => {
    if (!item.profile) return;
    if (!lateCounts[item.user_id]) {
      lateCounts[item.user_id] = {
        name: item.profile.full_name,
        nip: item.profile.nip,
        dept: item.profile.department?.name || '-',
        count: 0,
        totalMinutes: 0
      };
    }
    lateCounts[item.user_id].count += 1;
    lateCounts[item.user_id].totalMinutes += item.late_minutes || 0;
  });

  const topLateList = Object.values(lateCounts)
    .sort((a, b) => b.count - a.count || b.totalMinutes - a.totalMinutes)
    .slice(0, 5);

  return {
    today,
    totalActiveEmployees: totalActiveEmployees || 0,
    summary: {
      hadirTepatWaktu,
      terlambat,
      totalHadir,
      belumPresensi,
      tidakHadir,
      diLuarRadius,
      perangkatTidakDikenal
    },
    recentAttendances,
    topLateList,
    latestNotifications: latestNotifications || []
  };
};
