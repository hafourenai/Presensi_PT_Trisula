<script>
  import { onMount } from 'svelte';
  import { enhance } from '$app/forms';
  import {
    ShieldCheck,
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    FileText,
    AlertCircle,
    Smartphone,
    ShieldAlert,
    AlertTriangle,
    LogOut
  } from '@lucide/svelte';
  import { getBrowserInfo, getOrCreateDeviceId } from '$lib/device.js';

  let { form, data } = $props();

  let formEl = $state(null);
  let showPassword = $state(false);
  let showConfirm = $state(false);
  let loading = $state(false);
  let newPasswordInput = $state('');
  let confirmPasswordInput = $state('');
  let confirmDeviceChecked = $state(false);
  let clientError = $state('');
  let showDeviceConfirmModal = $state(false);
  let deviceModalConfirmed = $state(false);

  let deviceId = $state('');
  let deviceInfo = $state({ deviceName: '', browser: '', os: '' });

  const isDifferentFromRegistered = $derived(
    Boolean(data.isKaryawan && data.primaryDevice && deviceId && data.primaryDevice.device_id !== deviceId)
  );

  const pageHeading = $derived.by(() => {
    if (data.mustChange && data.needDeviceRegistration) {
      return 'Aktivasi Akun, Kata Sandi & Perangkat';
    }
    if (!data.mustChange && data.needDeviceRegistration) {
      return 'Pendaftaran Perangkat Utama';
    }
    return 'Aktivasi Akun & Kata Sandi';
  });

  const pageSubtitle = $derived.by(() => {
    if (data.mustChange && data.needDeviceRegistration) {
      return 'Perbarui kata sandi default dari Admin dan pastikan perangkat ini adalah perangkat pribadi Anda sebelum mendaftar.';
    }
    if (!data.mustChange && data.needDeviceRegistration) {
      return 'Perangkat utama akun Anda belum terdaftar. Konfirmasi perangkat pribadi yang akan Anda gunakan untuk presensi.';
    }
    return 'Demi keamanan akun, silakan perbarui kata sandi awal dan setujui ketentuan presensi.';
  });

  onMount(() => {
    deviceId = getOrCreateDeviceId();
    deviceInfo = getBrowserInfo();
  });

  function handlePrimaryActionClick(event) {
    clientError = '';

    if (!data.needDeviceRegistration) {
      return;
    }

    if (deviceModalConfirmed) {
      return;
    }

    event.preventDefault();

    if (formEl && !formEl.reportValidity()) {
      return;
    }

    if (data.mustChange) {
      if (newPasswordInput.length < 8) {
        clientError = 'Kata sandi baru minimal 8 karakter.';
        return;
      }
      if (newPasswordInput !== confirmPasswordInput) {
        clientError = 'Konfirmasi kata sandi tidak cocok.';
        return;
      }
    }

    if (!confirmDeviceChecked) {
      clientError = 'Silakan centang persetujuan pendaftaran perangkat utama terlebih dahulu.';
      return;
    }

    showDeviceConfirmModal = true;
  }

  function confirmAndSubmitDevice() {
    deviceModalConfirmed = true;
    showDeviceConfirmModal = false;
    if (formEl) {
      formEl.requestSubmit();
    }
  }
</script>

<svelte:head>
  <title>{pageHeading} — Presensi</title>
</svelte:head>

<div class="auth-page relative flex min-h-svh flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">

  <div class="relative mx-auto w-full max-w-lg">
    <!-- Header -->
    <div class="text-center">
      <div class="brand-mark mx-auto inline-flex h-14 w-14 items-center justify-center">
        <ShieldCheck class="h-7 w-7" />
      </div>
      <h1 class="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {pageHeading}
      </h1>
      <p class="mt-2 text-sm text-slate-600">
        {pageSubtitle}
      </p>
    </div>

    <!-- Main Card -->
    <div class="auth-card mt-8 p-6 sm:p-10">
      {#if clientError || form?.error}
        <div class="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-800">
          <AlertCircle class="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span>{clientError || form.error}</span>
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

      {#if isDifferentFromRegistered}
        <div class="mb-6 rounded-2xl border-2 border-rose-300 bg-rose-50/90 p-4 text-xs text-rose-950 space-y-2">
          <div class="flex items-start gap-2.5">
            <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <h2 class="font-bold text-rose-900">Peringatan: Perangkat Berbeda Terdeteksi</h2>
              <p class="mt-1 leading-relaxed text-rose-800">
                Akun Anda sudah terdaftar pada perangkat utama <strong>{data.primaryDevice.device_name}</strong>, sedangkan saat ini Anda membuka dari <strong>{deviceInfo.deviceName || 'perangkat lain'}</strong>.
              </p>
            </div>
          </div>
          <p class="text-[11px] text-rose-800">
            Penggantian kata sandi tidak mengubah perangkat utama Anda. Aktivitas dari perangkat berbeda tetap dicatat dan dilaporkan ke HR.
          </p>
        </div>
      {:else if data.isKaryawan && data.primaryDevice}
        <div class="mb-6 flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs text-emerald-900">
          <div class="flex items-center gap-2 min-w-0">
            <Smartphone class="h-4 w-4 shrink-0 text-emerald-600" />
            <span class="truncate">Perangkat Utama Terverifikasi: <strong>{data.primaryDevice.device_name}</strong></span>
          </div>
        </div>
      {/if}

      <form
        bind:this={formEl}
        method="POST"
        use:enhance={({ formData }) => {
          const currentId = deviceId || getOrCreateDeviceId();
          const currentInfo = deviceInfo.deviceName ? deviceInfo : getBrowserInfo();
          formData.set('device_id', currentId);
          formData.set('device_name', currentInfo.deviceName || 'Perangkat Utama');
          formData.set('browser', currentInfo.browser || 'Unknown');
          formData.set('os', currentInfo.os || 'Unknown');

          loading = true;
          return async ({ update }) => {
            loading = false;
            deviceModalConfirmed = false;
            await update();
          };
        }}
        class="space-y-6"
      >
        <input type="hidden" name="device_id" value={deviceId} />
        <input type="hidden" name="device_name" value={deviceInfo.deviceName} />
        <input type="hidden" name="browser" value={deviceInfo.browser} />
        <input type="hidden" name="os" value={deviceInfo.os} />

        {#if data.mustChange}
          <div class="space-y-4">
            <div class="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-600">
              Anda masih menggunakan <strong>kata sandi default dari Admin</strong>. Buat kata sandi pribadi baru sebelum menggunakan akun.
            </div>

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
                  bind:value={newPasswordInput}
                  placeholder="Minimal 8 karakter"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 pr-12 text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                />
                <button
                  type="button"
                  onclick={() => (showPassword = !showPassword)}
                  class="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Sembunyikan kata sandi baru' : 'Lihat kata sandi baru'}
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
                  bind:value={confirmPasswordInput}
                  placeholder="Ketik ulang kata sandi baru"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 pr-12 text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                />
                <button
                  type="button"
                  onclick={() => (showConfirm = !showConfirm)}
                  class="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 hover:text-slate-600"
                  aria-label={showConfirm ? 'Sembunyikan konfirmasi kata sandi' : 'Lihat konfirmasi kata sandi'}
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

        {#if data.needDeviceRegistration}
          <!-- Konfirmasi Pendaftaran Perangkat Utama -->
          <div class="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4 space-y-3">
            <div class="flex items-start gap-2.5">
              <ShieldAlert class="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h2 class="text-xs font-bold uppercase tracking-wider text-amber-950">
                  Ingin Mendaftar dengan Perangkat Ini?
                </h2>
                <p class="mt-1 text-xs leading-relaxed text-amber-900">
                  <strong>Jangan asal registrasi akun!</strong> Perangkat yang Anda gunakan sekarang akan didaftarkan sebagai <strong>Perangkat Utama</strong> akun presensi Anda.
                </p>
              </div>
            </div>

            <div class="rounded-xl border border-amber-200 bg-white/90 p-3 text-xs space-y-1">
              <div class="flex items-center gap-2 font-semibold text-slate-900">
                <Smartphone class="h-4 w-4 text-amber-700 shrink-0" />
                <span>{deviceInfo.deviceName || 'Mendeteksi perangkat...'}</span>
              </div>
              <p class="text-[11px] text-slate-500 pl-6">
                Browser: <strong class="text-slate-700">{deviceInfo.browser || '-'}</strong> · Sistem: <strong class="text-slate-700">{deviceInfo.os || '-'}</strong>
              </p>
            </div>

            <p class="text-[11px] leading-relaxed text-amber-900/90">
              Jika Anda login atau melakukan presensi dari perangkat lain di kemudian hari, sistem akan menampilkan peringatan dan melaporkan otomatis ke HR. Apabila ini <strong>bukan HP/perangkat pribadi Anda</strong>, klik <strong>Batal & Keluar</strong> di bawah lalu login ulang dari perangkat Anda sendiri.
            </p>

            <div class="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-100/60 p-3">
              <input
                id="confirm_device"
                name="confirm_device"
                type="checkbox"
                required
                bind:checked={confirmDeviceChecked}
                class="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-700 focus:ring-amber-600"
              />
              <label for="confirm_device" class="text-xs font-semibold leading-snug text-amber-950 cursor-pointer">
                Ya, saya yakin ingin mendaftar dengan perangkat ini sebagai Perangkat Utama saya.
              </label>
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
              <label for="consent" class="text-xs font-medium text-slate-700 cursor-pointer">
                Saya memahami dan menyetujui pengumpulan serta pemrosesan data foto dan koordinat GPS untuk keperluan presensi kehadiran kerja.
              </label>
            </div>
          </div>
        {/if}

        <div class="pt-2">
          <button
            type="submit"
            disabled={loading}
            onclick={handlePrimaryActionClick}
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-700 hover:to-teal-700 hover:shadow-emerald-600/35 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {#if loading}
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span>Menyimpan...</span>
            {:else if data.needDeviceRegistration}
              <Smartphone class="h-4 w-4" />
              <span>{data.mustChange ? 'Simpan & Daftarkan Perangkat Ini' : 'Daftarkan Perangkat Ini'}</span>
            {:else}
              <Lock class="h-4 w-4" />
              <span>Simpan & Lanjutkan</span>
            {/if}
          </button>
        </div>
      </form>

      {#if data.needDeviceRegistration || data.mustChange}
        <div class="mt-5 border-t border-slate-100 pt-5">
          <form method="POST" action="/auth/logout">
            <button
              type="submit"
              class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut class="h-4 w-4" />
              <span>Batal & Keluar (Ganti Perangkat)</span>
            </button>
          </form>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Modal Konfirmasi Akhir Pendaftaran Perangkat -->
{#if showDeviceConfirmModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
    role="dialog"
    aria-modal="true"
    aria-labelledby="device-confirm-title"
  >
    <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
      <div class="flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <Smartphone class="h-6 w-6" />
        </div>
        <div>
          <h3 id="device-confirm-title" class="text-base font-bold text-slate-900">
            Ingin mendaftar dengan perangkat ini?
          </h3>
          <p class="mt-1 text-xs leading-relaxed text-slate-600">
            Pastikan ini benar-benar perangkat pribadi yang akan Anda gunakan sehari-hari untuk presensi.
          </p>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5">
        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-500">Akun:</span>
          <strong class="text-slate-900 text-right">{data.profile.full_name} ({data.profile.nip})</strong>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-500">Perangkat:</span>
          <strong class="text-slate-900 text-right">{deviceInfo.deviceName || 'Perangkat Ini'}</strong>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-500">Browser / OS:</span>
          <strong class="text-slate-900 text-right">{deviceInfo.browser || '-'} / {deviceInfo.os || '-'}</strong>
        </div>
      </div>

      <div class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
        <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <span>
          Jangan asal registrasi di perangkat pinjaman atau milik orang lain. Setelah terdaftar, login dari perangkat berbeda akan memicu peringatan dan laporan otomatis ke HR.
        </span>
      </div>

      <div class="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row">
        <button
          type="button"
          onclick={() => (showDeviceConfirmModal = false)}
          class="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Batal, Cek Lagi
        </button>
        <button
          type="button"
          onclick={confirmAndSubmitDevice}
          class="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
        >
          Ya, Daftarkan Perangkat Ini
        </button>
      </div>
    </div>
  </div>
{/if}
