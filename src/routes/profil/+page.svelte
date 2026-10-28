<script>
  import { enhance } from '$app/forms';
  import { User, Phone, MapPin, Briefcase, Building, Mail, Lock, CheckCircle2, AlertCircle } from '@lucide/svelte';

  let { data, form } = $props();

  let loadingBio = $state(false);
  let loadingPass = $state(false);
</script>

<svelte:head>
  <title>Profil & Biodata — Presensi Karyawan</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
  <div>
    <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Profil & Biodata</h1>
    <p class="mt-1 text-xs text-slate-500">Informasi data kepegawaian dan pengaturan akun Anda</p>
  </div>

  <!-- Read-only Kepegawaian Card -->
  <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
    <div class="flex items-center gap-4 border-b border-slate-100 pb-6">
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-xl font-bold text-white shadow-md shadow-emerald-600/20">
        {data.profile?.full_name?.slice(0, 2) || 'US'}
      </div>
      <div>
        <h2 class="text-lg font-bold text-slate-900">{data.profile?.full_name}</h2>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 capitalize">{data.profile?.role}</span>
          <span class="text-xs text-slate-400">NIP: {data.profile?.nip}</span>
        </div>
      </div>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
      <div class="rounded-2xl bg-slate-50/70 p-4 border border-slate-100">
        <span class="text-slate-400">Departemen</span>
        <p class="mt-1 font-semibold text-slate-800">{data.profile?.department?.name || 'Belum diatur'}</p>
      </div>
      <div class="rounded-2xl bg-slate-50/70 p-4 border border-slate-100">
        <span class="text-slate-400">Jabatan / Posisi</span>
        <p class="mt-1 font-semibold text-slate-800">{data.profile?.position || 'Belum diatur'}</p>
      </div>
      <div class="rounded-2xl bg-slate-50/70 p-4 border border-slate-100">
        <span class="text-slate-400">Alamat Email</span>
        <p class="mt-1 font-semibold text-slate-800">{data.profile?.email}</p>
      </div>
      <div class="rounded-2xl bg-slate-50/70 p-4 border border-slate-100">
        <span class="text-slate-400">Tanggal Bergabung</span>
        <p class="mt-1 font-semibold text-slate-800">{data.profile?.join_date || 'Belum diatur'}</p>
      </div>
    </div>
  </div>

  <!-- Form Ubah Biodata (Telepon & Alamat) -->
  <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
    <h3 class="text-sm font-bold text-slate-900">Perbarui Kontak & Alamat</h3>

    {#if form?.successBiodata}
      <div class="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 border border-emerald-200">
        <CheckCircle2 class="h-4 w-4 text-emerald-600" />
        <span>Biodata berhasil diperbarui.</span>
      </div>
    {/if}

    <form
      method="POST"
      action="?/updateBiodata"
      use:enhance={() => {
        loadingBio = true;
        return async ({ update }) => {
          loadingBio = false;
          await update();
        };
      }}
      class="mt-4 space-y-4"
    >
      <div>
        <label for="phone" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">Nomor Telepon / WhatsApp</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={data.profile?.phone || ''}
          placeholder="0812xxxxxxxx"
          class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
        />
      </div>

      <div>
        <label for="address" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">Alamat Tempat Tinggal</label>
        <textarea
          id="address"
          name="address"
          rows="3"
          placeholder="Alamat lengkap domisili"
          class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
        >{data.profile?.address || ''}</textarea>
      </div>

      <button
        type="submit"
        disabled={loadingBio}
        class="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {loadingBio ? 'Menyimpan...' : 'Simpan Kontak'}
      </button>
    </form>
  </div>

  <!-- Form Ubah Kata Sandi -->
  <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
    <h3 class="text-sm font-bold text-slate-900">Ubah Kata Sandi Akun</h3>

    {#if form?.successPassword}
      <div class="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 border border-emerald-200">
        <CheckCircle2 class="h-4 w-4 text-emerald-600" />
        <span>Kata sandi berhasil diperbarui.</span>
      </div>
    {/if}

    {#if form?.errorPassword}
      <div class="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-xs font-semibold text-red-800 border border-red-200">
        <AlertCircle class="h-4 w-4 text-red-600" />
        <span>{form.errorPassword}</span>
      </div>
    {/if}

    <form
      method="POST"
      action="?/updatePassword"
      use:enhance={() => {
        loadingPass = true;
        return async ({ update }) => {
          loadingPass = false;
          await update();
        };
      }}
      class="mt-4 space-y-4"
    >
      <div>
        <label for="password" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">Kata Sandi Baru</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minlength="8"
          placeholder="Minimal 8 karakter"
          class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
        />
      </div>

      <div>
        <label for="confirmPassword" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">Konfirmasi Kata Sandi</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minlength="8"
          placeholder="Ulangi kata sandi baru"
          class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
        />
      </div>

      <button
        type="submit"
        disabled={loadingPass}
        class="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {loadingPass ? 'Menyimpan...' : 'Perbarui Kata Sandi'}
      </button>
    </form>
  </div>
</div>
