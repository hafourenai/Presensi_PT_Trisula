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
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-150">
          <span class="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
          Live Monitoring
        </span>
      </div>
      <h1 class="mt-1.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Dashboard Kehadiran</h1>
      <p class="mt-1 text-xs text-slate-500">
        Pantauan presensi real-time karyawan hari ini ({new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())})
      </p>
    </div>
    <a
      href="/admin/laporan"
      class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
    >
      <span>Lihat Laporan Lengkap</span>
      <ArrowUpRight class="h-4 w-4" />
    </a>
  </div>

  <!-- Metric KPI Cards -->
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    <div class="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-slate-300 transition">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Total Karyawan</span>
        <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Users class="h-3.5 w-3.5" />
        </div>
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{data.totalActiveEmployees}</p>
      <p class="text-[11px] text-slate-500">Aktif di sistem</p>
    </div>

    <div class="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-emerald-200 transition">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Tepat Waktu</span>
        <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <UserCheck class="h-3.5 w-3.5" />
        </div>
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{data.summary.hadirTepatWaktu}</p>
      <p class="text-[11px] text-emerald-700 font-medium">Orang hadir</p>
    </div>

    <div class="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-amber-200 transition">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-amber-800">Terlambat</span>
        <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <Clock class="h-3.5 w-3.5" />
        </div>
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{data.summary.terlambat}</p>
      <p class="text-[11px] text-amber-700 font-medium">Orang</p>
    </div>

    <div class="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-slate-300 transition">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Belum Presensi</span>
        <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Calendar class="h-3.5 w-3.5" />
        </div>
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{data.summary.belumPresensi}</p>
      <p class="text-[11px] text-slate-500">Orang</p>
    </div>

    <div class="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-red-200 transition">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-red-800">Tidak Hadir</span>
        <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-700">
          <UserX class="h-3.5 w-3.5" />
        </div>
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{data.summary.tidakHadir}</p>
      <p class="text-[11px] text-red-700 font-medium">Alpha/Tanpa Keterangan</p>
    </div>

    <div class="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-rose-200 transition">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-rose-800">Perangkat Asing</span>
        <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
          <Smartphone class="h-3.5 w-3.5" />
        </div>
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{data.summary.perangkatTidakDikenal}</p>
      <p class="text-[11px] text-rose-700 font-medium">Presensi Flagged</p>
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
    <div class="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-6 lg:col-span-2">
      <div class="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-bold text-slate-900">Aktivitas Presensi Terbaru Hari Ini</h3>
            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 tabular-nums">{data.recentAttendances.length} tercatat</span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5">10 presensi terakhir yang diverifikasi oleh server</p>
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
            <div class="flex items-center justify-between gap-3 py-3 hover:bg-slate-50/50 rounded-xl px-2 transition">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-xs text-indigo-700 border border-indigo-100">
                  {item.profile?.full_name?.slice(0, 2) || 'KY'}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-bold text-slate-900 truncate">{item.profile?.full_name}</p>
                  <p class="text-[11px] text-slate-500 truncate">{item.profile?.nip} · {item.profile?.department?.name || '-'}</p>
                </div>
              </div>

              <div class="text-right shrink-0">
                <div class="flex items-center justify-end gap-1.5 flex-wrap">
                  <span class="font-mono text-xs font-bold text-slate-800 tabular-nums whitespace-nowrap">{formatTime(item.check_in_at)} WIB</span>
                  {#if item.is_unrecognized_device}
                    <span class="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700 whitespace-nowrap">Perangkat Asing</span>
                  {/if}
                  {#if item.is_suspicious_location}
                    <span class="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700 whitespace-nowrap">Fake GPS?</span>
                  {:else if item.status === 'tepat_waktu'}
                    <span class="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 whitespace-nowrap">Tepat Waktu</span>
                  {:else}
                    <span class="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 whitespace-nowrap">+{item.late_minutes}m</span>
                  {/if}
                </div>
                {#if item.check_in_distance_m !== null}
                  <p class="text-[10px] text-slate-500 mt-0.5 tabular-nums">Jarak {item.check_in_distance_m}m</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Karyawan Paling Sering Terlambat -->
    <div class="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-6">
      <div class="border-b border-slate-100 pb-4">
        <h3 class="text-sm font-bold text-slate-900">Paling Sering Terlambat</h3>
        <p class="text-xs text-slate-500 mt-0.5">Statistik monitoring bulan berjalan</p>
      </div>

      {#if data.topLateList.length === 0}
        <div class="py-12 text-center text-xs text-slate-400">
          <UserCheck class="mx-auto h-8 w-8 text-emerald-400" />
          <p class="mt-2 font-medium text-emerald-800">Tidak ada keterlambatan bulan ini!</p>
        </div>
      {:else}
        <div class="mt-4 space-y-3">
          {#each data.topLateList as item, index}
            <div class="flex items-center justify-between gap-3 rounded-2xl bg-slate-50/70 p-3 border border-slate-200/70 hover:border-slate-300 transition">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800">
                  {index + 1}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                  <p class="text-[10px] text-slate-500 truncate">{item.nip} · {item.dept}</p>
                </div>
              </div>

              <div class="text-right shrink-0">
                <p class="text-xs font-bold text-amber-800 tabular-nums">{item.count}x</p>
                <p class="text-[10px] text-slate-500 tabular-nums">{item.totalMinutes} menit</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
