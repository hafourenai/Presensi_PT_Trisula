# Modul: `device-binding`

Mengikat akun karyawan ke satu **Perangkat Utama** dan mendeteksi pemakaian perangkat lain. Tujuannya mencegah "titip absen" (joki). Perangkat diidentifikasi dengan UUID yang disimpan di `localStorage` browser.

## Tanggung Jawab

- Membuat dan membaca `device_id` di browser (`crypto.randomUUID()` disimpan di `localStorage['app_presence_device_id']`).
- Mengevaluasi perangkat saat login: `needs_registration` / `trusted` / `mismatch`.
- Mendaftarkan perangkat utama **hanya dengan konfirmasi eksplisit** karyawan, dan menolak race condition jika perangkat lain lebih dulu terdaftar.
- Mencatat perangkat asing (`is_trusted=false`) dan memicu notifikasi.
- Backoffice: menetapkan perangkat utama, menghapus perangkat, atau mereset semua perangkat karyawan.

## File Kunci

- [`src/lib/device.js`](../../../src/lib/device.js): identitas perangkat di klien.
- [`src/lib/server/device-auth.js`](../../../src/lib/server/device-auth.js): logika server.
- [`src/routes/api/device/sync/+server.js`](../../../src/routes/api/device/sync/+server.js): status perangkat untuk halaman presensi.
- Tabel `user_devices` di [`20261008000300_user_devices_and_notifications.sql`](../../../supabase/migrations/20261008000300_user_devices_and_notifications.sql).

## API Publik

```js
// klien
getBrowserInfo() -> { browser, os, deviceName, isMobile }
getOrCreateDeviceId() -> string

// server
extractClientIp(request, getClientAddress) -> string
getPrimaryDevice(devices) -> device | null           // device dengan is_trusted = true
evaluateLoginDevice({ devices, deviceId }) -> { status: 'needs_registration'|'trusted'|'mismatch', primaryDevice, matchedDevice }
registerPrimaryDevice({ supabaseAdmin, userId, deviceId, ... }) -> { registered, conflict?, device? }
recordUnrecognizedDevice({ supabaseAdmin, user, profile, devices, deviceId, ..., context, alwaysAlert }) -> { device, isNewDevice }
```

## Alur

| Kejadian | Hasil |
|---|---|
| Login pertama, belum ada perangkat utama | ke `/ganti-password`, karyawan mencentang konfirmasi, lalu `registerPrimaryDevice` + audit `register_primary_device` |
| Login dari perangkat utama | `last_used_at` diperbarui, lalu ke `/presensi` |
| Login dari perangkat lain (tanpa konfirmasi) | sesi diputus, **409** "Akun ini sudah terdaftar pada perangkat lain", audit `login_unrecognized_device_warning` |
| Karyawan mengonfirmasi tetap lanjut | `recordUnrecognizedDevice(alwaysAlert: true)`, notifikasi HR + Telegram, ke `/presensi?device_warning=1` |
| Presensi dari perangkat asing | diterima, `is_unrecognized_device = true`, HR diberi tahu |
| Presensi tanpa perangkat utama | 403 `needsRegistration` |

## Pola Penting / Gotcha

- `device_id` bergantung pada `localStorage`. Jika data browser dihapus atau karyawan memakai mode incognito, perangkat yang sama akan terbaca sebagai perangkat baru. Ini bukan *hardware fingerprint*, jadi sebut sebagai "identitas perangkat-browser".
- Kebijakannya *tandai dan beri tahu*, bukan blokir. HR yang menilai dan bisa mereset perangkat dari detail karyawan.
- `UNIQUE (user_id, device_id)` di database mencegah duplikasi.
