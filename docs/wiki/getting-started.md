# Getting Started

## Prasyarat

- Node.js **22.x** (`engines` di `package.json`) dan npm.
- Proyek Supabase (Auth + Storage, dan Postgres bila tidak memakai DB lokal).
- Opsional untuk produksi: VPS Ubuntu/Debian + Docker Compose + domain (2 subdomain).

## Instalasi

```sh
npm ci
copy .env.example .env   # lalu isi nilainya
```

Variabel penting di `.env`:

| Variabel | Fungsi |
|---|---|
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | klien SSR (aman untuk publik) |
| `SUPABASE_SECRET_KEY` | Admin API, **hanya server** |
| `DATABASE_URL` | jika diisi, query tabel diarahkan ke PostgreSQL lokal |
| `EMPLOYEE_ORIGIN`, `ADMIN_ORIGIN`, `INTERNAL_HOSTS` | domain portal |
| `EMPLOYEE_DOMAIN`, `ADMIN_DOMAIN` | domain yang dilayani Caddy |
| `AUTH_CACHE_TTL_MS`, `LOCAL_DB_CACHE_TTL_MS` | TTL cache (default 30 detik / 10 detik) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | notifikasi Telegram |
| `INITIAL_ADMIN_*` / `ROTATION_ADMIN_*` | bootstrap / rotasi administrator (hapus setelah dipakai) |

## Menjalankan Pertama Kali

```sh
npm run dev           # http://localhost:5173 (localhost otomatis dianggap host "development")
npm test              # 72 tes, harus lulus semua
```

Urutan setup database baru:

```sh
# 1. Terapkan file supabase/migrations/*.sql secara berurutan di Supabase SQL Editor
npm run check:supabase
npm run check:database
npm run admin:bootstrap   # buat administrator pertama
```

## Produksi (VPS)

```sh
docker compose --profile caddy up -d --build
docker compose --profile tools run --rm admin-tools npm run admin:bootstrap
```

Panduan lengkap: [`docs/deployment-vps.md`](../../docs/deployment-vps.md) dan portal dokumentasi di GitHub Pages.

## Alur Kerja Umum

- **Tambah karyawan:** login admin, buka `/admin/karyawan/baru` atau `/admin/karyawan/impor` (CSV).
- **Ganti administrator:** isi `ROTATION_ADMIN_*`, jalankan `npm run admin:rotate`, lalu hapus variabelnya.
- **Sinkron cloud ke lokal:** `npm run db:sync:local`.
- **Cek tipe & komponen:** `npm run check`.

## Lanjut Baca

- [architecture.md](architecture.md)
- [Peta modul](README.md#peta-modul)
