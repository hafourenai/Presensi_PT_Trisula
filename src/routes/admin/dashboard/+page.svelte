<script>
  import {
    Users,
    UserCheck,
    Clock,
    UserX,
    MapPinOff,
    TrendingUp,
    AlertCircle,
    Calendar,
    Building2,
    ArrowUpRight,
    Smartphone,
    ShieldAlert
  } from '@lucide/svelte';

  let { data } = $props();

  function formatTime(isoString) {
    if (!isoString) return '--:--';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(isoString));
  }
</script>

<svelte:head>
  <title>Dashboard Admin — Presensi Karyawan</title>
</svelte:head>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Dashboard Kehadiran</h1>
      <p class="mt-1 text-xs text-slate-500">
        Pantauan presensi real-time karyawan hari ini ({new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())})
      </p>
    </div>
    <a
      href="/admin/laporan"
      class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
    >
      <span>Lihat Laporan Lengkap</span>
      <ArrowUpRight class="h-4 w-4" />
    </a>
  </div>

  <!-- Metric KPI Cards -->
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Karyawan</span>
        <Users class="h-4 w-4 text-slate-400" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900">{data.totalActiveEmployees}</p>
      <p class="text-[11px] text-slate-400">Aktif di sistem</p>
    </div>

    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Tepat Waktu</span>
        <UserCheck class="h-4 w-4 text-emerald-600" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900">{data.summary.hadirTepatWaktu}</p>
      <p class="text-[11px] text-emerald-600 font-medium">Orang</p>
    </div>

    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-amber-700">Terlambat</span>
        <Clock class="h-4 w-4 text-amber-600" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900">{data.summary.terlambat}</p>
      <p class="text-[11px] text-amber-600 font-medium">Orang</p>
    </div>

    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Belum Presensi</span>
        <Calendar class="h-4 w-4 text-slate-400" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900">{data.summary.belumPresensi}</p>
      <p class="text-[11px] text-slate-400">Orang</p>
    </div>

    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-red-700">Tidak Hadir</span>
        <UserX class="h-4 w-4 text-red-600" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900">{data.summary.tidakHadir}</p>
      <p class="text-[11px] text-red-600 font-medium">Orang</p>
    </div>

    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-rose-700">Perangkat Asing</span>
        <Smartphone class="h-4 w-4 text-rose-600" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900">{data.summary.perangkatTidakDikenal}</p>
      <p class="text-[11px] text-rose-600 font-medium">Presensi Flagged</p>
    </div>
  </div>

  {#if data.latestNotifications && data.latestNotifications.length > 0}
    <!-- Banner Peringatan Perangkat & Audit HR -->
    <div class="rounded-3xl border border-rose-200/80 bg-rose-50/60 p-5 shadow-xs">
      <div class="flex items-center gap-2 font-bold text-sm text-rose-900">
        <ShieldAlert class="h-5 w-5 text-rose-600" />
        <span>Pemberitahuan Audit Deteksi Perangkat</span>
      </div>
      <div class="mt-3 space-y-2">
        {#each data.latestNotifications as notif}
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl bg-white/90 p-3 border border-rose-100 text-xs">
            <div class="flex items-start gap-2">
              <span class="mt-0.5 h-2 w-2 rounded-full bg-rose-500 shrink-0"></span>
              <div>
                <p class="font-bold text-slate-900">{notif.title}</p>
                <p class="text-slate-600 mt-0.5">{notif.message}</p>
              </div>
            </div>
            <span class="text-[10px] font-mono text-slate-400 shrink-0">
              {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(notif.created_at))} WIB
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <!-- 10 Presensi Terbaru Hari Ini -->
    <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-6 lg:col-span-2">
      <div class="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 class="text-sm font-bold text-slate-900">Aktivitas Presensi Terbaru Hari Ini</h3>
          <p class="text-xs text-slate-500">10 presensi terakhir yang tercatat di server</p>
        </div>
      </div>

      {#if data.recentAttendances.length === 0}
        <div class="py-12 text-center text-xs text-slate-400">
          <Clock class="mx-auto h-8 w-8 text-slate-300" />
          <p class="mt-2">Belum ada aktivitas presensi masuk hari ini.</p>
        </div>
      {:else}
        <div class="mt-4 divide-y divide-slate-100">
          {#each data.recentAttendances as item}
            <div class="flex items-center justify-between gap-3 py-3">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-xs text-slate-600">
                  {item.profile?.full_name?.slice(0, 2) || 'KY'}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-bold text-slate-900 truncate">{item.profile?.full_name}</p>
                  <p class="text-[11px] text-slate-400 truncate">{item.profile?.nip} · {item.profile?.department?.name || '-'}</p>
                </div>
              </div>

              <div class="text-right shrink-0">
                <div class="flex items-center justify-end gap-1.5 flex-wrap">
                  <span class="font-mono text-xs font-bold text-slate-800 whitespace-nowrap">{formatTime(item.check_in_at)} WIB</span>
                  {#if item.is_unrecognized_device}
                    <span class="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 whitespace-nowrap">Perangkat Asing</span>
                  {/if}
                  {#if item.is_suspicious_location}
                    <span class="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 whitespace-nowrap">Fake GPS?</span>
                  {:else if item.status === 'tepat_waktu'}
                    <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 whitespace-nowrap">Tepat Waktu</span>
                  {:else}
                    <span class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap">+{item.late_minutes}m</span>
                  {/if}
                </div>
                {#if item.check_in_distance_m !== null}
                  <p class="text-[10px] text-slate-400">Jarak {item.check_in_distance_m}m</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Karyawan Paling Sering Terlambat -->
    <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-6">
      <div class="border-b border-slate-100 pb-4">
        <h3 class="text-sm font-bold text-slate-900">Paling Sering Terlambat</h3>
        <p class="text-xs text-slate-500">Statistik bulan berjalan</p>
      </div>

      {#if data.topLateList.length === 0}
        <div class="py-12 text-center text-xs text-slate-400">
          <UserCheck class="mx-auto h-8 w-8 text-emerald-400" />
          <p class="mt-2 font-medium text-emerald-700">Tidak ada keterlambatan bulan ini!</p>
        </div>
      {:else}
        <div class="mt-4 space-y-3">
          {#each data.topLateList as item, index}
            <div class="flex items-center justify-between gap-3 rounded-2xl bg-slate-50/70 p-3 border border-slate-100">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800">
                  {index + 1}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                  <p class="text-[10px] text-slate-400 truncate">{item.nip} · {item.dept}</p>
                </div>
              </div>

              <div class="text-right shrink-0">
                <p class="text-xs font-bold text-amber-700">{item.count}x</p>
                <p class="text-[10px] text-slate-400">{item.totalMinutes} menit</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
