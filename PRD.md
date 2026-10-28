# PRD: Aplikasi Presensi Karyawan Berbasis Web

**Versi:** 1.0 | **Bahasa antarmuka:** Indonesia | **Zona waktu:** WIB (Asia/Jakarta)
**Tujuan dokumen:** Menjadi acuan utama untuk vibe coding. Setiap bagian ditulis agar bisa langsung dipakai sebagai konteks prompt ke AI coding assistant.

---

## 1. Ringkasan Produk

Aplikasi web presensi untuk **satu perusahaan** dengan target **500 karyawan** (kapasitas desain hingga 1.000). Karyawan melakukan presensi masuk dan pulang melalui kamera langsung (selfie) dengan deteksi wajah dan pencatatan lokasi GPS. Pemilik dan administrator memantau, memeriksa, dan mengekspor laporan presensi.

**Prioritas utama:** biaya hosting Rp0, mobile-first, sederhana dipakai.

### Tujuan
1. Mencatat kehadiran masuk dan pulang secara akurat dengan bukti foto dan lokasi.
2. Memberi pemilik gambaran kehadiran real-time lewat dashboard dan laporan.
3. Berjalan penuh di free tier layanan cloud.

### Di luar cakupan (Out of Scope)
- Pengenalan wajah (mencocokkan identitas). Hanya **deteksi ada/tidaknya wajah**.
- Izin, sakit, cuti (versi berikutnya).
- Multi-perusahaan, penggajian, aplikasi native.
- Notifikasi push/email.

---

## 2. Tech Stack

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Framework | **SvelteKit** (JavaScript, bukan TypeScript) | Ringan, cepat di HP, satu codebase frontend + server routes |
| Styling | **Tailwind CSS** | Mobile-first, responsive |
| Database + Auth | **Supabase** (PostgreSQL) | Row Level Security untuk kontrol akses per role |
| Penyimpanan foto | **Supabase Storage** (bucket private) | Lihat catatan kapasitas di bagian 9 |
| Hosting | **Vercel** (adapter-vercel) | HTTPS otomatis, wajib untuk akses kamera dan GPS |
| Deteksi wajah | **@mediapipe/tasks-vision** (Face Detector) | Jalan di browser, gratis, tanpa server |
| Kamera | `navigator.mediaDevices.getUserMedia` | Hanya kamera langsung, tanpa upload dari galeri |
| GPS | `navigator.geolocation` | Jarak dihitung dengan rumus Haversine |
| Ekspor Excel | `exceljs` atau `xlsx` | |
| Ekspor PDF | `jspdf` + `jspdf-autotable` | |
| Grafik dashboard | `chart.js` | |
| Penjadwalan | Supabase `pg_cron` | Generate status "Tidak Hadir" otomatis dan keep-alive |

---

## 3. Role dan Hak Akses

| Role | Deskripsi | Hak akses |
|---|---|---|
| **Administrator** | Kontrol penuh sistem | Semua fitur: kelola semua akun (termasuk pemilik dan HR), reset password, nonaktifkan akun, ubah pengaturan sistem, koreksi data presensi, lihat audit log dan monitoring aktivitas akun |
| **Pemilik** | Pimpinan perusahaan | Dashboard, laporan, riwayat seluruh karyawan, lihat foto presensi, kelola data karyawan dan buat akun karyawan. Tidak bisa mengubah akun Administrator |
| **Admin HR** | Pengelola data karyawan | Kelola data karyawan (CRUD), buat akun karyawan, lihat laporan. Tidak bisa melihat audit log atau mengubah pengaturan sistem |
| **Karyawan** | Pengguna presensi | Presensi, lihat riwayat dan biodata sendiri, ubah password dan foto profil sendiri |

**Aturan penting**
- Tidak ada pendaftaran mandiri. Akun **hanya dibuat oleh Administrator, Pemilik, atau Admin HR**. Halaman "register" adalah form pembuatan akun di dalam panel admin.
- Pembuatan akun memakai Supabase Admin API di **server route SvelteKit** (service role key tidak boleh sampai ke browser).
- Akun yang dinonaktifkan tidak bisa login, datanya tetap tersimpan.
- Password awal dibuat admin, pengguna **wajib ganti password** saat login pertama.

---

## 4. Fitur dan Kebutuhan Fungsional

### 4.1 Autentikasi
- **FR-A1** Login dengan email dan password (Supabase Auth).
- **FR-A2** Logout dan sesi berakhir otomatis jika token kedaluwarsa.
- **FR-A3** Ganti password (wajib saat login pertama).
- **FR-A4** Pembuatan akun oleh role berwenang (lihat bagian 3).
- **FR-A5** Setelah login, pengguna diarahkan sesuai role: Karyawan ke halaman Presensi, role lain ke Dashboard.
- **FR-A6** Pesan error berbahasa Indonesia (contoh: "Email atau password salah").

### 4.2 Presensi (Karyawan)
- **FR-P1** Halaman presensi menampilkan jam real-time WIB, status hari ini, dan tombol aksi yang sesuai ("Presensi Masuk" atau "Presensi Pulang").
- **FR-P2** Alur presensi:
  1. Pengguna menekan tombol, browser meminta izin kamera dan lokasi.
  2. Kamera depan tampil live. Model deteksi wajah berjalan terus-menerus.
  3. Indikator: "Wajah terdeteksi" (hijau) atau "Wajah tidak terdeteksi" (merah).
  4. Tombol "Ambil Foto" **hanya aktif jika tepat satu wajah terdeteksi**.
  5. Foto diambil dari frame kamera, dikompres (maks lebar 480px, JPEG kualitas ~0,6, target < 50 KB).
  6. Pratinjau foto, tombol "Kirim" atau "Ulangi".
  7. Kirim ke server bersama koordinat GPS dan akurasi.
- **FR-P3** **Waktu presensi dicatat oleh server** (`now()` di database), bukan dari jam perangkat, agar tidak bisa dimanipulasi.
- **FR-P4** Satu presensi masuk dan satu presensi pulang per hari. Presensi masuk ganda ditolak. Presensi pulang ditolak jika belum presensi masuk.
- **FR-P5** GPS: dicatat latitude, longitude, akurasi, dan **jarak ke kantor (meter)**. Presensi **tetap berhasil walau di luar radius**, tetapi diberi penanda "Di luar radius kantor" dan jarak ditampilkan di laporan.
- **FR-P6** Jika GPS ditolak atau gagal, presensi tetap boleh dilanjutkan dengan penanda "Lokasi tidak tersedia".
- **FR-P7** Jika izin kamera ditolak atau model gagal dimuat, tampilkan panduan berbahasa Indonesia untuk mengaktifkan izin dan tombol "Coba lagi". Presensi tidak bisa dilakukan tanpa kamera.
- **FR-P8** Setelah sukses, tampilkan ringkasan: jam, status (Tepat Waktu atau Terlambat), jarak dari kantor.

### 4.3 Aturan Waktu dan Status
Nilai berikut disimpan di tabel pengaturan dan bisa diubah Administrator.

| Parameter | Nilai awal |
|---|---|
| Jam masuk | 08:00 |
| Jam pulang | 16:00 |
| Toleransi keterlambatan | 0 menit |
| Hari kerja | Senin sampai Jumat |
| Radius kantor (referensi) | 100 meter |

**Status presensi**
- **Hadir Tepat Waktu**: presensi masuk pada atau sebelum jam masuk (+ toleransi).
- **Terlambat**: presensi masuk setelah jam masuk. Simpan menit keterlambatan.
- **Pulang Cepat**: presensi pulang sebelum jam pulang. Simpan menit selisih.
- **Tidak Hadir**: tidak ada presensi masuk pada hari kerja. **Dibuat otomatis oleh pg_cron** setiap hari kerja pukul 23:59 WIB untuk karyawan aktif yang belum punya data.
- **Lupa Presensi Pulang**: ada presensi masuk tetapi tidak ada presensi pulang di akhir hari (ditandai oleh cron yang sama).
- **Hari Libur**: tabel `holidays`. Hari libur dan akhir pekan tidak menghasilkan "Tidak Hadir".

### 4.4 Riwayat Presensi
- **FR-R1** Karyawan melihat riwayat miliknya: daftar per hari dengan jam masuk, jam pulang, status, jarak, dan foto (tap untuk memperbesar).
- **FR-R2** Filter berdasarkan bulan dan rentang tanggal. Pagination.
- **FR-R3** Ringkasan bulanan: jumlah hadir, terlambat, tidak hadir.

### 4.5 Biodata Karyawan
- **FR-B1** Karyawan melihat biodata sendiri (read-only), dan boleh mengubah **foto profil, nomor telepon, dan password**.
- **FR-B2** Field biodata: NIP, nama lengkap, email, nomor telepon, jabatan, departemen, tanggal bergabung, jenis kelamin, alamat, foto profil, status (aktif atau nonaktif), role.

### 4.6 Pengelolaan Data Karyawan (Administrator, Pemilik, Admin HR)
- **FR-K1** Tabel karyawan dengan pencarian (nama, NIP), filter (departemen, status, role), sorting, pagination server-side.
- **FR-K2** Tambah, ubah, nonaktifkan, dan aktifkan kembali karyawan. Hapus permanen hanya Administrator.
- **FR-K3** Reset password karyawan.
- **FR-K4** Impor massal dari CSV/Excel (agar 500 karyawan tidak diinput satu per satu). Sediakan template unduhan dan validasi per baris.
- **FR-K5** Halaman detail karyawan: biodata dan riwayat presensinya.

### 4.7 Dashboard (Pemilik, Administrator, Admin HR)
- Kartu ringkasan hari ini: total karyawan aktif, hadir, terlambat, belum presensi, tidak hadir, di luar radius.
- Grafik tren kehadiran 30 hari terakhir.
- Grafik persentase kehadiran per departemen.
- Daftar 10 presensi terbaru (real-time atau refresh berkala).
- Daftar karyawan paling sering terlambat bulan ini.

### 4.8 Laporan Presensi
- **FR-L1** Laporan **harian**, **mingguan**, **bulanan**, dan **rentang kustom**.
- **FR-L2** Filter: tanggal, departemen, karyawan, status, "di luar radius".
- **FR-L3** Kolom: NIP, nama, departemen, tanggal, jam masuk, jam pulang, status, menit terlambat, jarak (m), tautan foto.
- **FR-L4** Rekap per karyawan: total hadir, terlambat, tidak hadir, pulang cepat, persentase kehadiran.
- **FR-L5** Ekspor **Excel (.xlsx)** dan **PDF**.
- **FR-L6** Tampilan tabel di layar harus tetap nyaman di HP (kartu atau scroll horizontal).

### 4.9 Administrator: Monitoring dan Kontrol Penuh
- **FR-M1** Daftar semua akun (semua role) dengan status, terakhir login, dan aksi: nonaktifkan, reset password, ubah role.
- **FR-M2** **Audit log**: siapa melakukan apa dan kapan (login, buat/ubah/hapus akun, koreksi presensi, ubah pengaturan, ekspor laporan).
- **FR-M3** Koreksi manual data presensi (dengan alasan wajib, tercatat di audit log).
- **FR-M4** Halaman pengaturan: jam kerja, toleransi, hari kerja, koordinat dan radius kantor, daftar hari libur.
- **FR-M5** Pengaturan kebijakan retensi foto (lihat bagian 9).

---

## 5. Model Data (PostgreSQL / Supabase)

```sql
-- Role
create type user_role as enum ('administrator','pemilik','admin_hr','karyawan');
create type attendance_status as enum ('tepat_waktu','terlambat','tidak_hadir');

-- Departemen
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

-- Profil (1:1 dengan auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nip text unique not null,
  full_name text not null,
  email text not null,
  phone text,
  gender text,
  address text,
  position text,
  department_id uuid references departments(id),
  join_date date,
  photo_path text,
  role user_role not null default 'karyawan',
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz default now()
);

-- Presensi (1 baris per karyawan per hari)
create table attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  work_date date not null,
  check_in_at timestamptz,
  check_in_photo text,
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_accuracy real,
  check_in_distance_m real,
  check_out_at timestamptz,
  check_out_photo text,
  check_out_lat double precision,
  check_out_lng double precision,
  check_out_accuracy real,
  check_out_distance_m real,
  status attendance_status,
  late_minutes int default 0,
  early_leave_minutes int default 0,
  missing_checkout boolean default false,
  is_manual_correction boolean default false,
  note text,
  unique (user_id, work_date)
);
create index on attendances (work_date);
create index on attendances (user_id, work_date desc);

-- Pengaturan (1 baris)
create table settings (
  id int primary key default 1,
  work_start time default '08:00',
  work_end time default '16:00',
  late_tolerance_min int default 0,
  work_days int[] default '{1,2,3,4,5}',
  office_lat double precision,
  office_lng double precision,
  office_radius_m int default 100,
  photo_retention_days int default 30,
  check (id = 1)
);

create table holidays (
  holiday_date date primary key,
  name text not null
);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id),
  action text not null,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz default now()
);
```

**Row Level Security (wajib diaktifkan di semua tabel)**
- `karyawan`: hanya `select` baris miliknya di `attendances` dan `profiles`. `insert` presensi hanya lewat server route (bukan langsung dari klien).
- `pemilik`, `admin_hr`: `select` semua `attendances` dan `profiles`.
- `administrator`: akses penuh, termasuk `audit_logs` dan `settings`.
- Gunakan fungsi helper `get_my_role()` (security definer) agar policy tidak rekursif.

**Storage**
- Bucket `attendance-photos` (**private**). Path: `{user_id}/{yyyy-mm-dd}/{in|out}.jpg`.
- Bucket `avatars` (private atau publik terbatas).
- Foto ditampilkan lewat **signed URL** berumur pendek.

---

## 6. Struktur Halaman (Routes SvelteKit)

| Route | Akses | Fungsi |
|---|---|---|
| `/login` | Publik | Form login |
| `/ganti-password` | Login | Wajib saat login pertama |
| `/presensi` | Karyawan | Halaman presensi (kamera, GPS) |
| `/riwayat` | Karyawan | Riwayat presensi pribadi |
| `/profil` | Semua role | Biodata dan ubah password |
| `/dashboard` | Pemilik, Admin, HR | Dashboard |
| `/laporan` | Pemilik, Admin, HR | Laporan dan ekspor |
| `/karyawan` | Pemilik, Admin, HR | Daftar dan kelola karyawan |
| `/karyawan/baru` | Pemilik, Admin, HR | Form buat akun |
| `/karyawan/impor` | Pemilik, Admin, HR | Impor CSV/Excel |
| `/karyawan/[id]` | Pemilik, Admin, HR | Detail dan riwayat karyawan |
| `/admin/akun` | Administrator | Monitoring semua akun |
| `/admin/audit-log` | Administrator | Audit log |
| `/admin/pengaturan` | Administrator | Jam kerja, kantor, hari libur, retensi |

Proteksi route dilakukan di `hooks.server.js` (cek sesi dan role) dan di setiap `+page.server.js`.

---

## 7. Kebutuhan Non-Fungsional

**Responsif**
- Mobile-first. Breakpoint utama: 360px, 768px, 1024px, 1440px.
- Karyawan: navigasi bawah (bottom nav). Admin: sidebar di desktop, drawer di HP.
- Target sentuh minimal 44px. Tabel besar jadi kartu di layar kecil.
- Kamera harus mengisi layar HP dengan rasio benar (portrait), dan berfungsi di Chrome Android serta Safari iOS.

**Performa**
- Halaman presensi siap dipakai < 3 detik di jaringan 4G. Model deteksi wajah dimuat lazy hanya di halaman presensi (dan di-cache).
- Tabel besar memakai pagination server-side, bukan memuat semua data.
- Satu proses presensi (unggah foto + simpan) selesai < 5 detik.

**Keamanan dan privasi**
- Wajib HTTPS (otomatis di Vercel).
- Foto dan lokasi adalah data pribadi: tampilkan **persetujuan (consent)** saat login pertama dan jelaskan tujuan pengumpulan sesuai UU PDP.
- Hanya role berwenang yang bisa melihat foto.
- Validasi input di server (ukuran file maks 200 KB, tipe `image/jpeg`, koordinat valid).
- Jangan percaya waktu dari klien.
- Rate limiting sederhana pada endpoint presensi.

**Ketersediaan (free tier)**
- Cron keep-alive agar proyek Supabase tidak ter-pause setelah 7 hari tidak aktif.

**Kompatibilitas**
- Chrome, Edge, Firefox, Safari versi terbaru dua tahun terakhir.

---

## 8. Alur Utama

**Presensi masuk:** Login, buka `/presensi`, izinkan kamera dan lokasi, wajah terdeteksi, ambil foto, pratinjau, kirim, server mencatat waktu dan menghitung status serta jarak, tampil ringkasan.

**Pembuatan akun:** Admin/Pemilik/HR membuka `/karyawan/baru`, isi biodata dan role, server membuat user lewat Supabase Admin API dan baris `profiles`, sistem menampilkan password awal, karyawan wajib menggantinya saat login pertama.

**Pemantauan pemilik:** Login, buka dashboard, lihat ringkasan hari ini, masuk ke laporan, filter, periksa foto, ekspor.

---

## 9. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Storage foto cepat penuh.** 500 karyawan x 2 foto x ~40 KB = ~40 MB/hari, sehingga kuota 1 GB Supabase habis dalam ~25 hari | Tinggi | (1) Kompres agresif ke 480px. (2) **Retensi otomatis**: hapus foto lebih dari 30 hari via cron, data presensi tetap disimpan. (3) Alternatif: pindah penyimpanan ke Cloudflare R2 (10 GB gratis) |
| Supabase ter-pause saat tidak aktif | Sedang | Cron keep-alive, atau ping terjadwal |
| Titip absen (foto orang lain, foto dari foto) | Sedang | Hanya kamera langsung, deteksi wajah, foto dan GPS tercatat sebagai bukti audit. Liveness detection tidak termasuk cakupan |
| Manipulasi GPS (fake GPS) | Rendah-sedang | GPS tidak jadi syarat, hanya informasi. Akurasi dicatat |
| Izin kamera/GPS ditolak atau iOS Safari bermasalah | Sedang | Panduan izin dan uji di perangkat nyata |
| Lonjakan beban jam 07:45 sampai 08:15 | Sedang | Query ringan, indeks tepat, upload foto langsung ke storage |

---

## 10. Kriteria Penerimaan (MVP)

1. Administrator login, membuat akun Pemilik, Admin HR, dan Karyawan.
2. Karyawan login, ganti password, melakukan presensi masuk dengan foto dan GPS, lalu presensi pulang.
3. Tombol ambil foto tidak aktif ketika tidak ada wajah di kamera.
4. Presensi pukul 08:01 tercatat **Terlambat**, pukul 07:59 tercatat **Tepat Waktu**.
5. Presensi dari luar radius tetap berhasil dan ditandai.
6. Karyawan yang tidak presensi di hari kerja otomatis berstatus **Tidak Hadir** keesokan harinya.
7. Pemilik melihat dashboard, memfilter laporan, melihat foto, dan mengekspor Excel dan PDF.
8. Karyawan tidak bisa mengakses data atau halaman milik karyawan lain (diuji lewat URL langsung dan API).
9. Seluruh halaman nyaman dipakai di lebar 360px.
10. Seluruh teks antarmuka berbahasa Indonesia.

---

## 11. Roadmap Pengerjaan (Urutan Prompt Vibe Coding)

Kerjakan **berurutan**, uji tiap fase sebelum lanjut.

| Fase | Isi | Hasil |
|---|---|---|
| **0. Setup** | Buat proyek SvelteKit + Tailwind, proyek Supabase, repo GitHub, deploy awal ke Vercel, set environment variable | Halaman kosong live di HTTPS |
| **1. Database** | Jalankan skema SQL, RLS, bucket storage, seed administrator pertama dan data departemen | Database siap |
| **2. Auth** | Login, logout, `hooks.server.js`, guard role, ganti password wajib | Login per role berfungsi |
| **3. Layout** | Layout responsif: bottom nav (karyawan), sidebar/drawer (admin) | Kerangka UI |
| **4. Kelola karyawan** | CRUD, buat akun via server route, tabel, pencarian, filter | Admin bisa membuat akun |
| **5. Presensi** | Kamera, MediaPipe face detection, GPS + Haversine, kompres, upload, simpan, logika status | Inti aplikasi selesai |
| **6. Riwayat dan profil** | Riwayat, ringkasan bulanan, biodata | Sisi karyawan lengkap |
| **7. Dashboard** | Kartu ringkasan dan grafik | Sisi pemilik |
| **8. Laporan** | Filter, rekap, ekspor Excel dan PDF | Laporan lengkap |
| **9. Administrator** | Monitoring akun, audit log, pengaturan, koreksi presensi | Kontrol penuh |
| **10. Otomasi** | pg_cron: tidak hadir, lupa pulang, retensi foto, keep-alive | Berjalan mandiri |
| **11. Impor CSV** | Impor massal karyawan | Siap 500 karyawan |
| **12. QA** | Uji di Android dan iOS, uji akses lintas role, uji beban sederhana, perbaikan | Siap serah |

### Contoh prompt pembuka untuk AI coding assistant
> "Kamu adalah senior fullstack developer. Bangun aplikasi presensi karyawan berbasis web sesuai PRD terlampir. Gunakan SvelteKit (JavaScript, bukan TypeScript), Tailwind CSS, Supabase (Auth, PostgreSQL, Storage), dan deploy ke Vercel. Semua teks antarmuka berbahasa Indonesia. Mobile-first. Kerjakan per fase sesuai Roadmap, mulai dari Fase 0. Setelah tiap fase, jelaskan apa yang sudah dibuat dan cara mengujinya. Jangan lanjut ke fase berikutnya sebelum saya konfirmasi."

---

## 12. Asumsi yang Dipakai

- Login memakai **email + password** (NIP disimpan sebagai identitas, bukan untuk login).
- Satu kantor dengan satu titik koordinat.
- Satu jadwal kerja untuk semua karyawan (tanpa shift).
- Face detection bersifat wajib untuk mengambil foto; tidak ada pencocokan identitas.
- Role **Admin HR** ditambahkan sebagai role tambahan di luar Administrator, Pemilik, dan Karyawan. Boleh dihapus jika dirasa berlebihan.