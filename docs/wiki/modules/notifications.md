# Modul: `notifications`

Memberi tahu karyawan dan HR ketika terjadi kejadian keamanan, saat ini terutama **login atau presensi dari perangkat tidak dikenal**.

## File Kunci

- [`src/lib/server/notifications.js`](../../../src/lib/server/notifications.js): `createNotification()`, `alertUnrecognizedDevice()`.
- [`src/lib/server/telegram.js`](../../../src/lib/server/telegram.js): `sendTelegramAlert()` ke `api.telegram.org/bot<token>/sendMessage` (HTML).
- [`src/lib/server/audit.js`](../../../src/lib/server/audit.js): `createAuditLog()` (gagal dicatat di log, tidak menggagalkan request).

## Alur `alertUnrecognizedDevice()`

1. Notifikasi in-app ke **karyawan** ("Jika bukan Anda, segera hubungi HR").
2. Notifikasi in-app broadcast `target_role = 'admin_hr'`, tampil di dashboard backoffice.
3. Pesan **Telegram** ke grup HR: nama, NIP, departemen, waktu WIB, perangkat, browser/OS, status "Flagged".

## Konfigurasi

- Token & chat id dibaca dari env `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`, dengan fallback ke `settings.telegram_*`. Bisa dimatikan lewat `telegram_alerts_enabled`.
- Jika belum dikonfigurasi, fungsi langsung kembali tanpa error.

## Gotcha

- Semua pengiriman dibungkus `try/catch`, sehingga kegagalan Telegram tidak menggagalkan presensi atau login.
