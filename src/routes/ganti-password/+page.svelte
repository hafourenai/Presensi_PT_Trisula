<script>
  import { enhance } from '$app/forms';
  import { ShieldCheck, Lock, Eye, EyeOff, CheckCircle2, FileText, AlertCircle } from '@lucide/svelte';

  let { form, data } = $props();

  let showPassword = $state(false);
  let showConfirm = $state(false);
  let loading = $state(false);
</script>

<svelte:head>
  <title>Aktivasi Akun & Ganti Kata Sandi — Presensi</title>
</svelte:head>

<div class="relative flex min-h-svh flex-col justify-center bg-slate-50 px-4 py-12 selection:bg-emerald-500 selection:text-white sm:px-6 lg:px-8">
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <div class="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-100/60 blur-3xl"></div>
    <div class="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-teal-100/60 blur-3xl"></div>
  </div>

  <div class="relative mx-auto w-full max-w-lg">
    <!-- Header -->
    <div class="text-center">
      <div class="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/20">
        <ShieldCheck class="h-7 w-7" />
      </div>
      <h1 class="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Aktivasi Akun & Kata Sandi
      </h1>
      <p class="mt-2 text-sm text-slate-600">
        Demi keamanan akun, silakan perbarui kata sandi awal dan setujui ketentuan presensi.
      </p>
    </div>

    <!-- Main Card -->
    <div class="mt-8 rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl sm:p-10">
      {#if form?.error}
        <div class="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-800">
          <AlertCircle class="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span>{form.error}</span>
        </div>
      {/if}

      <div class="mb-6 rounded-2xl bg-emerald-50/60 p-4 text-xs text-emerald-900 border border-emerald-100">
        <div class="flex items-center gap-2 font-semibold">
          <CheckCircle2 class="h-4 w-4 text-emerald-600" />
          <span>Akun Terverifikasi</span>
        </div>
        <p class="mt-1 text-emerald-800/80">
          Halo, <strong>{data.profile.full_name}</strong> ({data.profile.nip}). Silakan lengkapi langkah di bawah untuk melanjutkan ke sistem presensi.
        </p>
      </div>

      <form
        method="POST"
        use:enhance={() => {
          loading = true;
          return async ({ update }) => {
            loading = false;
            await update();
          };
        }}
        class="space-y-6"
      >
        {#if data.mustChange}
          <div class="space-y-4">
            <div>
              <label for="newPassword" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Kata Sandi Baru
              </label>
              <div class="relative mt-2">
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minlength="8"
                  placeholder="Minimal 8 karakter"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 pr-12 text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                />
                <button
                  type="button"
                  onclick={() => (showPassword = !showPassword)}
                  class="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 hover:text-slate-600"
                  tabindex="-1"
                >
                  {#if showPassword}
                    <EyeOff class="h-5 w-5" />
                  {:else}
                    <Eye class="h-5 w-5" />
                  {/if}
                </button>
              </div>
            </div>

            <div>
              <label for="confirmPassword" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Konfirmasi Kata Sandi Baru
              </label>
              <div class="relative mt-2">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minlength="8"
                  placeholder="Ketik ulang kata sandi baru"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 pr-12 text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                />
                <button
                  type="button"
                  onclick={() => (showConfirm = !showConfirm)}
                  class="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 hover:text-slate-600"
                  tabindex="-1"
                >
                  {#if showConfirm}
                    <EyeOff class="h-5 w-5" />
                  {:else}
                    <Eye class="h-5 w-5" />
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/if}

        {#if data.needConsent}
          <!-- UU PDP Consent Box -->
          <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <FileText class="h-4 w-4 text-emerald-600" />
              <span>Persetujuan Pemrosesan Data (UU PDP)</span>
            </div>
            <p class="mt-2 text-xs leading-relaxed text-slate-600">
              Sesuai ketentuan UU Pelindungan Data Pribadi, aplikasi presensi ini akan memproses <strong>foto selfie wajah secara langsung</strong> dan <strong>titik koordinat lokasi GPS</strong> perangkat Anda secara eksklusif untuk tujuan verifikasi kehadiran kerja internal perusahaan. Foto dan lokasi tersimpan secara aman dan terenkripsi.
            </p>
            <div class="mt-4 flex items-start gap-3">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                required
                class="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label for="consent" class="text-xs font-medium text-slate-700">
                Saya memahami dan menyetujui pengumpulan serta pemrosesan data foto dan koordinat GPS untuk keperluan presensi kehadiran kerja.
              </label>
            </div>
          </div>
        {/if}

        <div class="pt-2">
          <button
            type="submit"
            disabled={loading}
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-700 hover:to-teal-700 hover:shadow-emerald-600/35 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {#if loading}
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span>Menyimpan...</span>
            {:else}
              <Lock class="h-4 w-4" />
              <span>Simpan & Lanjutkan</span>
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
