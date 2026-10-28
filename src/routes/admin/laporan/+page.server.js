import { supabaseAdmin } from '$lib/server/admin.js';

export const load = async ({ url }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const startDate = url.searchParams.get('startDate') || `${today.slice(0, 7)}-01`;
  const endDate = url.searchParams.get('endDate') || today;
  const deptId = url.searchParams.get('dept') || '';
  const employeeId = url.searchParams.get('employeeId') || '';
  const status = url.searchParams.get('status') || '';
  const outsideOnly = url.searchParams.get('outsideOnly') === 'true';

  // Daftar departemen & karyawan untuk filter dropdown
  const [{ data: departments }, { data: employees }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('departments').select('*').order('name'),
    supabaseAdmin.from('profiles').select('id, nip, full_name, role, department_id').order('full_name'),
    supabaseAdmin.from('settings').select('*').eq('id', 1).single()
  ]);

  const radiusM = settings?.office_radius_m || 100;

  // Query Presensi
  // Gunakan inner join profiles jika memfilter departemen di query SQL
  const profileSelect = deptId
    ? 'profile:profiles!inner(id, nip, full_name, role, department_id, department:departments(id, name))'
    : 'profile:profiles(id, nip, full_name, role, department_id, department:departments(id, name))';

  let query = supabaseAdmin
    .from('attendances')
    .select(`*, ${profileSelect}`)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date', { ascending: false });

  if (deptId) {
    query = query.eq('profiles.department_id', deptId);
  }

  if (employeeId) {
    query = query.eq('user_id', employeeId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data: list } = await query;
  let attendances = list || [];

  // Filter di luar radius (check-in atau check-out melampaui radius batas)
  if (outsideOnly) {
    attendances = attendances.filter(
      (r) =>
        (r.check_in_distance_m !== null && r.check_in_distance_m > radiusM) ||
        (r.check_out_distance_m !== null && r.check_out_distance_m > radiusM)
    );
  }

  // Agregasi Rekap per Karyawan (FR-L4)
  const recapMap = new Map();

  for (const r of attendances) {
    const uid = r.user_id;
    if (!recapMap.has(uid)) {
      recapMap.set(uid, {
        userId: uid,
        nip: r.profile?.nip || '-',
        fullName: r.profile?.full_name || 'Tanpa Nama',
        departmentName: r.profile?.department?.name || '-',
        totalDays: 0,
        presentCount: 0,
        onTimeCount: 0,
        lateCount: 0,
        totalLateMinutes: 0,
        absentCount: 0,
        earlyLeaveCount: 0,
        totalEarlyLeaveMinutes: 0,
        outsideRadiusCount: 0
      });
    }

    const row = recapMap.get(uid);
    row.totalDays += 1;

    if (r.status === 'tepat_waktu') {
      row.presentCount += 1;
      row.onTimeCount += 1;
    } else if (r.status === 'terlambat') {
      row.presentCount += 1;
      row.lateCount += 1;
      row.totalLateMinutes += r.late_minutes || 0;
    } else if (r.status === 'tidak_hadir') {
      row.absentCount += 1;
    }

    if (r.early_leave_minutes && r.early_leave_minutes > 0) {
      row.earlyLeaveCount += 1;
      row.totalEarlyLeaveMinutes += r.early_leave_minutes;
    }

    const isOutside =
      (r.check_in_distance_m !== null && r.check_in_distance_m > radiusM) ||
      (r.check_out_distance_m !== null && r.check_out_distance_m > radiusM);
    if (isOutside) {
      row.outsideRadiusCount += 1;
    }
  }

  const recap = Array.from(recapMap.values()).map((row) => ({
    ...row,
    attendanceRate: row.totalDays > 0 ? Math.round((row.presentCount / row.totalDays) * 100) : 0
  }));

  return {
    attendances,
    recap,
    departments: departments || [],
    employees: employees || [],
    filters: {
      startDate,
      endDate,
      deptId,
      employeeId,
      status,
      outsideOnly
    },
    radiusM
  };
};
