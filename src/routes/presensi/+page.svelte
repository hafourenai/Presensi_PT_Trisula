<script>
  import { onMount, onDestroy } from 'svelte';
  import {
    Camera,
    MapPin,
    Clock,
    CheckCircle,
    AlertTriangle,
    XCircle,
    RefreshCw,
    Send,
    Sparkles,
    ShieldAlert,
    Info,
    RotateCcw,
    Smartphone
  } from '@lucide/svelte';
  import { getBrowserInfo, getOrCreateDeviceId } from '$lib/device.js';
  import { calculateDistance } from '$lib/geo.js';

  let { data } = $props();

  let attendance = $state(data.attendance);
  let currentTime = $state('');
  let timeInterval;

  // Device Sync State
  let deviceSyncLoading = $state(true);
  let deviceSyncData = $state(null);
  let watchId = null;

  // Kamera & MediaPipe State
  let videoEl = $state(null);
  let canvasEl = $state(null);
  let stream = $state(null);
  let cameraActive = $state(false);
  let cameraLoading = $state(false);
  let cameraError = $state('');

  let faceDetector = null;
  let detectorReady = $state(false);
  let facesDetected = $state(0);
  let animationFrameId = null;

  // Foto & Presensi State
  let capturedPhoto = $state(null);
  let previewUrl = $state('');
  let submitting = $state(false);
  let submitResult = $state(null);
  let activeType = $state('in'); // 'in' or 'out'
  let attendanceCompleted = $state(false); // Flag untuk lock form setelah submit berhasil

  // GPS State & Anti-Fake GPS Signals
  let locationLoading = $state(false);
  let locationData = $state({
    lat: null,
    lng: null,
    accuracy: null,
    timestamp: null,
    isMock: false,
    altitude: null,
    speed: null
  });
  let locationError = $state('');
  let distanceToOffice = $state(null);

  // Status Presensi Hari Ini
  const hasCheckedIn = $derived(!!attendance?.check_in_at);
  const hasCheckedOut = $derived(!!attendance?.check_out_at);
  let currentDeviceInfo = $state({ deviceName: '', browser: '', os: '' });

  // Validasi waktu kerja
  function parseTimeString(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes; // Convert to minutes since midnight
  }

  function getCurrentMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  const workStartMinutes = $derived(parseTimeString(data.settings.work_start));
  const workEndMinutes = $derived(parseTimeString(data.settings.work_end));
  let currentMinutes = $state(getCurrentMinutes());

  const timeStatus = $derived.by(() => {
    const now = currentMinutes;
    if (now < workStartMinutes) {
      const diff = workStartMinutes - now;
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      return {
        allowed: false,
        message: `Presensi belum dibuka. Dibuka pada ${data.settings.work_start} WIB (dalam ${hours}j ${mins}m)`
      };
    } else if (now > workEndMinutes) {
      return {
        allowed: false,
        message: `Presensi sudah ditutup. Jam kerja berakhir pada ${data.settings.work_end} WIB`
      };
    }
    return {
      allowed: true,
      message: `Dalam jam kerja: ${data.settings.work_start} - ${data.settings.work_end} WIB`
    };
  });

  function updateClock() {
    currentTime = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date());
  }

  onMount(async () => {
    currentDeviceInfo = getBrowserInfo();
    updateClock();
    timeInterval = setInterval(() => {
      updateClock();
      // Force re-evaluation of derived time validation
      currentMinutes = getCurrentMinutes();
    }, 1000);
    startLocationWatch();
    syncCurrentDevice();
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
    if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
    stopCamera();
  });

  function startLocationWatch() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      locationError = 'Perangkat tidak mendukung geolokasi GPS.';
      return;
    }

    locationLoading = true;
    locationError = '';

    navigator.geolocation.getCurrentPosition(handlePositionUpdate, handlePositionError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(handlePositionUpdate, handlePositionError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 3000
    });
  }

  function handlePositionUpdate(pos) {
    locationLoading = false;
    const isMocked = !!(pos.coords?.isMock || (pos.coords && 'mocked' in pos.coords && pos.coords.mocked));

    locationData = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
      isMock: isMocked,
      altitude: pos.coords.altitude,
      speed: pos.coords.speed
    };

    if (data.settings?.office_lat && data.settings?.office_lng) {
      distanceToOffice = calculateDistance(
        pos.coords.latitude,
        pos.coords.longitude,
        data.settings.office_lat,
        data.settings.office_lng
      );
    }
  }

  function handlePositionError(err) {
    locationLoading = false;
    if (err.code === 1) {
      locationError = 'Izin lokasi GPS ditolak oleh browser. Wajib mengaktifkan izin GPS untuk presensi.';
    } else {
      locationError = 'Gagal mendeteksi koordinat GPS perangkat.';
    }
  }

  async function syncCurrentDevice() {
    try {
      const devInfo = getBrowserInfo();
      const devId = getOrCreateDeviceId();
      const res = await fetch('/api/device/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: devId,
          deviceName: devInfo.deviceName,
          browser: devInfo.browser,
          os: devInfo.os
        })
      });
      const json = await res.json();
      if (json.success) {
        deviceSyncData = json;
      }
    } catch (e) {
      console.warn('Gagal sinkronisasi data device:', e);
    } finally {
      deviceSyncLoading = false;
    }
  }

  async function initFaceDetector() {
    if (faceDetector) return;
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const wasmFileset = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      faceDetector = await vision.FaceDetector.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5
      });
      detectorReady = true;
    } catch (err) {
      console.warn('Fallback CPU untuk face detector:', err);
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const wasmFileset = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        faceDetector = await vision.FaceDetector.createFromOptions(wasmFileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5
        });
        detectorReady = true;
      } catch (e) {
        console.error('Gagal menginisialisasi detektor wajah:', e);
      }
    }
  }

  async function startAttendanceFlow(type) {
    // Validasi waktu kerja
    if (!timeStatus.allowed) {
      submitResult = {
        success: false,
        message: timeStatus.message
      };
      return;
    }

    activeType = type;
    capturedPhoto = null;
    previewUrl = '';
    submitResult = null;
    cameraError = '';
    cameraLoading = true;

    try {
      await initFaceDetector();

      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraActive = true;
      cameraLoading = false;

      // Hubungkan video stream
      setTimeout(() => {
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.play();
          detectFaces();
        }
      }, 100);
    } catch (err) {
      cameraLoading = false;
      cameraActive = false;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        cameraError = 'Izin kamera ditolak. Mohon aktifkan izin akses kamera pada browser Anda.';
      } else {
        cameraError = 'Kamera tidak dapat diakses atau sedang digunakan oleh aplikasi lain.';
      }
    }
  }

  function detectFaces() {
    if (!videoEl || !cameraActive || !faceDetector) return;

    if (videoEl.readyState >= 2) {
      const nowMs = performance.now();
      const detections = faceDetector.detectForVideo(videoEl, nowMs);
      facesDetected = detections.detections.length;
    }

    animationFrameId = requestAnimationFrame(detectFaces);
  }

  function stopCamera() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    cameraActive = false;
    facesDetected = 0;
  }

  function capturePhoto() {
    if (!videoEl || facesDetected !== 1) return;

    const width = 480;
    const height = (videoEl.videoHeight / videoEl.videoWidth) * width || 360;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Draw video frame
    ctx.drawImage(videoEl, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        capturedPhoto = blob;
        previewUrl = URL.createObjectURL(blob);
        stopCamera();
      },
      'image/jpeg',
      0.65 // Kompresi JPEG target < 50KB
    );
  }

  function retakePhoto() {
    capturedPhoto = null;
    previewUrl = '';
    startAttendanceFlow(activeType);
  }

  async function submitAttendance() {
    if (!capturedPhoto) return;

    submitting = true;
    submitResult = null;

    try {
      const deviceInfo = getBrowserInfo();
      const deviceId = getOrCreateDeviceId();

      const formData = new FormData();
      formData.append('type', activeType);
      formData.append('photo', capturedPhoto, `${activeType}.jpg`);
      if (locationData.lat !== null) formData.append('lat', locationData.lat.toString());
      if (locationData.lng !== null) formData.append('lng', locationData.lng.toString());
      if (locationData.accuracy !== null) formData.append('accuracy', locationData.accuracy.toString());
      if (locationData.timestamp !== null) formData.append('timestamp', locationData.timestamp.toString());
      if (locationData.isMock) formData.append('is_mock', 'true');
      if (locationData.altitude !== null) formData.append('altitude', locationData.altitude.toString());
      if (locationData.speed !== null) formData.append('speed', locationData.speed.toString());

      // Device identifiers
      formData.append('device_id', deviceId);
      formData.append('device_name', deviceInfo.deviceName);
      formData.append('browser', deviceInfo.browser);
      formData.append('os', deviceInfo.os);

      const res = await fetch('/api/presensi', {
        method: 'POST',
        body: formData
      });

      const json = await res.json();
      submitResult = json;
      submitting = false;

      if (json.success) {
        attendanceCompleted = true; // Lock form setelah sukses
        // Update state lokal
        if (activeType === 'in') {
          attendance = {
            ...attendance,
            check_in_at: new Date().toISOString(),
            status: json.status,
            late_minutes: json.lateMinutes,
            check_in_distance_m: json.distanceM
          };
        } else {
          attendance = {
            ...attendance,
            check_out_at: new Date().toISOString(),
            early_leave_minutes: json.earlyLeaveMinutes,
            check_out_distance_m: json.distanceM
          };
        }
      }
    } catch (err) {
      submitting = false;
      submitResult = {
        success: false,
        message: 'Gagal mengirim data presensi ke server. Periksa jaringan Anda.'
      };
    }
  }
</script>

<svelte:head>
  <title>Presensi Harian — Presensi Karyawan</title>
</svelte:head>

<div class="mx-auto max-w-xl space-y-6">
  <!-- Header Widget & Live Clock -->
  <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white shadow-xl shadow-emerald-700/20 sm:p-8">
    <div class="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-emerald-100">Presensi Hari Ini (WIB)</p>
        <p class="mt-1 text-sm text-emerald-100/90 font-medium">
          {new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}
        </p>
      </div>
      <div class="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 backdrop-blur-md">
        <Clock class="h-5 w-5 text-emerald-200" />
        <span class="font-mono text-2xl font-bold tracking-tight text-white">{currentTime || '--:--:--'}</span>
      </div>
    </div>

    <!-- Info Jam Kerja & Lokasi Penempatan -->
    <div class="mt-6 flex flex-wrap gap-4 border-t border-white/15 pt-4 text-xs text-emerald-50">
      <div>
        <span class="opacity-75">Jam Masuk:</span>
        <strong class="ml-1 font-semibold">{data.settings.work_start} WIB</strong>
      </div>
      <div>
        <span class="opacity-75">Jam Pulang:</span>
        <strong class="ml-1 font-semibold">{data.settings.work_end} WIB</strong>
      </div>
      <div>
        <span class="opacity-75">Lokasi Target:</span>
        <strong class="ml-1 font-semibold">{data.settings.location_name} (Radius {data.settings.office_radius_m}m)</strong>
      </div>
    </div>
  </div>

  <!-- Status & Summary Card -->
  <div class="grid grid-cols-2 gap-4">
    <!-- Status Masuk -->
    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Presensi Masuk</span>
        {#if hasCheckedIn}
          <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold {attendance.status === 'tepat_waktu' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}">
            <CheckCircle class="h-3.5 w-3.5" />
            {attendance.status === 'tepat_waktu' ? 'Tepat Waktu' : `Terlambat ${attendance.late_minutes}m`}
          </span>
        {:else}
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Belum Masuk</span>
        {/if}
      </div>
      <p class="mt-2 text-lg font-bold text-slate-900">
        {hasCheckedIn ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(attendance.check_in_at)) + ' WIB' : '--:--'}
      </p>
      {#if hasCheckedIn && attendance.check_in_distance_m !== null}
        <p class="mt-1 text-[11px] text-slate-500">
          Jarak: {attendance.check_in_distance_m} m dari kantor
        </p>
      {/if}
      {#if hasCheckedIn && attendance.is_unrecognized_device}
        <span class="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
          <AlertTriangle class="h-3 w-3" />
          Perangkat Baru
        </span>
      {/if}
    </div>

    <!-- Status Pulang -->
    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Presensi Pulang</span>
        {#if hasCheckedOut}
          <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            <CheckCircle class="h-3.5 w-3.5" />
            Selesai
          </span>
        {:else}
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Belum Pulang</span>
        {/if}
      </div>
      <p class="mt-2 text-lg font-bold text-slate-900">
        {hasCheckedOut ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(attendance.check_out_at)) + ' WIB' : '--:--'}
      </p>
      {#if hasCheckedOut && attendance.check_out_distance_m !== null}
        <p class="mt-1 text-[11px] text-slate-500">
          Jarak: {attendance.check_out_distance_m} m dari kantor
        </p>
      {/if}
    </div>
  </div>

  <!-- Device Info & Anti-Joki Status Card -->
  {#if deviceSyncLoading}
    <div class="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 text-xs shadow-xs text-slate-500 animate-pulse">
      <Smartphone class="h-4 w-4 text-slate-400" />
      <span>Memeriksa status perangkat pada database...</span>
    </div>
  {:else if deviceSyncData && !deviceSyncData.isTrusted}
    <!-- Peringatan Jelas: Perangkat Berbeda / Tidak Dikenal -->
    <div class="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs shadow-xs space-y-2">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-2.5 text-rose-950">
          <ShieldAlert class="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 class="font-bold text-rose-900 text-xs">⚠️ Perangkat Berbeda Terdeteksi</h4>
            <p class="mt-1 text-[11px] text-rose-800 leading-relaxed">
              Akun Anda terdaftar di: <strong>{deviceSyncData.primaryDevice?.device_name || 'Perangkat Utama Lain'}</strong>.
              <br />
              Saat ini Anda mengakses dari: <strong>{currentDeviceInfo.deviceName}</strong>.
            </p>
          </div>
        </div>
        <span class="shrink-0 rounded-full bg-rose-200 px-2.5 py-0.5 text-[10px] font-bold text-rose-800">
          Device Berbeda
        </span>
      </div>
      <p class="text-[10px] font-medium text-rose-700 bg-rose-100/70 p-2 rounded-lg">
        Aktivitas dan presensi dari perangkat ini dicatat sebagai <strong>Perangkat Asing</strong> dan dilaporkan ke HR. Jika Anda mengganti HP/laptop, hubungi HR untuk mereset perangkat terdaftar.
      </p>
    </div>
  {:else}
    <!-- Perangkat Utama Terverifikasi -->
    <div class="flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-xs shadow-xs">
      <div class="flex items-center gap-2 text-slate-800">
        <Smartphone class="h-4 w-4 text-emerald-600" />
        <span>Perangkat terdaftar: <strong>{currentDeviceInfo.deviceName || 'Perangkat Utama'}</strong></span>
      </div>
      <span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
        ✓ Perangkat Utama
      </span>
    </div>
  {/if}

  <!-- GPS Status & Real-time Radius Badge -->
  <div class="rounded-2xl border {distanceToOffice !== null ? (distanceToOffice <= data.settings.office_radius_m ? 'border-emerald-200 bg-white' : 'border-amber-300 bg-amber-50/40') : 'border-slate-200/80 bg-white'} p-4 text-xs shadow-xs space-y-2.5">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 font-semibold text-slate-800">
        <MapPin class="h-4 w-4 {distanceToOffice !== null && distanceToOffice <= data.settings.office_radius_m ? 'text-emerald-600' : 'text-amber-600'}" />
        <span>Status Lokasi GPS Real-time</span>
      </div>
      <button
        type="button"
        onclick={startLocationWatch}
        class="flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 text-[11px]"
      >
        <RefreshCw class="h-3 w-3 {locationLoading ? 'animate-spin' : ''}" />
        <span>{locationLoading ? 'Mencari...' : 'Perbarui GPS'}</span>
      </button>
    </div>

    {#if locationLoading && locationData.lat === null}
      <p class="text-[11px] text-slate-500 animate-pulse">Mengunci sinyal satelit GPS perangkat...</p>
    {:else if locationData.lat !== null}
      <div class="space-y-1.5 text-[11px]">
        <div class="flex items-center justify-between">
          <span class="text-slate-500">Jarak ke {data.settings.location_name}:</span>
          {#if distanceToOffice !== null}
            <strong class="{distanceToOffice <= data.settings.office_radius_m ? 'text-emerald-700' : 'text-amber-700 font-bold'}">
              {distanceToOffice} meter ({distanceToOffice <= data.settings.office_radius_m ? `Dalam radius ${data.settings.office_radius_m}m` : `Di luar radius ${data.settings.office_radius_m}m`})
            </strong>
          {:else}
            <span class="text-slate-400">Menghitung...</span>
          {/if}
        </div>

        <div class="flex items-center justify-between">
          <span class="text-slate-500">Akurasi Sinyal GPS:</span>
          <span class="font-medium {locationData.accuracy <= 30 ? 'text-emerald-700' : locationData.accuracy <= 100 ? 'text-blue-700' : 'text-amber-700'}">
            ±{Math.round(locationData.accuracy || 0)}m
            {#if locationData.accuracy <= 30}
              (Sangat Akurat)
            {:else if locationData.accuracy <= 100}
              (Cukup Akurat)
            {:else}
              (Sinyal Kasar / Sedang Mengunci)
            {/if}
          </span>
        </div>

        {#if locationData.accuracy > 100}
          <div class="rounded-lg bg-amber-100/70 p-2 text-[10px] text-amber-800 leading-relaxed mt-1">
            💡 <strong>Tips Akurasi:</strong> Jika menggunakan HP, pastikan mode GPS <em>"Akurasi Tinggi"</em> aktif dan hindari berada di dalam ruangan tertutup tanpa jendela agar sinyal satelit GPS dapat terkunci maksimal.
          </div>
        {/if}
      </div>
    {:else}
      <p class="text-[11px] font-medium text-red-600">{locationError || 'Lokasi GPS belum terdeteksi. Izinkan akses GPS pada browser Anda.'}</p>
    {/if}
  </div>

  <!-- Work Hours Status Badge -->
  <div class="flex items-center justify-between rounded-2xl border {timeStatus.allowed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'} p-4 text-xs shadow-xs">
    <div class="flex items-center gap-2 {timeStatus.allowed ? 'text-emerald-700' : 'text-amber-700'}">
      <Clock class="h-4 w-4" />
      <span>{timeStatus.message}</span>
    </div>
  </div>

  <!-- Kamera & Action Section -->
  <div class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
    {#if cameraError}
      <div class="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <div class="flex items-center gap-2 font-semibold">
          <ShieldAlert class="h-5 w-5 text-red-600" />
          <span>Izin Akses Kamera Diperlukan</span>
        </div>
        <p class="mt-1 text-xs leading-relaxed text-red-700">
          {cameraError} Untuk melakukan presensi, mohon klik ikon gembok di address bar browser dan izinkan akses kamera, kemudian coba lagi.
        </p>
        <button
          onclick={() => startAttendanceFlow(activeType)}
          class="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          <RefreshCw class="h-3.5 w-3.5" />
          <span>Coba Lagi</span>
        </button>
      </div>
    {/if}

    {#if submitResult}
      <div class="mb-6 rounded-2xl p-5 {submitResult.success ? 'border border-emerald-200 bg-emerald-50 text-emerald-900' : 'border border-red-200 bg-red-50 text-red-900'}">
        <div class="flex items-center gap-2 font-bold">
          {#if submitResult.success}
            <CheckCircle class="h-5 w-5 text-emerald-600" />
            <span>Presensi Berhasil!</span>
          {:else}
            <XCircle class="h-5 w-5 text-red-600" />
            <span>Gagal Mencatat Presensi</span>
          {/if}
        </div>
        <p class="mt-1 text-xs leading-relaxed">{submitResult.message}</p>
        {#if submitResult.success && submitResult.distanceM !== null}
          <p class="mt-2 text-xs font-medium text-slate-700">
            Terdeteksi pada jarak {submitResult.distanceM} meter dari titik {data.settings.location_name}
            {#if submitResult.distanceM > data.settings.office_radius_m}
              <span class="text-amber-600">(Di luar radius {data.settings.office_radius_m}m)</span>
            {:else}
              <span class="text-emerald-600">(Dalam radius izin presensi)</span>
            {/if}
          </p>
        {/if}
      </div>
    {/if}

    <!-- View Live Camera -->
    {#if cameraActive}
      <div class="relative overflow-hidden rounded-2xl bg-black">
        <video
          bind:this={videoEl}
          autoplay
          playsinline
          muted
          class="h-72 w-full object-cover sm:h-96"
        ></video>

        <!-- Face Detection Overlay -->
        <div class="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
          <div class="flex justify-end">
            <div class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md {facesDetected === 1 ? 'bg-emerald-500/80 text-white shadow-lg shadow-emerald-500/30' : 'bg-red-500/80 text-white shadow-lg shadow-red-500/30'}">
              <span class="h-2 w-2 rounded-full {facesDetected === 1 ? 'bg-white animate-ping' : 'bg-white'}"></span>
              {#if facesDetected === 1}
                <span>Wajah Terdeteksi (Siap)</span>
              {:else if facesDetected === 0}
                <span>Wajah Tidak Terdeteksi</span>
              {:else}
                <span>Terlalu Banyak Wajah ({facesDetected})</span>
              {/if}
            </div>
          </div>

          <!-- Oval guide -->
          <div class="mx-auto h-48 w-36 rounded-[50%] border-2 border-dashed {facesDetected === 1 ? 'border-emerald-400' : 'border-white/50'} sm:h-60 sm:w-44"></div>

          <div class="text-center">
            <p class="text-xs font-medium text-white/90 drop-shadow-md">
              Posisikan wajah Anda tepat di dalam bingkai
            </p>
          </div>
        </div>
      </div>

      <div class="mt-4 flex gap-3">
        <button
          onclick={stopCamera}
          class="flex-1 min-h-[48px] rounded-xl border border-slate-200 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-[0.98]"
        >
          Batal
        </button>
        <button
          onclick={capturePhoto}
          disabled={facesDetected !== 1}
          class="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.98] transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Camera class="h-4 w-4" />
          <span>Ambil Foto</span>
        </button>
      </div>
    {:else if previewUrl && !attendanceCompleted}
      <!-- Photo Preview Screen -->
      <div class="text-center">
        <p class="mb-3 text-xs font-semibold text-slate-600">Pratinjau Foto Presensi</p>
        <div class="relative mx-auto overflow-hidden rounded-2xl border border-slate-200 max-w-xs shadow-md">
          <img src={previewUrl} alt="Pratinjau Presensi" class="w-full object-cover" />
        </div>

        <div class="mt-5 flex gap-3">
          <button
            onclick={retakePhoto}
            disabled={submitting}
            class="flex-1 min-h-[48px] flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition disabled:opacity-50"
          >
            <RotateCcw class="h-4 w-4" />
            <span>Foto Ulang</span>
          </button>
          <button
            onclick={submitAttendance}
            disabled={submitting}
            class="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {#if submitting}
              <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span>Mengirim...</span>
            {:else}
              <Send class="h-4 w-4" />
              <span>Kirim Presensi</span>
            {/if}
          </button>
        </div>
      </div>
    {:else}
      <!-- Action Buttons When Camera Inactive -->
      <div class="space-y-4">
        {#if !hasCheckedIn && !attendanceCompleted}
          <button
            onclick={() => startAttendanceFlow('in')}
            disabled={cameraLoading || !timeStatus.allowed}
            class="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-700 hover:to-teal-700 hover:shadow-emerald-600/35 active:scale-[0.99] focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if cameraLoading && activeType === 'in'}
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span>Menyiapkan Kamera...</span>
            {:else}
              <Camera class="h-5 w-5" />
              <span>Presensi Masuk Sekarang</span>
            {/if}
          </button>
          {#if !timeStatus.allowed}
            <p class="text-center text-xs text-amber-600 font-medium">{timeStatus.message}</p>
          {/if}
        {:else if !hasCheckedOut && !attendanceCompleted}
          <button
            onclick={() => startAttendanceFlow('out')}
            disabled={cameraLoading || !timeStatus.allowed}
            class="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-700 p-5 text-sm font-bold text-white shadow-lg shadow-teal-600/25 transition hover:from-teal-700 hover:to-emerald-800 hover:shadow-teal-600/35 active:scale-[0.99] focus:ring-4 focus:ring-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if cameraLoading && activeType === 'out'}
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span>Menyiapkan Kamera...</span>
            {:else}
              <Camera class="h-5 w-5" />
              <span>Presensi Pulang Sekarang</span>
            {/if}
          </button>
          {#if !timeStatus.allowed}
            <p class="text-center text-xs text-amber-600 font-medium">{timeStatus.message}</p>
          {/if}
        {:else}
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle class="h-6 w-6" />
            </div>
            <h4 class="mt-3 font-bold text-emerald-900">Presensi Hari Ini Lengkap</h4>
            <p class="mt-1 text-xs text-emerald-700">
              Anda telah menyelesaikan presensi masuk dan pulang untuk hari ini. Terima kasih atas kerja keras Anda!
            </p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
