<script>
  import { enhance } from '$app/forms';
  import {
    ArrowLeft,
    KeyRound,
    UserCheck,
    UserX,
    CheckCircle2,
    Clock,
    XCircle,
    Copy,
    Check,
    History,
    ShieldAlert,
    MapPin,
    Trash2,
    Link2
  } from '@lucide/svelte';

  let { data, form } = $props();

  let copied = $state(false);
  let resetPwdInput = $state('');
  let showDeleteConfirm = $state(false);
  let deleteInputConfirm = $state('');
  let isDeleting = $state(false);

  // Google Maps URL Resolver State
  let mapsUrlInput = $state('');
  let resolvingMaps = $state(false);
  let mapsResolveMsg = $state('');
  let mapsResolveSuccess = $state(false);
  let editWorkLat = $state(data.employee.work_lat ?? '');
  let editWorkLng = $state(data.employee.work_lng ?? '');

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
        editWorkLat = resJson.lat.toString();
        editWorkLng = resJson.lng.toString();
        mapsResolveSuccess = true;
        mapsResolveMsg = `Koordinat berhasil diekstrak: ${resJson.lat}, ${resJson.lng}`;
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

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
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
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }
</script>

<svelte:head>
  <title>Detail Karyawan — {data.employee.full_name}</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
  <div class="flex items-center gap-3">
    <a href="/admin/karyawan" class="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
      <ArrowLeft class="h-4 w-4" />
    </a>
    <div>
      <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{data.employee.full_name}</h1>
      <p class="mt-0.5 text-xs text-slate-500">NIP: {data.employee.nip} · {data.employee.department?.name || 'Tanpa Departemen'}</p>
    </div>
  </div>

  <!-- Info Akun Baru Dibuat (Flash Password) -->
  {#if data.isNewlyCreated && data.initialPwd}
    <div class="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 text-emerald-900 shadow-sm">
      <div class="flex items-center gap-2 font-bold text-sm">
        <CheckCircle2 class="h-5 w-5 text-emerald-600" />
        <span>Akun Karyawan Berhasil Dibuat!</span>
      </div>
      <p class="mt-1 text-xs text-emerald-800">
        Berikan informasi kredensial berikut kepada karyawan. Karyawan akan diminta mengganti kata sandi saat pertama kali login.
      </p>

      <div class="mt-4 flex flex-col gap-2 rounded-2xl bg-white p-4 border border-emerald-100 sm:flex-row sm:items-center sm:justify-between">
        <div class="text-xs">
          <p class="text-slate-500">Username / NIP: <strong class="text-slate-900 font-mono text-sm">{data.employee.nip}</strong></p>
          <p class="text-slate-500 mt-0.5">Kata Sandi Awal: <strong class="text-emerald-700 font-mono text-sm">{data.initialPwd}</strong></p>
        </div>
        <button
          type="button"
          onclick={() => copyToClipboard(`NIP/Username: ${data.employee.nip}\nKata Sandi: ${data.initialPwd}\nLogin di: ${window.location.origin}/login`)}
          class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          {#if copied}
            <Check class="h-4 w-4" />
            <span>Tersalin!</span>
          {:else}
            <Copy class="h-4 w-4" />
            <span>Salin Kredensial</span>
          {/if}
        </button>
      </div>
    </div>
  {/if}

  {#if form?.successReset}
    <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
      Kata sandi berhasil direset menjadi: <strong class="font-mono text-sm text-emerald-900">{form.resetPwd}</strong> (Karyawan wajib ganti saat login berikutnya).
    </div>
  {/if}

  {#if form?.successLocation}
    <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
      Pengaturan lokasi kerja khusus karyawan berhasil diperbarui.
    </div>
  {/if}

  {#if form?.errorReset || form?.errorLocation || form?.errorDelete || form?.error}
    <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
      {form.errorReset || form.errorLocation || form.errorDelete || form.error}
    </div>
  {/if}

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <!-- Profil & Kontrol Akun -->
    <div class="space-y-6 lg:col-span-1">
      <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div class="text-center">
          <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-2xl font-bold text-white shadow-md shadow-emerald-600/20">
            {data.employee.full_name?.slice(0, 2) || 'KY'}
          </div>
          <h3 class="mt-4 font-bold text-slate-900">{data.employee.full_name}</h3>
          <p class="text-xs text-slate-500">{data.employee.position || 'Karyawan'}</p>
          <div class="mt-2 flex justify-center gap-2">
            <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 capitalize">{data.employee.role}</span>
            {#if data.employee.is_active}
              <span class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">Aktif</span>
            {:else}
              <span class="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-700">Nonaktif</span>
            {/if}
          </div>
        </div>

        <div class="mt-6 space-y-3 border-t border-slate-100 pt-4 text-xs">
          <div>
            <span class="text-slate-400">Email:</span>
            <p class="font-semibold text-slate-800 break-all">{data.employee.email}</p>
          </div>
          <div>
            <span class="text-slate-400">Telepon / WhatsApp:</span>
            <p class="font-semibold text-slate-800 break-all">{data.employee.phone || '-'}</p>
          </div>
          <div>
            <span class="text-slate-400">Alamat:</span>
            <p class="font-semibold text-slate-800 break-all">{data.employee.address || '-'}</p>
          </div>
          <div>
            <span class="text-slate-400">Terakhir Login:</span>
            <p class="font-semibold text-slate-800">{data.employee.last_login_at ? new Date(data.employee.last_login_at).toLocaleString('id-ID') : 'Belum pernah login'}</p>
          </div>
        </div>

        <!-- Aksi Aktifkan / Nonaktifkan -->
        <div class="mt-6 border-t border-slate-100 pt-4">
          <form method="POST" action="?/updateStatus">
            <input type="hidden" name="is_active" value={data.employee.is_active ? 'false' : 'true'} />
            <button
              type="submit"
              class="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition {data.employee.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}"
            >
              {#if data.employee.is_active}
                <UserX class="h-4 w-4" />
                <span>Nonaktifkan Akun</span>
              {:else}
                <UserCheck class="h-4 w-4" />
                <span>Aktifkan Akun</span>
              {/if}
            </button>
          </form>
        </div>
      </div>

      <!-- Reset Password Card -->
      <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Reset Kata Sandi Karyawan</h4>
        <p class="mt-1 text-[11px] text-slate-500">
          Buat kata sandi baru. Karyawan akan diwajibkan menggantinya saat login kembali.
        </p>

        <form method="POST" action="?/resetPassword" class="mt-4 space-y-3">
          <input
            name="password"
            type="text"
            required
            minlength="8"
            placeholder="Kata sandi baru (min 8 char)"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-mono text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            class="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Reset Kata Sandi
          </button>
        </form>
      </div>

      <!-- Hapus Akun Permanen (Khusus Administrator) -->
      <div class="rounded-3xl border border-red-200/80 bg-red-50/30 p-6 shadow-xs">
        <h4 class="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
          <Trash2 class="h-4 w-4 text-red-600" />
          <span>Hapus Akun Permanen</span>
        </h4>
        <p class="mt-1 text-[11px] text-red-700 leading-relaxed">
          Menghapus akun karyawan dari database dan Supabase Auth beserta seluruh data riwayat presensi terkait. Tindakan ini tidak dapat dibatalkan.
        </p>

        {#if !showDeleteConfirm}
          <button
            type="button"
            onclick={() => (showDeleteConfirm = true)}
            class="mt-4 w-full rounded-xl border border-red-200 bg-white py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Hapus Akun dari Database
          </button>
        {:else}
          <div class="mt-4 space-y-3 rounded-2xl bg-white p-4 border border-red-200">
            <p class="text-[11px] text-slate-700">
              Ketik <strong class="font-mono text-red-700">{data.employee.nip}</strong> untuk mengonfirmasi penghapusan:
            </p>
            <input
              type="text"
              bind:value={deleteInputConfirm}
              placeholder="Ketik NIP karyawan..."
              class="w-full rounded-xl border border-red-200 px-3 py-2 text-xs font-mono text-slate-900 focus:border-red-500 focus:outline-none"
            />

            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => {
                  showDeleteConfirm = false;
                  deleteInputConfirm = '';
                }}
                class="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <form method="POST" action="?/deleteAccount" class="flex-1" use:enhance={() => {
                isDeleting = true;
                return async ({ update }) => {
                  isDeleting = false;
                  await update();
                };
              }}>
                <button
                  type="submit"
                  disabled={deleteInputConfirm !== data.employee.nip || isDeleting}
                  class="w-full rounded-xl bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  {isDeleting ? 'Menghapus...' : 'Hapus Total'}
                </button>
              </form>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Kolom Kanan: Pengaturan Lokasi & Riwayat Presensi -->
    <div class="space-y-6 lg:col-span-2">
      <!-- Lokasi Kerja Khusus Karyawan -->
      <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div class="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <MapPin class="h-4 w-4 text-emerald-600" />
              <span>Lokasi Penempatan Kerja</span>
            </h3>
            <p class="text-xs text-slate-500">
              Atur koordinat khusus untuk karyawan ini atau kosongkan untuk mengikuti lokasi default kantor
            </p>
          </div>
        </div>

        <form method="POST" action="?/updateLocation" class="mt-4 space-y-4 text-xs">
          <!-- Input Cepat Link Google Maps -->
          <div class="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3 space-y-2">
            <label for="maps_link_edit" class="block text-[11px] font-semibold text-emerald-950 flex items-center gap-1">
              <Link2 class="h-3.5 w-3.5 text-emerald-700" />
              <span>Tempel Link Google Maps (maps.app.goo.gl / google.com/maps)</span>
            </label>
            <div class="flex gap-2">
              <input
                id="maps_link_edit"
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
            <label for="work_location_name" class="block font-semibold uppercase tracking-wider text-slate-700">
              Nama Lokasi / Cabang
            </label>
            <input
              id="work_location_name"
              name="work_location_name"
              type="text"
              value={data.employee.work_location_name || ''}
              placeholder="Contoh: Cabang Surabaya / Proyek Gedung B / Rumah (WFH)"
              class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label for="work_lat" class="block font-semibold uppercase tracking-wider text-slate-700">
                Latitude Khusus
              </label>
              <input
                id="work_lat"
                name="work_lat"
                type="number"
                step="any"
                bind:value={editWorkLat}
                placeholder="-6.200000"
                class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label for="work_lng" class="block font-semibold uppercase tracking-wider text-slate-700">
                Longitude Khusus
              </label>
              <input
                id="work_lng"
                name="work_lng"
                type="number"
                step="any"
                bind:value={editWorkLng}
                placeholder="106.816666"
                class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label for="work_radius_m" class="block font-semibold uppercase tracking-wider text-slate-700">
                Radius Khusus (m)
              </label>
              <input
                id="work_radius_m"
                name="work_radius_m"
                type="number"
                min="10"
                max="50000"
                value={data.employee.work_radius_m ?? ''}
                placeholder="Default: 100"
                class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div class="flex items-center justify-between pt-2">
            <p class="text-[11px] text-slate-400">
              {#if data.employee.work_lat && data.employee.work_lng}
                <span class="text-emerald-600 font-medium">✓ Menggunakan lokasi khusus ({data.employee.work_location_name || 'Khusus'})</span>
              {:else}
                <span>Mengikuti titik koordinat & radius default kantor utama</span>
              {/if}
            </p>
            <button
              type="submit"
              class="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              Simpan Lokasi
            </button>
          </div>
        </form>
      </div>

      <!-- Riwayat Presensi Karyawan -->
      <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div class="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 class="text-sm font-bold text-slate-900">Riwayat Presensi Terbaru</h3>
            <p class="text-xs text-slate-500">10 aktivitas presensi terakhir karyawan ini</p>
          </div>
        </div>

        {#if data.recentAttendances.length === 0}
          <div class="py-12 text-center text-xs text-slate-400">
            <History class="mx-auto h-8 w-8 text-slate-300" />
            <p class="mt-2">Belum ada catatan presensi untuk karyawan ini.</p>
          </div>
        {:else}
          <div class="mt-4 divide-y divide-slate-100 text-xs">
            {#each data.recentAttendances as item}
              <div class="flex items-center justify-between gap-3 py-3">
                <div class="min-w-0 flex-1">
                  <p class="font-bold text-slate-900 truncate">{formatDateIndo(item.work_date)}</p>
                  <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500">
                    <span class="whitespace-nowrap">Masuk: <strong class="text-slate-700">{formatTime(item.check_in_at)}</strong></span>
                    <span class="whitespace-nowrap">Pulang: <strong class="text-slate-700">{formatTime(item.check_out_at)}</strong></span>
                  </div>
                </div>

                <div class="text-right shrink-0">
                  {#if item.status === 'tepat_waktu'}
                    <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 whitespace-nowrap">Tepat Waktu</span>
                  {:else if item.status === 'terlambat'}
                    <span class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap">Terlambat {item.late_minutes}m</span>
                  {:else}
                    <span class="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 whitespace-nowrap">Tidak Hadir</span>
                  {/if}
                  {#if item.check_in_distance_m !== null}
                    <p class="text-[10px] text-slate-400 mt-1 whitespace-nowrap">{item.check_in_distance_m}m dari kantor</p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
