# Modul: `deployment-ops`

Cara aplikasi dibangun, dijalankan di produksi, dan dirawat: Docker, Caddy, skrip admin, dan pengujian.

## File Kunci

- [`Dockerfile`](../../../Dockerfile): multi-stage `node:22-alpine` (deps, build, `npm prune --omit=dev`, runner). Berjalan sebagai user non-root `app`, perintah `node build`.
- [`compose.yml`](../../../compose.yml): layanan:
  - `postgres` (16-alpine, TZ Asia/Jakarta, tuning memori kecil, `max_connections=30`, init dari `local_schema.sql`, healthcheck).
  - `app` (port `127.0.0.1:3002`, `BODY_SIZE_LIMIT=10M`, `DATABASE_URL` ke postgres, healthcheck ke `/login`).
  - `admin-tools` (profil `tools`, image `Dockerfile.admin` untuk skrip).
  - `caddy` (profil `caddy`, port 80/443/443-udp).
- [`Caddyfile`](../../../Caddyfile): dua domain ke `app:3000`, `encode zstd gzip`, header keamanan.
- [`svelte.config.js`](../../../svelte.config.js): `adapter-node` dengan `precompress: true`.
- [`docs/deployment-vps.md`](../../../docs/deployment-vps.md) + portal HTML `docs/*.html` (GitHub Pages).

## Skrip npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `preview` | pengembangan dan build |
| `npm run check` | `svelte-check` (JS + JSDoc) |
| `npm test` | `node --test tests/*.test.mjs` (72 tes) |
| `npm run check:supabase` / `check:database` | cek koneksi & skema cloud |
| `npm run admin:bootstrap` | membuat administrator pertama (trigger `bootstrap_first_admin`) |
| `npm run admin:rotate` | ganti administrator secara atomik (+ sinkron ke DB lokal) |
| `npm run db:migrate:local` | menerapkan skema ke PostgreSQL lokal |
| `npm run db:sync:local` | salin data Supabase Cloud ke lokal (paginasi 1.000 baris, urut PK) |

## Tes (`tests/`)

| File | Menguji |
|---|---|
| `database.test.mjs` | skema, constraint, RLS per role (PGlite) |
| `single-administrator-roles.test.mjs`, `rotate-admin.test.mjs`, `bootstrap-admin.test.mjs` | administrator tunggal, rotasi, bootstrap |
| `domains.test.mjs` | pemisahan portal per host |
| `device-and-location.test.mjs` | Haversine, parser Google Maps, evaluasi/registrasi perangkat |
| `employee-creation.test.mjs`, `employee-schema-repair.test.mjs` | pembuatan akun & perbaikan kolom |
| `local-db.test.mjs` | query builder lokal |
| `navigation-performance.test.mjs` | deduplikasi sesi & query paralel |
| `visual-consistency.test.mjs` | konsistensi tema UI |

## Gotcha

- Kamera/GPS butuh HTTPS. Pastikan DNS sudah mengarah ke VPS sebelum Caddy menerbitkan sertifikat.
- Bisa juga dipasang di belakang Nginx yang sudah ada (tanpa profil `caddy`).
- PRD awal menargetkan Vercel. Implementasi akhir pindah ke **VPS + Docker** (commit `986b567`, 15 Nov) agar bisa menjalankan PostgreSQL lokal dan mengontrol domain/header sendiri.
