# Awal Mula, Langkah Pertama, dan Alasan Pemilihan Tech Stack

Dokumen ini merangkum **cerita di balik proyek** berdasarkan [`PRD.md`](../../PRD.md), riwayat 33 commit Git, dan migrasi database. Bagian ini disiapkan untuk menjawab pertanyaan presentasi.

## 1. Awal Mula (Masalah yang Ingin Diselesaikan)

- **Target:** satu perusahaan (PT Trisula Prima Agung, terlihat dari domain `*.trisulaprimaagung.my.id`) dengan **500 karyawan** dan kapasitas desain **1.000 karyawan**.
- **Tiga tuntutan utama di PRD:**
  1. Bukti kehadiran yang sulit dipalsukan: foto langsung dari kamera (ada wajah) + lokasi GPS + waktu dari server.
  2. Pemantauan real-time dan laporan yang mudah diekspor (Excel/PDF) untuk manajemen.
  3. **Biaya operasional serendah mungkin** (target awal Rp0 di free tier, lalu VPS hemat), **mobile-first** tanpa perlu install aplikasi dari Play Store / App Store, dan antarmuka penuh Bahasa Indonesia (WIB).
- **Batasan cakupan yang disengaja:** hanya **deteksi ada/tidaknya wajah** (bukan face recognition pencocok identitas), belum mencakup cuti/izin/penggajian. Pembatasan ini menjaga sistem tetap ringan dan selesai tepat waktu.

## 2. Langkah Pertama Kali yang Dilakukan

Urutan kerja dirancang di PRD Bagian 11 (*Roadmap Pengerjaan*) dan terlihat jelas di riwayat file:

| Urutan | Langkah | Bukti di Repo |
|---|---|---|
| **1. Menulis PRD** | Mengunci kebutuhan, model data, matriks role, risiko (terutama kuota storage foto), dan kriteria penerimaan sebelum menulis kode | [`PRD.md`](../../PRD.md) |
| **2. Fase 0: Kerangka & HTTPS** | Inisialisasi SvelteKit 2 + Svelte 5 + Tailwind v4, struktur route, pemeriksaan `svelte-check` | `package.json`, `svelte.config.js` |
| **3. Fase 1: Database & Keamanan dulu** | Menulis skema SQL lengkap dengan `CHECK constraint`, `UNIQUE`, fungsi helper `private.get_my_role()` / `get_app_role()`, RLS semua tabel, bucket private, skrip bootstrap admin, dan **tes database lokal memakai PGlite** sebelum menyentuh UI login/presensi | [`20261007000100_initial_schema.sql`](../../supabase/migrations/20261007000100_initial_schema.sql), [`docs/fase-1-database.md`](../../docs/fase-1-database.md), [`tests/database.test.mjs`](../../tests/database.test.mjs) |
| **4. Prototipe Desain UI** | Membuat referensi HTML & prototipe interaktif FigCraft untuk seluruh route (mobile 360px & desktop) | `Referensi UI...html`, `design/wireframe-presensi.figcraft`, commit `c1bcfe9` |
| **5. Auth, Onboarding, lalu Inti Presensi** | `hooks.server.js`, login NIP/email, ganti password + consent wajib, kamera + MediaPipe + Haversine + kompresi foto | `src/hooks.server.js`, `src/routes/presensi/` |
| **6. Backoffice & Laporan** | Dashboard, CRUD karyawan, impor CSV, laporan + ekspor Excel/PDF, audit log, pengaturan | `src/routes/admin/` |

**Prinsip yang layak ditekankan saat presentasi:** *"Kami tidak mulai dari tampilan. Kami mulai dari PRD, lalu mengunci aturan bisnis di level database (constraint & RLS) dan mengujinya dengan 72 automated test."*

## 3. Evolusi Penting Selama Pengembangan (Berdasarkan Git Log)

Sistem tidak berhenti di rancangan awal PRD. Ada lima penyempurnaan besar yang muncul dari kebutuhan nyata:

1. **Lokasi kerja per karyawan + anti-fake-GPS** (`20261008...`): karyawan lapangan bisa punya titik koordinat sendiri. Server memeriksa mock GPS, akurasi tidak wajar (< 1,5 m), dan selisih timestamp GPS.
2. **Device binding / Anti-Joki + Telegram** (`20261008...`, commit `0b8a828`, `2a6e383`): satu akun terikat ke satu Perangkat Utama lewat konfirmasi eksplisit. Login atau presensi dari perangkat lain memicu peringatan 409 dan notifikasi ke HR serta grup Telegram.
3. **Dari Vercel ke VPS Docker + Caddy** (15 Nov, commit `986b567`): memberi kontrol penuh atas dua subdomain, header keamanan, dan database lokal.
4. **Administrator tunggal + pemisahan domain** (16 Nov, commit `aa7f6b0`, `97105ba`, `e2b0271`): role disederhanakan menjadi 3 (`administrator`, `admin_hr`, `karyawan`). Hanya boleh ada **satu** administrator (dijaga index + trigger), tidak bisa diubah dari UI, dan hanya bisa diganti lewat CLI rotasi atomik. Portal karyawan (`presensi.`) dan admin (`admin.`) dipisahkan per subdomain.
5. **Database Hybrid: PostgreSQL lokal VPS + Supabase Auth/Storage** (23 Nov, commit `2195d9a`, `1ba44d1`): karena server Supabase Cloud berada jauh (Sydney), navigasi terasa lambat. Dibuat `LocalQueryBuilder` ke Postgres lokal di VPS (< 2 ms) + cache verifikasi token 30 detik + query halaman paralel `Promise.all`.

## 4. Kenapa Memilih Tech Stack Ini?

| Pilihan | Kenapa dipilih | Alternatif yang tidak dipilih & alasannya |
|---|---|---|
| **SvelteKit 2 + Svelte 5 (JavaScript)** | Dikompilasi menjadi JS kecil tanpa runtime Virtual DOM, sehingga cepat di HP karyawan kelas entry-level. Satu repo mencakup UI dan server route. Memakai JS + JSDoc (`svelte-check`) agar pengembangan cepat namun tetap diperiksa tipenya | **Next.js/React**: runtime lebih berat. **Aplikasi native (Flutter/RN)**: karyawan harus install dari Play Store/App Store, dan update lambat |
| **Tailwind CSS 4** | Mudah membuat tampilan mobile-first (360px) dengan tema korporat hangat (`--color-paper`, `--color-brand`) | Component library besar: ukuran bundle membengkak |
| **PostgreSQL (Supabase + PG 16 lokal)** | Constraint relasional kuat (`CHECK`, `UNIQUE`, trigger, advisory lock), RLS, ditambah kecepatan lokal < 2 ms lewat arsitektur hybrid | **NoSQL (Firebase/Mongo)**: aturan relasional dan agregasi laporan jauh lebih rumit. **Full cloud**: latensi lintas negara |
| **Supabase Auth & Storage** | Auth matang (cookie SSR, Admin API) dan Storage mendukung private bucket + signed URL 60 detik tanpa perlu membuat server file sendiri | Simpan file di disk VPS: berisiko saat rebuild container dan tidak ada signed URL bawaan |
| **MediaPipe `@mediapipe/tasks-vision` (BlazeFace WASM)** | Berjalan **100% di browser** karyawan (GPU/CPU HP). Biaya server untuk AI = **Rp0**, tanpa antrean server pada jam sibuk 07:45â€“08:00, dan dimuat lazy hanya di halaman `/presensi` | **Face recognition di server (Python/OpenCV/AWS Rekognition)**: butuh GPU atau biaya per request, serta lambat saat 500 orang absen bersamaan |
| **Kompresi Canvas (480px, JPEG 0.65)** | Ukuran foto turun ke < 50 KB. 500 karyawan Ã— 2 foto/hari menjadi sekitar 40 MB/hari, sehingga hemat bandwidth dan storage | Upload foto asli kamera (3â€“8 MB): kuota 1 GB habis dalam setengah hari |
| **Rumus Haversine (`geo.js`)** | Menghitung jarak bola bumi dalam 20 baris JS murni tanpa biaya API pihak ketiga | Google Distance Matrix API: berbayar per request dan lambat |
| **ExcelJS + jsPDF (dynamic import)** | Laporan dibuat di browser saat tombol diklik, tanpa membebani server dan bundle awal | Generate PDF di server (Puppeteer): makan RAM ratusan MB di VPS |
| **PGlite + `node:test`** | Menjalankan 72 tes (termasuk PostgreSQL asli di memori) dalam ~11 detik tanpa perlu menyalakan Docker saat testing | Jest + DB eksternal: lambat dan butuh setup |
| **Docker Compose + Caddy** | Satu perintah deploy, HTTPS Let's Encrypt otomatis (wajib untuk kamera & GPS), dan hemat RAM | Kubernetes: terlalu rumit untuk satu perusahaan |
