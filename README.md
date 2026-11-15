# Presensi Karyawan

Aplikasi presensi internal perusahaan sesuai [PRD.md](./PRD.md). Antarmuka berbahasa Indonesia, mobile-first, zona waktu aplikasi Asia/Jakarta.

## Status

Aplikasi menggunakan SvelteKit 2 + Svelte 5, Tailwind CSS 4, Supabase Cloud, dan adapter Node. Deployment produksi tersedia melalui Docker Compose dengan Caddy sebagai reverse proxy dan pengelola HTTPS otomatis.

**Fase 1:** migrasi database/RLS/storage, seed departemen, skrip bootstrap administrator, dan tes lokal sudah tersedia. Penerapan SQL dan pembuatan administrator di Supabase cloud masih menunggu langkah pengguna pada [panduan Fase 1](./docs/fase-1-database.md). Autentikasi dan fitur presensi belum diimplementasikan.

Arahan desain pengguna: gunakan UI UX Pro Max pada fase desain dan sediakan HTML untuk impor Figma. Lihat [catatan handoff desain](./docs/design-handoff.md).

## Menjalankan lokal

Gunakan Node.js 22.x dan npm. Proyek ini kompatibel dengan Node.js 22.13.1 yang tersedia saat setup; disarankan memakai patch Node.js 22 terbaru.

```sh
npm ci
npm run dev
```

Buka URL yang dicetak terminal (umumnya `http://localhost:5173`). Halaman awal bisa berjalan tanpa environment Supabase. Pengisian environment pada tahap ini menyiapkan fase berikutnya, belum melakukan koneksi database.

```sh
npm run check
npm run build
npm run preview
```

`check` memeriksa JavaScript/JSDoc dan komponen Svelte. Paket TypeScript hanya digunakan sebagai alat pemeriksaan; kode aplikasi menggunakan JavaScript. `build` menghasilkan server Node di direktori `build`. `preview` untuk memeriksa hasil build lokal.

## Mendapatkan environment Supabase

1. Masuk ke <https://supabase.com/dashboard>.
2. Buat **New project** pada organisasi milik Anda, pilih paket Free jika tersedia, beri nama proyek (misalnya `presensi-karyawan`), dan simpan password database. Pilih region Singapore jika tersedia, agar dekat dengan server aplikasi.
3. Tunggu proyek siap. Buka **Connect**, lalu salin **Project URL**.
4. Buka **Settings → API Keys**. Salin **Publishable key** (`sb_publishable_...`). Buat key jika belum tersedia.
5. Di halaman yang sama, buat/salin **Secret key** (`sb_secret_...`) untuk akses Admin API dari server.
6. Salin file `.env.example` menjadi `.env` di folder utama proyek melalui editor, lalu isi:

```dotenv
PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ISI_DARI_DASHBOARD
SUPABASE_SECRET_KEY=sb_secret_ISI_DARI_DASHBOARD
```

Nilai di atas hanya contoh. Password database bukan API key dan belum diperlukan di `.env` ini. Key `secret` menggantikan peran key legacy `service_role` yang disebut dalam PRD; penggunaannya tetap hanya di server. Supabase kini merekomendasikan publishable/secret untuk proyek baru.

Simpan secret key langsung di `.env` atau pengaturan environment Vercel, bukan di chat. Jangan beri prefix `PUBLIC_` pada secret key. `.gitignore` sudah mengecualikan `.env` beserta varian lokalnya. Setelah mengubah environment, restart `npm run dev`.

Sumber: <https://supabase.com/docs/guides/api/api-keys>.

## Repository GitHub

GitHub CLI belum tersedia pada lingkungan setup ini. Untuk menyiapkan repository lewat GitHub Desktop:

1. Login ke GitHub Desktop.
2. Pilih **File → New repository**, nama `absen`, lokasi induk `D:\` sehingga lokasi repository adalah folder proyek `D:\absen`.
3. Periksa daftar perubahan. Pastikan `.env`, `node_modules`, `.svelte-kit`, dan `.vercel` tidak ikut.
4. Buat commit awal, kemudian **Publish repository**. Gunakan repository private untuk proyek internal.

Jika Anda menggunakan alur Git lain, unggah isi folder proyek sebagai root repository (file `package.json` berada di root).

## Deployment VPS

Deployment produksi menggunakan image Node.js 22, Docker Compose, dan Caddy. VPS hanya perlu Docker, Docker Compose, Git, domain yang sudah mengarah ke VPS, dan port 80/443 terbuka. Ikuti [panduan deployment VPS lengkap](./docs/deployment-vps.md).

## Pemeriksaan Fase 0

- `npm run check` selesai tanpa error.
- `npm run build` menghasilkan output Vercel.
- Halaman `/` tampil dalam bahasa Indonesia.
- Periksa tampilan di browser pada lebar 360px dan desktop.
- Setelah deploy, URL HTTPS memuat halaman yang sama.
- Isi `.env` untuk melanjutkan setup database dan autentikasi.

Urutan pekerjaan berikutnya mengikuti bagian 11 PRD: Fase 1 adalah skema SQL, RLS, storage, serta administrator awal. Fitur login belum tersedia pada fase ini.

## Perintah Fase 1

```sh
npm test
npm run check:supabase
npm run check:database
npm run seed:admin
```

`seed:admin` hanya dijalankan setelah migrasi cloud berhasil dan empat `INITIAL_ADMIN_*` pada `.env` terisi. Ikuti [panduan Fase 1](./docs/fase-1-database.md) secara berurutan.
