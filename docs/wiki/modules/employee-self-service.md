# Modul: `employee-self-service`

Halaman karyawan di luar presensi: riwayat kehadiran dan profil pribadi.

## Tanggung Jawab

- `/riwayat`: daftar presensi per bulan (`?bulan=YYYY-MM`) + ringkasan hadir tepat waktu / terlambat / tidak hadir. Foto dibuka lewat signed URL.
- `/profil`: lihat biodata (read-only), ubah **telepon & alamat**, ubah password (minimal 8 karakter).

## File Kunci

- [`src/routes/riwayat/+page.server.js`](../../../src/routes/riwayat/+page.server.js)
- [`src/routes/profil/+page.server.js`](../../../src/routes/profil/+page.server.js): action `updateBiodata`, `updatePassword`.
- [`src/routes/api/storage/signed-url/+server.js`](../../../src/routes/api/storage/signed-url/+server.js): URL foto yang berlaku 60 detik. Karyawan hanya boleh meminta path yang diawali `{user_id}/`.
- [`src/routes/+layout.svelte`](../../../src/routes/+layout.svelte): navigasi bawah (karyawan) dan sidebar (admin).

## Dependensi

- **Memakai:** `supabaseAdmin`, `audit.js` (`update_biodata`, `change_password`).

## Gotcha

- Query riwayat difilter `user_id = user.id` di server, jadi karyawan tidak bisa melihat data orang lain walaupun mengubah URL.
- Rentang bulan memakai `-01` sampai `-31`. Perbandingan string tanggal tetap benar untuk bulan yang lebih pendek.
