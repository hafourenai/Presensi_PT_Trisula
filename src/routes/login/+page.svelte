<script>
  import { onMount } from 'svelte';
  import { enhance } from '$app/forms';
  import {
    Eye,
    EyeOff,
    LogIn,
    ShieldAlert,
    Building2,
    ShieldCheck,
    Smartphone,
    AlertTriangle
  } from '@lucide/svelte';
  import { getBrowserInfo, getOrCreateDeviceId } from '$lib/device.js';

  let { form, data } = $props();

  let showPassword = $state(false);
  let loading = $state(false);
  let identifierInput = $state('');
  let passwordInput = $state('');
  let deviceId = $state('');
  let deviceInfo = $state({ deviceName: '', browser: '', os: '' });
  let acknowledgeMismatch = $state(false);
  let dismissedMismatch = $state(false);

  const isAdminPortal = $derived(data?.portal === 'admin');
  const showMismatchWarning = $derived(Boolean(form?.deviceMismatch) && !dismissedMismatch);

  onMount(() => {
    deviceId = getOrCreateDeviceId();
    deviceInfo = getBrowserInfo();
  });

  $effect(() => {
    if (form?.identifier !== undefined) {
      identifierInput = form.identifier;
    }
    if (form?.deviceMismatch) {
      dismissedMismatch = false;
      acknowledgeMismatch = false;
    }
  });

  function cancelMismatchLogin() {
    dismissedMismatch = true;
    acknowledgeMismatch = false;
    passwordInput = '';
  }
</script>

<svelte:head>
  <title>Masuk — {isAdminPortal ? 'Portal Admin' : 'Aplikasi Presensi Karyawan'}</title>
</svelte:head>

<div class="auth-page relative flex min-h-svh flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">

  <div class="relative mx-auto w-full max-w-md">
    <!-- Brand Header -->
    <div class="text-center">
      <div class="brand-mark mx-auto inline-flex h-14 w-14 items-center justify-center">
        <Building2 class="h-7 w-7" />
      </div>
      <h1 class="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {isAdminPortal ? 'Portal Admin' : 'Presensi Karyawan'}
      </h1>
      <p class="mt-2 text-xs text-slate-600 sm:text-sm">
        {isAdminPortal ? 'Backoffice Administrator dan Admin HR' : 'Sistem Presensi GPS & Deteksi Wajah Internal Perusahaan'}
      </p>
    </div>

    <!-- Login Card -->
    <div class="auth-card mt-8 p-6 sm:p-10">
      {#if data?.errorMessage}
        <div class="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs sm:text-sm text-red-800">
          <ShieldAlert class="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span>{data.errorMessage}</span>
        </div>
      {/if}

      {#if showMismatchWarning}
        <div class="mb-6 space-y-3 rounded-2xl border-2 border-rose-300 bg-rose-50/90 p-4 text-xs text-rose-950">
          <div class="flex items-start gap-2.5">
            <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <h2 class="text-sm font-bold text-rose-900">Peringatan: Perangkat Berbeda Terdeteksi!</h2>
              <p class="mt-1 leading-relaxed text-rose-800">
                Akun ini sudah terdaftar pada perangkat utama lain. Pastikan Anda menggunakan perangkat pribadi yang terdaftar.
              </p>
            </div>
          </div>

          <div class="space-y-1.5 rounded-xl border border-rose-200 bg-white/80 p-3 text-[11px] text-slate-700">
            <div class="flex items-center justify-between gap-2">
              <span class="text-slate-500">Perangkat Utama:</span>
              <strong class="text-right text-slate-900">{form.primaryDeviceName}</strong>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-slate-500">Perangkat Saat Ini:</span>
              <strong class="text-right text-rose-700">{form.currentDeviceName || deviceInfo.deviceName || 'Perangkat Ini'}</strong>
            </div>
          </div>

          <p class="text-[11px] leading-relaxed text-rose-800">
            Jika Anda tetap masuk dari perangkat ini, aktivitas Anda akan ditandai sebagai <strong>Perangkat Asing</strong> dan <strong>dilaporkan otomatis ke HR/Administrator</strong>. Jika Anda mengganti HP/perangkat, hubungi HR untuk mereset perangkat utama Anda.
          </p>

          <label class="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-100/60 p-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={acknowledgeMismatch}
              class="mt-0.5 h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
            />
            <span class="text-[11px] font-medium leading-snug text-rose-950">
              Saya memahami bahwa perangkat ini berbeda dari Perangkat Utama saya dan aktivitas login ini akan dicatat serta dilaporkan ke HR.
            </span>
          </label>
        </div>
      {:else if form?.error}
        <div class="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs sm:text-sm text-red-800">
          <ShieldAlert class="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span>{form.error}</span>
        </div>
      {/if}

      <form
        method="POST"
        use:enhance={({ formData }) => {
          const currentId = deviceId || getOrCreateDeviceId();
          const currentInfo = deviceInfo.deviceName ? deviceInfo : getBrowserInfo();
          formData.set('device_id', currentId);
          formData.set('device_name', currentInfo.deviceName || 'Perangkat Web');
          formData.set('browser', currentInfo.browser || 'Unknown');
          formData.set('os', currentInfo.os || 'Unknown');
          formData.set(
            'confirm_unrecognized_device',
            showMismatchWarning && acknowledgeMismatch ? 'true' : 'false'
          );

          loading = true;
          return async ({ update }) => {
            loading = false;
            await update({ reset: false });
          };
        }}
        class="space-y-5"
      >
        <input type="hidden" name="device_id" value={deviceId} />
        <input type="hidden" name="device_name" value={deviceInfo.deviceName} />
        <input type="hidden" name="browser" value={deviceInfo.browser} />
        <input type="hidden" name="os" value={deviceInfo.os} />
        <input
          type="hidden"
          name="confirm_unrecognized_device"
          value={showMismatchWarning && acknowledgeMismatch ? 'true' : 'false'}
        />

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
              bind:value={identifierInput}
              oninput={() => {
                if (showMismatchWarning) {
                  dismissedMismatch = true;
                  acknowledgeMismatch = false;
                }
              }}
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
              bind:value={passwordInput}
              placeholder="Masukkan kata sandi"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 pr-12 text-xs sm:text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
            />
            <button
              type="button"
              onclick={() => (showPassword = !showPassword)}
              class="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
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

        {#if !isAdminPortal && deviceInfo.deviceName}
          <div class="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 text-[11px] text-slate-600">
            <Smartphone class="h-4 w-4 shrink-0 text-slate-400" />
            <span class="truncate">Perangkat ini: <strong class="text-slate-800">{deviceInfo.deviceName}</strong></span>
          </div>
        {/if}

        <div class="pt-2 space-y-2.5">
          {#if showMismatchWarning}
            <button
              type="submit"
              disabled={loading || !acknowledgeMismatch || !passwordInput}
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {#if loading}
                <div class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Memproses...</span>
              {:else}
                <ShieldAlert class="h-4 w-4" />
                <span>Tetap Masuk dengan Perangkat Ini</span>
              {/if}
            </button>
            <button
              type="button"
              onclick={cancelMismatchLogin}
              disabled={loading}
              class="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Batal, Gunakan Perangkat Utama
            </button>
          {:else}
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
          {/if}
        </div>
      </form>

      <div class="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
        <p>Belum memiliki akun? Hubungi Administrator atau HR untuk pendaftaran akun karyawan.</p>
      </div>
    </div>

    <!-- Security & Corporate Footer -->
    <div class="mt-8 text-center text-xs text-slate-500 space-y-1">
      <div class="flex items-center justify-center gap-1.5 font-medium text-slate-600">
        <ShieldCheck class="h-3.5 w-3.5 text-emerald-600" />
        <span>Koneksi Aman & Data Kepegawaian Terenkripsi</span>
      </div>
      <p class="text-[11px] text-slate-400">
        © 2026 PT Trisula Prima Agung · Sinkronisasi Waktu Server Resmi (WIB)
      </p>
    </div>
  </div>
</div>
