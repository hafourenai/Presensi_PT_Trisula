# Fase 1 — Database, storage, dan administrator awal

## Status

Implementasi dan tes lokal tersedia. Pada pemeriksaan awal proyek Supabase, keenam tabel aplikasi belum tersedia melalui Data API dan bucket aplikasi belum terkonfigurasi. Migrasi cloud serta akun administrator belum dibuat oleh agen.

Environment `SUPABASE_SECRET_KEY` memberi akses Data API, Storage, dan Auth Admin API. Key ini **bukan kredensial SQL/Postgres atau Management API**, sehingga tidak dapat menjalankan `CREATE TABLE`. Untuk setup awal ini, gunakan SQL Editor dengan file SQL di repository.

## 1. Jalankan migrasi di Supabase

1. Buka proyek Supabase yang URL-nya sama dengan `PUBLIC_SUPABASE_URL` di `.env`.
2. Buka **SQL Editor → New query** dan gunakan role **postgres**.
3. Buka file [`supabase/migrations/20261007000100_initial_schema.sql`](../supabase/migrations/20261007000100_initial_schema.sql) pada editor lokal, salin **seluruh isinya**, lalu jalankan di SQL Editor.
4. Setelah berhasil, jalankan isi [`supabase/seed.sql`](../supabase/seed.sql) sebagai query berikutnya. File ini mengisi lima departemen contoh; ubah nama departemen sebelum menjalankannya bila diperlukan.

Migrasi dibungkus transaksi: error membatalkan seluruh perubahan dalam migrasi tersebut. File migrasi awal dijalankan satu kali dan akan menolak benturan tabel/type/bucket yang sudah ada. Jangan menghapus tabel jika muncul error objek sudah ada; periksa kondisi proyek terlebih dahulu. Seed departemen aman diulang.

File migrasi disimpan sebagai sumber versi skema. Eksekusi manual SQL Editor tidak otomatis mencatat riwayat Supabase CLI. Jika kelak memakai CLI, verifikasi skema remote lalu tandai timestamp `20261007000100` sebagai applied melalui `supabase migration repair --status applied 20261007000100` pada proyek yang sudah di-link, sebelum `db push`. Jangan menjalankan reset database cloud untuk menyelaraskan riwayat.

## 2. Nonaktifkan pendaftaran mandiri

Pada **Authentication → Sign In / Providers**:

- Nonaktifkan **Allow new users to sign up**.
- Nonaktifkan **Allow anonymous sign-ins**.
- Pertahankan provider **Email** untuk login email/password.

Akun tetap dapat dibuat dengan Auth Admin API dari server. Jangan membuat administrator awal lewat tombol Add User, karena skrip bootstrap memerlukan metadata server untuk membuat profil dan audit secara atomik.

## 3. Isi identitas administrator awal

Tambahkan empat baris berikut ke `.env` yang sudah ada. Jangan mengganti tiga konfigurasi Supabase sebelumnya.

```dotenv
INITIAL_ADMIN_EMAIL="email-admin-anda@perusahaan.com"
INITIAL_ADMIN_PASSWORD="GANTI_DENGAN_PASSWORD_UNIK_MINIMAL_12_KARAKTER"
INITIAL_ADMIN_NIP="ADM001"
INITIAL_ADMIN_NAME="Nama Administrator"
```

Gunakan email yang belum ada di **Authentication → Users**. Password di atas hanya petunjuk, bukan password yang harus dipakai. Tanda kutip melindungi spasi dan karakter `#` dalam nilai `.env`. Nilai bootstrap hanya untuk CLI lokal, tidak perlu dimasukkan ke Vercel.

Jalankan dari folder proyek:

```sh
npm run seed:admin
```

Skrip melakukan pemeriksaan profil, memastikan belum ada administrator, lalu membuat pengguna menggunakan Auth Admin API dengan email terkonfirmasi. Trigger database membuat profil `administrator` dan audit `bootstrap_administrator` dalam transaksi yang sama dengan pembuatan Auth user. Profil ditandai `must_change_password = true`, consent masih kosong.

Tidak ada password bawaan dan password tidak dicetak ke terminal. Setelah sukses, hapus `INITIAL_ADMIN_PASSWORD` dari `.env` dan simpan kredensial di tempat yang Anda gunakan untuk menyimpan password. Login/ganti password/consent akan dibuat pada Fase 2.

Jika skrip diulang dengan input lengkap untuk profil admin yang sama, password tidak direset. Akun yang sudah ada tanpa profil tidak dipromosikan atau dihapus otomatis. Jika jaringan timeout saat membuat akun, periksa Authentication dan profiles sebelum mengulang; jangan menganggap operasi pasti gagal.

## 4. Periksa hasil cloud

```sh
npm run check:supabase
npm run check:database
```

`check:database` hanya membaca: memeriksa keberadaan tabel, penolakan akses anonim, konfigurasi bucket private/JPEG/200 KB, data pengaturan dan departemen, administrator aktif, serta status signup. Exit code bukan nol berarti setup belum lengkap atau perlu diperiksa. Tidak mencetak key, password, email, atau isi data karyawan.

Di Dashboard, konfirmasi:

- Enam tabel: `departments`, `profiles`, `attendances`, `settings`, `holidays`, `audit_logs` dan RLS aktif pada semuanya.
- Schema `private` **tidak** ada dalam daftar exposed schemas Data API.
- `settings` berisi satu baris: jam 08:00–16:00, Senin–Jumat, toleransi 0, radius 100 m, retensi 30 hari. Koordinat kantor masih kosong sampai nilai sebenarnya dimasukkan.
- Bucket `attendance-photos` dan `avatars` private; JPEG maksimal 204800 byte.
- Satu akun Auth administrator dan satu profil terkait; password pertama wajib diganti.

Pengecekan API bukan pengganti tes RLS authenticated atau integrasi signed URL di layanan Supabase. Pengujian end-to-end dengan sesi pengguna nyata dilakukan setelah autentikasi tersedia.

## Keputusan akses untuk fase berikutnya

| Pengguna | Profil | Presensi/foto | Departemen/hari libur | Settings/audit |
|---|---|---|---|---|
| Tanpa login | Tidak | Tidak | Tidak | Tidak |
| Aktif, onboarding belum selesai | Profil sendiri | Tidak | Tidak | Tidak |
| Karyawan aktif, onboarding selesai | Sendiri | Sendiri | Baca | Tidak |
| Pemilik/Admin HR aktif, onboarding selesai | Semua | Semua | Baca | Tidak |
| Administrator aktif, onboarding selesai | Semua | Semua | Baca | Baca |
| Nonaktif/tanpa profil | Tidak | Tidak | Tidak | Tidak |

Semua **mutasi** dilakukan melalui server route/operasi tepercaya, termasuk untuk Administrator. Klien tidak mempunyai grant insert/update/delete pada tabel aplikasi. Ini mencegah perubahan role, status aktif, consent, password flag, serta timestamp presensi lewat Data API langsung. Server wajib memeriksa sesi dan hak akses sebelum memakai secret key, karena secret key melewati RLS.

Server route pada fase selanjutnya harus membatasi Pemilik/Admin HR ke pengelolaan akun karyawan, Administrator ke seluruh akun, dan perubahan profil mandiri ke telepon/foto/password. Ringkasan jadwal untuk halaman presensi akan diberikan server sebagai field terbatas; karyawan tidak membaca tabel pengaturan langsung.

- `private.get_my_role()` membaca role aktif dari database untuk profil sendiri, tanpa rekursi RLS.
- `private.get_app_role()` juga mewajibkan password awal sudah diganti dan consent sudah dicatat untuk akses operasional.
- Consent disimpan sebagai `consent_accepted_at` dan `consent_version`; keputusan menerima consent harus berasal dari aksi pengguna, bukan seed.
- Upload foto melalui server atau signed upload yang diberikan server setelah validasi. Akses baca RLS memakai direktori `{user_id}/...`. Path presensi: `{user_id}/{yyyy-mm-dd}/{in|out}.jpg`; avatar juga di bawah direktori user.
- Signed URL harus berumur pendek pada implementasi UI berikutnya. URL yang sudah ditandatangani dapat tetap berlaku sampai kedaluwarsa setelah akun dinonaktifkan.
- Audit API bersifat append-only; logging operasi selain bootstrap ditambahkan bersama server route terkait.
- Nonaktifkan akun untuk mempertahankan riwayat. FK presensi mencegah penghapusan permanen akun yang masih memiliki riwayat; alur penghapusan/anonymisasi administratif harus dirancang eksplisit pada fase pengelolaan akun.
- `work_date` default memakai Asia/Jakarta. Perhitungan terlambat, jam masuk/pulang dari `now()` database, Haversine, dan otorisasi mutasi presensi akan dibuat pada Fase 5, bukan mempercayai nilai kiriman browser.
- Cron tidak hadir, lupa pulang, dan retensi dibuat pada Fase 10.

## Tes lokal

```sh
npm test
npm run check
npm run build
```

Tes menjalankan SQL migrasi sebenarnya pada PostgreSQL WASM (PGlite) di memori. Schema `auth` dan `storage` memakai fixture minimal; tidak membutuhkan Docker atau kredensial dan tidak mengubah cloud. Mencakup isolasi karyawan, akses seluruh role, akun nonaktif/onboarding, eskalasi role, kontrol baca/tulis foto, constraint data, bootstrap atomik, dan audit append-only. Tes skrip bootstrap memakai transport palsu agar tidak membuat akun sungguhan.

## Referensi

- [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [User management](https://supabase.com/docs/guides/auth/managing-user-data)
- [Konfigurasi Auth](https://supabase.com/docs/guides/auth/general-configuration)
- [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Arahan desain dan HTML untuk Figma](./design-handoff.md)
