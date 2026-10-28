<script>
  import { enhance } from '$app/forms';
  import { UserPlus, ArrowLeft, ShieldAlert, KeyRound, Sparkles, MapPin, Link2, Check } from '@lucide/svelte';

  let { data, form } = $props();
  let loading = $state(false);
  let generatedPassword = $state('');

  // Google Maps URL Resolver State
  let mapsUrlInput = $state('');
  let resolvingMaps = $state(false);
  let mapsResolveMsg = $state('');
  let mapsResolveSuccess = $state(false);
  let workLatInput = $state('');
  let workLngInput = $state('');

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    generatedPassword = pwd;
  }

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
      const data = await res.json();
      if (data.success) {
        workLatInput = data.lat.toString();
        workLngInput = data.lng.toString();
        mapsResolveSuccess = true;
        mapsResolveMsg = `Koordinat berhasil ditemukan: ${data.lat}, ${data.lng}`;
      } else {
        mapsResolveSuccess = false;
        mapsResolveMsg = data.message || 'Gagal mengekstrak koordinat dari link.';
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
  <title>Tambah Akun Karyawan — Admin Portal</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
  <div class="flex items-center gap-3">
    <a href="/admin/karyawan" class="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
      <ArrowLeft class="h-4 w-4" />
    </a>
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Tambah Karyawan Baru</h1>
      <p class="mt-0.5 text-xs text-slate-500">Buat kredensial akun dan biodata kepegawaian baru</p>
    </div>
  </div>

  <div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-8">
    {#if form?.error}
      <div class="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
        <ShieldAlert class="h-4 w-4 text-red-600 shrink-0" />
        <span>{form.error}</span>
      </div>
    {/if}

    <form
      method="POST"
      use:enhance={() => {
        loading = true;
        return async ({ update }) => {
          loading = false;
          await update();
        };
      }}
      class="space-y-4"
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label for="nip" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            NIP / Username Presensi *
          </label>
          <input
            id="nip"
            name="nip"
            type="text"
            required
            placeholder="Contoh: KRY001"
            class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>

        <div>
          <label for="full_name" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Nama Lengkap *
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            placeholder="Nama lengkap karyawan"
            class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label for="email" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Alamat Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="email@perusahaan.com"
            class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>

        <div>
          <label for="role" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Role Akun *
          </label>
          <select
            id="role"
            name="role"
            class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3 text-xs text-slate-700 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none"
          >
            <option value="karyawan">Karyawan (Presensi)</option>
            <option value="hr">HR</option>
            <option value="administrator">Administrator</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label for="department_id" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Departemen
          </label>
          <select
            id="department_id"
            name="department_id"
            class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3 text-xs text-slate-700 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none"
          >
            <option value="">Pilih Departemen</option>
            {#each data.departments as dept}
              <option value={dept.id}>{dept.name}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="position" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Jabatan / Posisi
          </label>
          <input
            id="position"
            name="position"
            type="text"
            placeholder="Contoh: Staff Operasional"
            class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>
      </div>

      <!-- Lokasi Kerja Khusus (Opsional) -->
      <div class="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin class="h-4 w-4 text-emerald-600" />
              <span>Lokasi Penempatan Kerja Khusus (Opsional)</span>
            </h4>
            <p class="text-[11px] text-slate-500">
              Kosongkan jika karyawan mengikuti lokasi dan radius kantor pusat default.
            </p>
          </div>
        </div>

        <!-- Input Cepat Link Google Maps -->
        <div class="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3 space-y-2">
          <label for="maps_link" class="block text-[11px] font-semibold text-emerald-950 flex items-center gap-1">
            <Link2 class="h-3.5 w-3.5 text-emerald-700" />
            <span>Tempel Link Google Maps (maps.app.goo.gl / google.com/maps)</span>
          </label>
          <div class="flex gap-2">
            <input
              id="maps_link"
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

        <div>
          <label for="work_location_name" class="block text-[11px] font-semibold uppercase tracking-wider text-slate-700">
            Nama Lokasi / Cabang
          </label>
          <input
            id="work_location_name"
            name="work_location_name"
            type="text"
            placeholder="Contoh: Kantor Cabang Surabaya / Proyek A / WFH"
            class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label for="work_lat" class="block text-[11px] font-semibold uppercase tracking-wider text-slate-700">
              Latitude
            </label>
            <input
              id="work_lat"
              name="work_lat"
              type="number"
              step="any"
              bind:value={workLatInput}
              placeholder="-7.257472"
              class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label for="work_lng" class="block text-[11px] font-semibold uppercase tracking-wider text-slate-700">
              Longitude
            </label>
            <input
              id="work_lng"
              name="work_lng"
              type="number"
              step="any"
              bind:value={workLngInput}
              placeholder="112.752090"
              class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label for="work_radius_m" class="block text-[11px] font-semibold uppercase tracking-wider text-slate-700">
              Radius (Meter)
            </label>
            <input
              id="work_radius_m"
              name="work_radius_m"
              type="number"
              min="10"
              max="50000"
              placeholder="Contoh: 100"
              class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label for="password" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Kata Sandi Awal *
          </label>
          <button
            type="button"
            onclick={generateRandomPassword}
            class="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Buat Acak
          </button>
        </div>
        <div class="relative mt-1.5">
          <input
            id="password"
            name="password"
            type="text"
            required
            minlength="8"
            value={generatedPassword}
            placeholder="Minimal 8 karakter"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-900 font-mono hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>
        <p class="mt-1 text-[11px] text-slate-400">
          Karyawan akan menggunakan NIP/Email dan kata sandi ini untuk login pertama kali, lalu otomatis diwajibkan menggantinya.
        </p>
      </div>

      <div class="pt-4">
        <button
          type="submit"
          disabled={loading}
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
        >
          {#if loading}
            <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            <span>Membuat Akun...</span>
          {:else}
            <UserPlus class="h-4 w-4" />
            <span>Simpan & Buat Akun Karyawan</span>
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>
