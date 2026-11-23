# Presensi Karyawan (repo `absen`)

Aplikasi web presensi internal untuk satu perusahaan (target 500, kapasitas desain 1.000 karyawan). Karyawan melakukan presensi **masuk** dan **pulang** dari browser HP: selfie langsung dari kamera yang hanya bisa diambil bila **tepat satu wajah** terdeteksi (MediaPipe, berjalan di browser), dilengkapi koordinat GPS, jarak ke lokasi kerja (Haversine), dan identitas perangkat. Server mencatat waktu presensi memakai jam server (WIB), menghitung status *Tepat Waktu / Terlambat / Pulang Cepat*, memberi tanda pada lokasi mencurigakan dan perangkat asing, lalu memberi tahu HR lewat notifikasi in-app dan Telegram. Admin HR dan Administrator memantau lewat portal backoffice terpisah: dashboard, kelola karyawan, laporan beserta ekspor Excel/PDF, akun, pengaturan, dan audit log.

> Snapshot kode: commit `2a6e383` (23 Nov 2026), 33 commit sejak 28 Okt 2026. Sekitar 9,4 ribu baris kode di `src/`, 948 baris SQL, 1.365 baris tes (72 tes, semuanya lulus).

## Konsep Kunci

- **Dua portal, satu codebase.** `presensi.<domain>` untuk karyawan, `admin.<domain>` untuk backoffice. Pemisahan dilakukan berdasarkan hostname di `hooks.server.js`.
- **Tiga role efektif.** `administrator` (tepat satu akun, dijaga di level database), `admin_hr`, dan `karyawan`. Role `pemilik` dari PRD sudah dimigrasikan menjadi `admin_hr`.
- **Satu baris presensi per karyawan per hari.** Dijamin oleh `unique (user_id, work_date)` di tabel `attendances`.
- **Perangkat utama (device binding).** Karyawan wajib mendaftarkan satu perangkat utama saat login pertama. Perangkat lain tetap boleh dipakai, tetapi ditandai `unrecognized_device` dan HR diberi tahu (fitur "anti-joki").
- **Penanda lokasi, bukan pemblokiran.** Presensi di luar radius atau dengan GPS mencurigakan tetap diterima, tetapi diberi tanda (`location_flags`, `is_suspicious_location`) untuk ditinjau HR.
- **Database hybrid.** Query operasional berjalan ke PostgreSQL lokal di VPS. Auth dan penyimpanan foto tetap di Supabase Cloud.

## Entry Point

- [`src/hooks.server.js`](../../src/hooks.server.js): dijalankan di setiap request. Membaca sesi, memuat profil, memisahkan portal per domain, dan menjaga akses route per role.
- [`src/routes/presensi/+page.svelte`](../../src/routes/presensi/+page.svelte): layar inti karyawan (kamera, deteksi wajah, GPS, kirim).
- [`src/routes/api/presensi/+server.js`](../../src/routes/api/presensi/+server.js): endpoint pencatat presensi beserta logika anti-fraud.
- [`src/lib/server/admin.js`](../../src/lib/server/admin.js): klien data server-side `supabaseAdmin` (hybrid lokal/cloud).
- [`compose.yml`](../../compose.yml): stack produksi (Postgres 16, app Node 22, Caddy, admin-tools).

## Arsitektur Singkat

SvelteKit 2 (Svelte 5, JavaScript) menjalankan halaman dan server routes dalam satu proses Node (`adapter-node`) di container Docker, di belakang Caddy yang mengurus HTTPS. Browser mengerjakan bagian yang berat dan butuh hardware: kamera, deteksi wajah, GPS, dan kompresi foto. Server mengerjakan bagian yang harus dipercaya: waktu, status, jarak, verifikasi perangkat, dan penyimpanan. Selengkapnya ada di [architecture.md](architecture.md).

## Peta Modul

| Modul | Fungsi |
|---|---|
| [`auth-routing`](modules/auth-routing.md) | Login (NIP/email), ganti password wajib, consent UU PDP, guard role & domain |
| [`presensi`](modules/presensi.md) | Kamera + MediaPipe + GPS di browser, endpoint `/api/presensi` |
| [`device-binding`](modules/device-binding.md) | Perangkat utama, deteksi perangkat asing (anti-joki) |
| [`data-access`](modules/data-access.md) | `supabaseAdmin` hybrid: PostgreSQL lokal + Supabase Cloud, cache |
| [`database`](modules/database.md) | Skema SQL, constraint, RLS, storage, administrator tunggal |
| [`backoffice`](modules/backoffice.md) | Dashboard, karyawan, impor CSV, laporan & ekspor, akun, pengaturan, audit |
| [`employee-self-service`](modules/employee-self-service.md) | Riwayat bulanan, profil, ganti password |
| [`notifications`](modules/notifications.md) | Notifikasi in-app + bot Telegram |
| [`deployment-ops`](modules/deployment-ops.md) | Docker, Caddy, skrip admin (bootstrap/rotasi/sync), tes |

## Dokumen Lain

- [architecture.md](architecture.md): arsitektur, data flow, dan keputusan desain
- [business-flow.md](business-flow.md): alur bisnis dan aturan status
- [diagrams/sequences.md](diagrams/sequences.md): sequence diagram alur utama
- [diagrams/class-diagram.md](diagrams/class-diagram.md): model data dan modul
- [api.md](api.md): endpoint HTTP dan form action
- [getting-started.md](getting-started.md): instalasi dan perintah
- [history-and-decisions.md](history-and-decisions.md): awal mula proyek, langkah pertama, dan alasan pemilihan stack
- [presentasi/](presentasi/): file PPT dan naskah narasi presentasi
