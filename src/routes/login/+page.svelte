<script>
  import { enhance } from '$app/forms';
  import { Eye, EyeOff, LogIn, ShieldAlert, Sparkles, Building2 } from '@lucide/svelte';

  let { form, data } = $props();

  let showPassword = $state(false);
  let loading = $state(false);
</script>

<svelte:head>
  <title>Masuk — Aplikasi Presensi Karyawan</title>
</svelte:head>

<div class="relative flex min-h-svh flex-col justify-center bg-slate-50 px-4 py-12 selection:bg-emerald-500 selection:text-white sm:px-6 lg:px-8 font-['Plus_Jakarta_Sans',sans-serif]">
  <!-- Subtle decorative background patterns -->
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <div class="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-100/60 blur-3xl"></div>
    <div class="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-teal-100/60 blur-3xl"></div>
  </div>

  <div class="relative mx-auto w-full max-w-md">
    <!-- Brand Header -->
    <div class="text-center">
      <div class="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/20">
        <Building2 class="h-7 w-7" />
      </div>
      <h1 class="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Presensi Karyawan
      </h1>
      <p class="mt-2 text-xs text-slate-600 sm:text-sm">
        Sistem Presensi GPS & Deteksi Wajah Internal Perusahaan
      </p>
    </div>

    <!-- Login Card -->
    <div class="mt-8 rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl sm:p-10">
      {#if data?.errorMessage}
        <div class="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs sm:text-sm text-red-800">
          <ShieldAlert class="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span>{data.errorMessage}</span>
        </div>
      {/if}

      {#if form?.error}
        <div class="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs sm:text-sm text-red-800">
          <ShieldAlert class="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
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
        class="space-y-5"
      >
        <div>
          <label for="identifier" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            NIP / Username / Email
          </label>
          <div class="mt-2">
            <input
              id="identifier"
              name="identifier"
              type="text"
              autocomplete="username"
              required
              value={form?.identifier ?? ''}
              placeholder="Masukkan NIP atau Email"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-xs sm:text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>
          <p class="mt-1 text-[11px] text-slate-400">Gunakan NIP/Username yang diberikan oleh Admin HR.</p>
        </div>

        <div>
          <label for="password" class="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Kata Sandi
          </label>
          <div class="relative mt-2">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autocomplete="current-password"
              required
              placeholder="Masukkan kata sandi"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 pr-12 text-xs sm:text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
            <button
              type="button"
              onclick={() => (showPassword = !showPassword)}
              class="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
              tabindex="-1"
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
            >
              {#if showPassword}
                <EyeOff class="h-5 w-5" />
              {:else}
                <Eye class="h-5 w-5" />
              {/if}
            </button>
          </div>
        </div>

        <div class="pt-2">
          <button
            type="submit"
            disabled={loading}
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-700 hover:to-teal-700 hover:shadow-emerald-600/35 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {#if loading}
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span>Memproses...</span>
            {:else}
              <LogIn class="h-4 w-4" />
              <span>Masuk ke Akun</span>
            {/if}
          </button>
        </div>
      </form>

      <div class="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
        <p>Belum memiliki akun? Hubungi Administrator atau HR untuk pendaftaran akun karyawan.</p>
      </div>
    </div>

    <!-- Security info footer -->
    <div class="mt-8 text-center text-xs text-slate-400">
      <p>Dilindungi dengan Enkripsi SSL/HTTPS & PostgreSQL RLS</p>
      <p class="mt-1">Waktu server terstandarisasi zona WIB (Asia/Jakarta)</p>
    </div>
  </div>
</div>
