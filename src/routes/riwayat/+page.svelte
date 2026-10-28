<script>
  import {
    Calendar,
    CheckCircle2,
    Clock,
    XCircle,
    MapPin,
    Image,
    X,
    ChevronLeft,
    ChevronRight,
    Search
  } from '@lucide/svelte';

  let { data } = $props();

  let selectedPhotoUrl = $state('');
  let modalTitle = $state('');
  let photoModalOpen = $state(false);
  let photoLoading = $state(false);

  async function openPhoto(path, title) {
    if (!path) return;
    photoLoading = true;
    modalTitle = title;
    photoModalOpen = true;
    try {
      const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
      const json = await res.json();
      if (json.success) {
        selectedPhotoUrl = json.url;
      }
    } catch (e) {
      console.error(e);
    } finally {
      photoLoading = false;
    }
  }

  function formatTime(isoString) {
    if (!isoString) return '--:--';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(isoString));
  }

  function formatDateIndo(dateStr) {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }
</script>

<svelte:head>
  <title>Riwayat Presensi — Presensi Karyawan</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
  <!-- Header & Month Filter -->
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Riwayat Presensi</h1>
      <p class="mt-1 text-xs text-slate-500">Laporan catatan kehadiran dan foto presensi pribadi Anda</p>
    </div>

    <!-- Filter Bulan -->
    <form method="GET" class="flex items-center gap-2">
      <input
        type="month"
        name="bulan"
        value={data.monthParam}
        onchange={(e) => e.target.form.submit()}
        class="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
      />
    </form>
  </div>

  <!-- Summary Cards -->
  <div class="grid grid-cols-3 gap-3 sm:gap-4">
    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Tepat Waktu</span>
        <CheckCircle2 class="h-4 w-4 text-emerald-600" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900">{data.summary.totalHadir}</p>
      <p class="text-[11px] text-slate-400">Hari</p>
    </div>

    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-amber-700">Terlambat</span>
        <Clock class="h-4 w-4 text-amber-600" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900">{data.summary.totalTerlambat}</p>
      <p class="text-[11px] text-slate-400">Hari</p>
    </div>

    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div class="flex items-center justify-between text-slate-500">
        <span class="text-[11px] font-bold uppercase tracking-wider text-red-700">Tidak Hadir</span>
        <XCircle class="h-4 w-4 text-red-600" />
      </div>
      <p class="mt-2 text-2xl font-bold text-slate-900">{data.summary.totalTidakHadir}</p>
      <p class="text-[11px] text-slate-400">Hari</p>
    </div>
  </div>

  <!-- Records List -->
  <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-6">
    <h3 class="text-sm font-bold text-slate-900">Daftar Presensi ({data.records.length} Catatan)</h3>

    {#if data.records.length === 0}
      <div class="py-12 text-center text-xs text-slate-400">
        <Calendar class="mx-auto h-8 w-8 text-slate-300" />
        <p class="mt-2">Belum ada catatan presensi pada bulan ini.</p>
      </div>
    {:else}
      <div class="mt-4 divide-y divide-slate-100">
        {#each data.records as item}
          <div class="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-slate-900">{formatDateIndo(item.work_date)}</span>
                {#if item.status === 'tepat_waktu'}
                  <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Tepat Waktu</span>
                {:else if item.status === 'terlambat'}
                  <span class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Terlambat {item.late_minutes}m</span>
                {:else}
                  <span class="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Tidak Hadir</span>
                {/if}
              </div>

              <div class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <div>
                  <span class="text-slate-400">Masuk:</span>
                  <strong class="text-slate-700">{formatTime(item.check_in_at)}</strong>
                  {#if item.check_in_distance_m !== null}
                    <span class="text-[11px] text-slate-400">({item.check_in_distance_m}m)</span>
                  {/if}
                </div>
                <div>
                  <span class="text-slate-400">Pulang:</span>
                  <strong class="text-slate-700">{formatTime(item.check_out_at)}</strong>
                  {#if item.check_out_distance_m !== null}
                    <span class="text-[11px] text-slate-400">({item.check_out_distance_m}m)</span>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Foto Preview Thumbnails -->
            <div class="flex items-center gap-2">
              {#if item.check_in_photo}
                <button
                  onclick={() => openPhoto(item.check_in_photo, `Foto Masuk - ${formatDateIndo(item.work_date)}`)}
                  class="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Image class="h-3.5 w-3.5 text-emerald-600" />
                  <span>Foto Masuk</span>
                </button>
              {/if}

              {#if item.check_out_photo}
                <button
                  onclick={() => openPhoto(item.check_out_photo, `Foto Pulang - ${formatDateIndo(item.work_date)}`)}
                  class="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Image class="h-3.5 w-3.5 text-blue-600" />
                  <span>Foto Pulang</span>
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Modal Foto Popup -->
{#if photoModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
    <div class="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100">
        <h4 class="text-xs font-bold text-slate-900">{modalTitle}</h4>
        <button
          onclick={() => { photoModalOpen = false; selectedPhotoUrl = ''; }}
          class="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <div class="mt-4 flex min-h-64 items-center justify-center rounded-2xl bg-slate-100 overflow-hidden">
        {#if photoLoading}
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"></div>
        {:else if selectedPhotoUrl}
          <img src={selectedPhotoUrl} alt="Foto Presensi" class="w-full object-cover" />
        {:else}
          <p class="text-xs text-slate-400">Foto tidak dapat dimuat.</p>
        {/if}
      </div>
    </div>
  </div>
{/if}
