# Modul: `auth-routing`

Mengatur siapa yang boleh masuk, ke portal mana, dan halaman apa yang boleh dibuka. Modul ini juga memaksa langkah onboarding (ganti password, consent, dan perangkat utama).

## Tanggung Jawab

- Login memakai **NIP atau email** + password (NIP diterjemahkan ke email, lalu `signInWithPassword`).
- Verifikasi sesi di setiap request dan memuat `profiles` beserta nama departemen.
- Memisahkan portal: `employee` / `admin` / `development` berdasarkan hostname.
- Guard role per prefix URL dan redirect setelah login.
- Onboarding wajib di `/ganti-password`: password baru, consent privasi (`consent_version = 'v1.0'`), dan pendaftaran Perangkat Utama (khusus karyawan).
- Logout dan paksa keluar akun nonaktif (`?error=inactive`).

## File Kunci

- [`src/hooks.server.js`](../../../src/hooks.server.js): gerbang semua request.
- [`src/lib/server/domains.js`](../../../src/lib/server/domains.js): `portalConfig`, `portalForHost`, `portalUrl`.
- [`src/routes/login/+page.server.js`](../../../src/routes/login/+page.server.js): action login + evaluasi perangkat.
- [`src/routes/ganti-password/+page.server.js`](../../../src/routes/ganti-password/+page.server.js): onboarding.
- [`src/lib/server/supabase.js`](../../../src/lib/server/supabase.js) + [`auth-cache.js`](../../../src/lib/server/auth-cache.js): klien SSR dengan cache verifikasi token.

## API Publik

```js
// hooks.server.js
handle({ event, resolve })            // mengisi event.locals.{supabase, user, profile, safeGetSession}
locals.safeGetSession() -> { session, user, profile }

// domains.js
portalConfig(env, nodeEnv) -> { employeeOrigin, adminOrigin, employeeHost, adminHost, internalHosts }
portalForHost(hostname, config) -> 'employee' | 'admin' | 'development' | null
portalUrl(origin, pathname, search) -> string
```

## Urutan Aturan di `handle`

1. Host tidak dikenal menghasilkan **400 "Host tidak diizinkan"**.
2. Domain karyawan + `/admin*` dialihkan ke domain admin. Domain admin + `/presensi`, `/riwayat`, `/api/presensi` menghasilkan **404**.
3. Belum login: dialihkan ke `/login?redirect=...`.
4. Akun nonaktif: dipaksa `signOut` lalu ke `/login?error=inactive`.
5. `must_change_password`: dipaksa ke `/ganti-password`.
6. Karyawan di domain admin: dipaksa `signOut` (`unauthorized_domain`). Admin di domain karyawan: dialihkan ke dashboard admin.
7. Karyawan hanya boleh membuka `/presensi`, `/riwayat`, `/profil`, `/ganti-password`, `/auth`, `/api`.
8. `/admin/akun`, `/admin/audit-log`, `/admin/pengaturan` hanya untuk `administrator`.
9. Header `server-timing` ditambahkan (durasi sesi, total, mode DB).

## Dependensi

- **Dipakai oleh:** semua route.
- **Memakai:** `@supabase/ssr`, `supabaseAdmin`, `device-auth.js`, `audit.js`.

## Pola Penting / Gotcha

- `safeGetSession()` membagikan satu promise per navigasi GET agar profil tidak dibaca berulang. Untuk POST, cache profil dibatalkan agar data segar setelah mutasi.
- Hasil verifikasi token Supabase di-cache selama 30 detik (`AUTH_CACHE_TTL_MS`) dengan kunci berupa hash SHA-256 dari cookie auth. Cache dibersihkan saat `signOut`/`updateUser`. Tujuannya mengurangi round-trip ke Supabase Cloud.
- Pemisahan domain hanyalah lapisan UX dan isolasi. Pemeriksaan role tetap diulang di setiap action dan endpoint.
