# Modul: `data-access`

Lapisan akses data server. Satu objek `supabaseAdmin` bisa dipanggil seperti klien Supabase, tetapi diam-diam mengarahkan query tabel ke **PostgreSQL lokal VPS**, sedangkan Auth dan Storage tetap memakai **Supabase Cloud**.

## Tanggung Jawab

- Membuat klien Supabase berhak penuh (secret key) secara lazy, saat runtime, bukan saat build Docker.
- Jika `DATABASE_URL` diisi, `.from()`, `.rpc()`, `isLocalPg`, dan `invalidateCache` diarahkan ke klien lokal berbasis `pg`.
- Menyediakan *query builder* kompatibel PostgREST (`select` dengan relasi, `eq`, `gte`, `lte`, `or`, `order`, `range`, `single`, `maybeSingle`, `insert`, `update`, `delete`, `count`).
- Cache tabel yang sering dibaca (`HotTableCache`, TTL default 10 detik).

## File Kunci

- [`src/lib/server/admin.js`](../../../src/lib/server/admin.js): Proxy hybrid `supabaseAdmin`.
- [`src/lib/server/local-db.js`](../../../src/lib/server/local-db.js) (564 baris): `LocalQueryBuilder`, `HotTableCache`, `createLocalDbClient()`.
- [`src/lib/server/supabase.js`](../../../src/lib/server/supabase.js): klien SSR per request (cookie user, publishable key).
- [`scripts/sync-supabase-to-local.mjs`](../../../scripts/sync-supabase-to-local.mjs): menyalin data cloud ke lokal (`npm run db:sync:local`).

## API Publik

```js
supabaseAdmin.from(table)...      // lokal jika DATABASE_URL ada, cloud jika tidak
supabaseAdmin.rpc(fn, args)
supabaseAdmin.auth.admin.*        // selalu Supabase Cloud
supabaseAdmin.storage.from(b)...  // selalu Supabase Cloud
supabaseAdmin.isLocalPg           // true/undefined
supabaseAdmin.invalidateCache(table?)
createLocalDbClient({ queryFn?, pool?, databaseUrl?, cacheTtlMs? })
```

## Struktur Internal

- **Whitelist tabel**: `departments, profiles, attendances, settings, holidays, audit_logs, user_devices, notifications`. Tabel lain ditolak.
- **Validasi identifier** dengan regex `^[a-z_][a-z0-9_]*$`, dan nilai dikirim sebagai parameter `$n`. Keduanya mencegah SQL injection lewat nama kolom.
- Relasi `profile:profiles(...)` dan `department:departments(...)` diterjemahkan menjadi JOIN.
- Kolom `DATE` dikembalikan sebagai string `YYYY-MM-DD` agar sama persis dengan output PostgREST.

## Dependensi

- **Dipakai oleh:** hampir semua `+page.server.js`, `+server.js`, `audit.js`, `notifications.js`, `telegram.js`.
- **Memakai:** `@supabase/supabase-js`, `pg`.

## Pola Penting / Gotcha

- RLS Supabase **tidak berlaku** untuk akses server. Secret key dan koneksi `pg` lokal sama-sama melewati RLS. Otorisasi efektif ada di `hooks.server.js` dan pemeriksaan role di setiap action. RLS tetap menjadi lapisan pertahanan untuk akses langsung ke Supabase dengan token user.
- Dua sumber data (cloud dan lokal) bisa berbeda isi jika sinkronisasi tidak dijalankan. Skrip admin (rotasi/bootstrap) ikut menyinkronkan ke lokal.
- Dikenalkan pada commit `2195d9a` *perf(db): migrate operational queries to local VPS PostgreSQL with hybrid Supabase Auth/Storage*.
