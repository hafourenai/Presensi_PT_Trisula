# Modul: `database`

Skema PostgreSQL, constraint integritas, Row Level Security, bucket storage, dan proteksi administrator tunggal. Ini **fondasi pertama** yang dibangun (Fase 1), sebelum UI apa pun.

## Tanggung Jawab

- Mendefinisikan tabel dan enum (`user_role`, `attendance_status`).
- Menjaga aturan bisnis di level DB lewat `CHECK`, `UNIQUE`, dan trigger.
- RLS: karyawan hanya melihat datanya sendiri, admin/HR melihat semua, dan audit/pengaturan hanya untuk administrator.
- Bucket private `attendance-photos` dan `avatars` (maks 200 KB, hanya `image/jpeg`).
- Bootstrap administrator pertama dan rotasi administrator yang atomik.

## File Kunci (urut migrasi)

| File | Isi |
|---|---|
| [`20261007000100_initial_schema.sql`](../../../supabase/migrations/20261007000100_initial_schema.sql) | tabel inti, constraint, helper `private.get_my_role()` / `get_app_role()`, RLS, bucket, trigger `bootstrap_first_admin` |
| [`20261008000100_user_work_locations_and_cascade_delete.sql`](../../../supabase/migrations/20261008000100_user_work_locations_and_cascade_delete.sql) | lokasi kerja per karyawan (`work_lat/lng/radius_m`), FK attendances diubah menjadi `ON DELETE CASCADE` |
| [`20261008000200_anti_fake_gps_detection.sql`](../../../supabase/migrations/20261008000200_anti_fake_gps_detection.sql) | `is_suspicious_location`, `location_flags text[]` + partial index |
| [`20261008000300_user_devices_and_notifications.sql`](../../../supabase/migrations/20261008000300_user_devices_and_notifications.sql) | `user_devices`, `notifications`, kolom device di `attendances`, konfigurasi Telegram |
| [`20261116000100_single_administrator_roles.sql`](../../../supabase/migrations/20261116000100_single_administrator_roles.sql) | `pemilik`/`hr` dinormalisasi menjadi `admin_hr`, unique index administrator tunggal, trigger proteksi |
| [`20261116000200_atomic_administrator_rotation.sql`](../../../supabase/migrations/20261116000200_atomic_administrator_rotation.sql) | fungsi `rotate_administrator()` dengan advisory lock |
| [`20261122000100_repair_employee_columns.sql`](../../../supabase/migrations/20261122000100_repair_employee_columns.sql) | perbaikan kolom karyawan |
| [`local_schema.sql`](../../../supabase/local_schema.sql) | skema gabungan untuk PostgreSQL lokal (tanpa `auth`/`storage`) |
| [`seed.sql`](../../../supabase/seed.sql) | data awal departemen |

## Tabel

| Tabel | Kunci | Catatan |
|---|---|---|
| `profiles` | `id` = `auth.users.id` | NIP unik, email lowercase unik, role, `is_active`, `must_change_password`, consent, lokasi kerja |
| `attendances` | `unique(user_id, work_date)` | data masuk/pulang (waktu, foto, lat/lng, akurasi, jarak, device), status, menit, flag |
| `settings` | `id = 1` (single row) | jam kerja, toleransi (0â€“480), hari kerja ISO, kantor + radius, retensi foto, Telegram |
| `holidays` | `holiday_date` | daftar hari libur |
| `departments` | `name` unik | |
| `user_devices` | `unique(user_id, device_id)` | `is_trusted` menandai perangkat utama |
| `notifications` | | `user_id` atau `target_role` (broadcast ke HR) |
| `audit_logs` | identity | **append-only**: `service_role` hanya punya izin `select, insert` |

## Pola Penting / Gotcha

- **`get_app_role()` mengembalikan NULL** selama user belum ganti password atau belum consent. Artinya, user yang belum selesai onboarding tidak bisa membaca data apa pun lewat RLS selain profilnya sendiri.
- Semua mutasi dari klien dicabut (`revoke all ... from authenticated`). Penulisan hanya lewat server, sehingga validasi dan audit tidak bisa dilewati.
- **Administrator tunggal** dijaga tiga lapis: partial unique index `((role = 'administrator')) where role = 'administrator'`, trigger yang melarang mengubah/menonaktifkan/menghapus administrator, dan perubahan yang hanya bisa lewat `rotate_administrator()` (transaksi + `pg_advisory_xact_lock`).
- Nilai enum lama (`pemilik`) tidak dihapus dari tipe, karena menghapus nilai enum PostgreSQL memerlukan pembangunan ulang tipe. Datanya sudah dinormalisasi dan hak aksesnya dicabut.
- Diuji dengan **PGlite** (PostgreSQL WASM in-process) di [`tests/database.test.mjs`](../../../tests/database.test.mjs). Tes ini memverifikasi RLS per role dan semua constraint.
