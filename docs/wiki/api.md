# API

Selain halaman, aplikasi punya endpoint JSON (`+server.js`) dan *form action* SvelteKit (`+page.server.js`). Semua membutuhkan sesi cookie Supabase.

## Endpoint JSON

| Metode & Path | Role | Input | Output |
|---|---|---|---|
| `POST /api/presensi` | karyawan | multipart: `type` (`in`/`out`), `photo` (JPEG), `lat`, `lng`, `accuracy`, `timestamp`, `is_mock`, `device_id`, `device_name`, `browser`, `os` | `{success, type, status?, lateMinutes?, earlyLeaveMinutes?, distanceM, isUnrecognizedDevice, time, message}`. Error: 400 (data/aturan), 401, 403 `needsRegistration`, 500 |
| `POST /api/device/sync` | karyawan | JSON `{deviceId, deviceName, browser, os}` | `{success, status: 'primary'|'unrecognized'|'unregistered', needsRegistration, isTrusted, primaryDevice, message}` |
| `GET /api/storage/signed-url?path=&bucket=` | semua (karyawan hanya path miliknya) | path objek | `{success, url}` (berlaku 60 detik) |
| `POST /api/resolve-maps` | admin (diblokir di domain karyawan) | link Google Maps / teks koordinat | koordinat lat/lng (memprioritaskan pin `!3d!4d`) |

## Form Action

| Route | Action | Role |
|---|---|---|
| `/login` | `default` | publik |
| `/ganti-password` | `default` (password + consent + perangkat utama) | login |
| `/auth/logout` | `default` | login |
| `/profil` | `updateBiodata`, `updatePassword` | login |
| `/admin/karyawan/baru` | `default` | administrator, admin_hr |
| `/admin/karyawan/impor` | `default` | administrator, admin_hr |
| `/admin/karyawan/[id]` | `updateStatus`, `resetPassword`, `updateLocation`, `deleteAccount`, `setPrimaryDevice`, `deleteDevice`, `resetAllDevices` | administrator, admin_hr |
| `/admin/akun` | `updateRole`, `deleteAccount`, `resetDevices` | administrator |
| `/admin/pengaturan` | `updateSettings`, `addHoliday` | administrator |

## Fungsi Database (RPC)

| Fungsi | Keterangan |
|---|---|
| `public.rotate_administrator(candidate_id, previous_role, deactivate_previous)` | mengganti administrator secara atomik (security definer + advisory lock). Dipanggil oleh `npm run admin:rotate` |
| `private.get_my_role()` / `private.get_app_role()` | helper RLS (security definer) |
