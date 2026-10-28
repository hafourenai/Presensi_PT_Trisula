<script>
  import { enhance } from '$app/forms';
  import { Settings, MapPin, Clock, Calendar, CheckCircle2, AlertCircle, Plus, Link2 } from '@lucide/svelte';

  let { data, form } = $props();
  let loadingSettings = $state(false);
  let loadingHoliday = $state(false);

  // Google Maps URL Resolver State
  let mapsUrlInput = $state('');
  let resolvingMaps = $state(false);
  let mapsResolveMsg = $state('');
  let mapsResolveSuccess = $state(false);
  let officeLatInput = $state(data.settings?.office_lat ?? '');
  let officeLngInput = $state(data.settings?.office_lng ?? '');

  async function resolveMapsLink() {
    if (!mapsUrlInput.trim()) return;
    resolvingMaps = true;
    mapsResolveMsg = '';
    mapsResolveSuccess = false;

    try {
      const res = await fetch('/api/resolve-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: mapsUrlInput.trim() })
      });
      const resJson = await res.json();
      if (resJson.success) {
        officeLatInput = resJson.lat.toString();
        officeLngInput = resJson.lng.toString();
        mapsResolveSuccess = true;
        mapsResolveMsg = `Koordinat kantor berhasil diekstrak: ${resJson.lat}, ${resJson.lng}`;
      } else {
        mapsResolveSuccess = false;
        mapsResolveMsg = resJson.message || 'Gagal mengekstrak koordinat dari link.';
      }
    } catch (err) {
      mapsResolveSuccess = false;
      mapsResolveMsg = 'Koneksi gagal saat menghubungi server.';
    } finally {
      resolvingMaps = false;
    }
  }
</script>

<svelte:head>
  <title>Pengaturan Sistem & Lokasi — Super Admin</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Pengaturan Jam & Lokasi Kantor</h1>
    <p class="mt-1 text-xs text-slate-500">
      Konfigurasi parameter presensi, toleransi keterlambatan, titik koordinat GPS kantor, dan kalender libur
    </p>
  </div>

  {#if form?.successSettings}
    <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
      Pengaturan sistem berhasil disimpan.
    </div>
  {/if}

  {#if form?.error}
    <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
      {form.error}
    </div>
  {/if}

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <!-- Form Pengaturan Jam & GPS -->
    <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-8 lg:col-span-2">
      <h3 class="text-sm font-bold text-slate-900">Aturan Jam Kerja & Radius Presensi</h3>

      <form
        method="POST"
        action="?/updateSettings"
        use:enhance={() => {
          loadingSettings = true;
          return async ({ update }) => {
            loadingSettings = false;
            await update();
          };
        }}
        class="mt-6 space-y-4 text-xs"
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label for="work_start" class="block font-semibold uppercase tracking-wider text-slate-700">Jam Masuk (WIB)</label>
            <input
              id="work_start"
              type="time"
              name="work_start"
              value={data.settings?.work_start || '08:00'}
              required
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label for="work_end" class="block font-semibold uppercase tracking-wider text-slate-700">Jam Pulang (WIB)</label>
            <input
              id="work_end"
              type="time"
              name="work_end"
              value={data.settings?.work_end || '16:00'}
              required
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 focus:outline-none"
            />
          </div>

          <div class="sm:col-span-2 lg:col-span-1">
            <label for="late_tolerance_min" class="block font-semibold uppercase tracking-wider text-slate-700">Toleransi Terlambat (Menit)</label>
            <input
              id="late_tolerance_min"
              type="number"
              name="late_tolerance_min"
              value={data.settings?.late_tolerance_min || 0}
              min="0"
              max="480"
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        <!-- Input Cepat Link Google Maps Kantor -->
        <div class="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-3.5 space-y-2">
          <label for="maps_office_link" class="block text-[11px] font-semibold text-emerald-950 flex items-center gap-1">
            <Link2 class="h-3.5 w-3.5 text-emerald-700" />
            <span>Tempel Link Google Maps Kantor Utama (maps.app.goo.gl / google.com/maps)</span>
          </label>
          <div class="flex gap-2">
            <input
              id="maps_office_link"
              type="text"
              bind:value={mapsUrlInput}
              placeholder="Contoh: https://maps.app.goo.gl/3YJ3u9xY9ofUjGKU6"
              class="flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onclick={resolveMapsLink}
              disabled={resolvingMaps || !mapsUrlInput.trim()}
              class="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 whitespace-nowrap"
            >
              {resolvingMaps ? 'Mengambil...' : 'Ambil Koordinat'}
            </button>
          </div>
          {#if mapsResolveMsg}
            <p class="text-[11px] font-medium {mapsResolveSuccess ? 'text-emerald-700' : 'text-red-600'}">
              {mapsResolveMsg}
            </p>
          {/if}
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 border-t border-slate-100 pt-4">
          <div>
            <label for="office_lat" class="block font-semibold uppercase tracking-wider text-slate-700">Latitude Kantor</label>
            <input
              id="office_lat"
              type="number"
              step="any"
              name="office_lat"
              bind:value={officeLatInput}
              placeholder="-6.200000"
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label for="office_lng" class="block font-semibold uppercase tracking-wider text-slate-700">Longitude Kantor</label>
            <input
              id="office_lng"
              type="number"
              step="any"
              name="office_lng"
              bind:value={officeLngInput}
              placeholder="106.816666"
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 focus:outline-none"
            />
          </div>

          <div class="sm:col-span-2 lg:col-span-1">
            <label for="office_radius_m" class="block font-semibold uppercase tracking-wider text-slate-700">Radius Kantor (Meter)</label>
            <input
              id="office_radius_m"
              type="number"
              name="office_radius_m"
              value={data.settings?.office_radius_m || 100}
              min="10"
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        <div class="border-t border-slate-100 pt-4">
          <label for="photo_retention_days" class="block font-semibold uppercase tracking-wider text-slate-700">Kebijakan Retensi Foto (Hari)</label>
          <input
            id="photo_retention_days"
            type="number"
            name="photo_retention_days"
            value={data.settings?.photo_retention_days || 30}
            min="1"
            max="365"
            class="mt-1.5 w-full max-w-xs rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 focus:outline-none"
          />
          <p class="mt-1 text-[11px] text-slate-400">Foto selfie presensi yang lebih lama dari jumlah hari ini akan otomatis dibersihkan oleh cron.</p>
        </div>

        <div class="pt-2">
          <button
            type="submit"
            disabled={loadingSettings}
            class="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loadingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>
    </div>

    <!-- Daftar Hari Libur -->
    <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
      <h3 class="text-sm font-bold text-slate-900">Daftar Hari Libur</h3>
      <p class="mt-1 text-xs text-slate-500">Hari libur tidak akan memicu status "Tidak Hadir" otomatis</p>

      <form
        method="POST"
        action="?/addHoliday"
        use:enhance={() => {
          loadingHoliday = true;
          return async ({ update }) => {
            loadingHoliday = false;
            await update();
          };
        }}
        class="mt-4 space-y-3 text-xs"
      >
        <input
          type="date"
          name="holiday_date"
          required
          class="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-slate-900 focus:outline-none"
        />
        <input
          type="text"
          name="name"
          required
          placeholder="Nama Hari Libur / Cuti Bersama"
          class="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-slate-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loadingHoliday}
          class="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-700"
        >
          <Plus class="h-4 w-4" />
          <span>Tambah Hari Libur</span>
        </button>
      </form>

      <div class="mt-6 divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
        {#if data.holidays.length === 0}
          <p class="py-4 text-center text-slate-400">Belum ada hari libur terdaftar.</p>
        {:else}
          {#each data.holidays as h}
            <div class="py-2.5 flex items-center justify-between">
              <div>
                <p class="font-bold text-slate-900">{h.name}</p>
                <p class="text-[11px] text-slate-400">{h.holiday_date}</p>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>
