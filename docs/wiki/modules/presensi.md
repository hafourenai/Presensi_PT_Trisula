# Modul: `presensi`

Fitur inti aplikasi: karyawan mengambil selfie langsung dari kamera (wajib tepat satu wajah) beserta GPS, lalu server mencatat presensi masuk atau pulang dengan waktu server, status, jarak, dan penanda anomali.

## Tanggung Jawab

- **Browser:** jam real-time WIB, validasi jendela jam kerja, kamera depan, deteksi wajah per frame, GPS kontinu, kompresi foto, dan pengiriman multipart.
- **Server:** autentikasi karyawan, pemeriksaan anti-fake-GPS, verifikasi perangkat, Haversine, upload foto, aturan masuk/pulang, status, dan audit.

## File Kunci

- [`src/routes/presensi/+page.svelte`](../../../src/routes/presensi/+page.svelte) (779 baris): UI + logika klien.
- [`src/routes/presensi/+page.server.js`](../../../src/routes/presensi/+page.server.js): memuat presensi hari ini, pengaturan, dan lokasi target.
- [`src/routes/api/presensi/+server.js`](../../../src/routes/api/presensi/+server.js): endpoint pencatat.
- [`src/lib/geo.js`](../../../src/lib/geo.js): `calculateDistance()` (Haversine, R = 6.371 km, hasil dibulatkan ke meter).
- [`src/lib/device.js`](../../../src/lib/device.js): `getBrowserInfo()`, `getOrCreateDeviceId()`.

## Sisi Klien (`+page.svelte`)

| Fungsi | Isi |
|---|---|
| `initFaceDetector()` | `import('@mediapipe/tasks-vision')` dimuat lazy. Model `blaze_face_short_range` float16, `runningMode: 'VIDEO'`, `minDetectionConfidence: 0.5`, delegate **GPU** dengan fallback **CPU** |
| `startAttendanceFlow(type)` | menolak jika di luar jam kerja, lalu menyalakan kamera `getUserMedia` (kamera depan, tinggi ideal 480) |
| `detectFaces()` | loop `requestAnimationFrame` yang memanggil `faceDetector.detectForVideo()` dan menyimpan `facesDetected` |
| `capturePhoto()` | hanya jika `facesDetected === 1`. Canvas lebar 480 px, `toBlob('image/jpeg', 0.65)` |
| `startLocationWatch()` | `getCurrentPosition` + `watchPosition` dengan `enableHighAccuracy`. Menyimpan lat, lng, accuracy, timestamp, `isMock` |
| `syncCurrentDevice()` | `POST /api/device/sync` untuk menampilkan status perangkat (utama/asing/belum terdaftar) |
| `submitAttendance()` | `FormData` dikirim ke `POST /api/presensi`. Jika sukses, form dikunci (`attendanceCompleted`) |

Tombol "Ambil Foto" memakai `disabled={facesDetected !== 1}`. Tidak ada input file, jadi foto tidak bisa diambil dari galeri.

## Sisi Server (`POST /api/presensi`)

1. Menolak dengan 401 jika user bukan karyawan aktif.
2. **Flag lokasi:**
   - `mock_provider_detected`: klien melaporkan mock (mencurigakan).
   - `suspicious_high_accuracy`: akurasi < 1,5 m (mencurigakan).
   - `low_accuracy_cell_tower`: akurasi > 1.500 m (hanya informasi).
   - `gps_timestamp_mismatch`: selisih timestamp GPS dengan jam server > 30 detik (mencurigakan).
3. Validasi `type` (`in`/`out`) dan `photo` wajib (jika tidak, 400).
4. `today` dan `HH:mm` dihitung dari jam server dalam zona `Asia/Jakarta`.
5. **Perangkat:** tanpa perangkat utama, 403 `needsRegistration`. Perangkat dikenal: update `last_used_at`. Perangkat asing: insert `is_trusted=false`, flag `unrecognized_device`, dan `alertUnrecognizedDevice()`.
6. **Lokasi target:** `profiles.work_lat/lng/radius_m` dengan fallback ke `settings.office_*`. Jarak hanya dihitung jika GPS tersedia.
7. Upload ke `attendance-photos/{uid}/{today}/{type}.jpg` (`upsert: true`).
8. **Masuk:** tolak jika sudah ada `check_in_at`. Hitung status terhadap `work_start + late_tolerance_min`, lalu insert/update.
9. **Pulang:** tolak jika belum masuk atau sudah pulang. Hitung `early_leave_minutes`, gabungkan flag dengan flag saat masuk.
10. `createAuditLog('check_in' | 'check_out')`, lalu respons JSON.

## Dependensi

- **Dipakai oleh:** karyawan (portal employee).
- **Memakai:** `supabaseAdmin` (DB + Storage), `geo.js`, `audit.js`, `notifications.js`, `@mediapipe/tasks-vision`.

## Pola Penting / Gotcha

- File WASM MediaPipe diambil dari jsDelivr (`@latest`) dan model dari Google Storage. Pemuatan pertama butuh internet ke CDN tersebut. Versi `@latest` berisiko berubah tanpa pemberitahuan.
- Jarak yang ditampilkan di UI hanya pratinjau. Angka resmi adalah hasil hitungan server.
- Upload foto dilakukan **sebelum** pengecekan presensi ganda, sehingga request ganda masih menimpa foto (`upsert`) walaupun hasilnya ditolak 400.
- Logika "di luar jam kerja" hanya ada di klien (lihat [business-flow.md](../business-flow.md#catatan-jujur-berguna-jika-ditanya)).
