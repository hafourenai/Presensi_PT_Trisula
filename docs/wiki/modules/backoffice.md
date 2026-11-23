# Modul: `backoffice`

Portal `admin.<domain>` untuk Administrator dan Admin HR: memantau kehadiran, mengelola karyawan, membuat laporan, dan mengatur sistem.

## Halaman

| Route | Akses | Fungsi | File |
|---|---|---|---|
| `/admin/dashboard` | Admin, HR | Kartu hari ini, 10 presensi terbaru, top 5 terlambat bulan ini, 5 notifikasi terbaru | [`dashboard/+page.server.js`](../../../src/routes/admin/dashboard/+page.server.js) |
| `/admin/karyawan` | Admin, HR | Tabel karyawan: cari (nama/NIP/email), filter departemen/status, pagination 10/halaman | [`karyawan/+page.server.js`](../../../src/routes/admin/karyawan/+page.server.js) |
| `/admin/karyawan/baru` | Admin, HR | Buat akun (role `admin_hr`/`karyawan`), lokasi kerja khusus opsional | [`karyawan/baru/+page.server.js`](../../../src/routes/admin/karyawan/baru/+page.server.js) |
| `/admin/karyawan/impor` | Admin, HR | Impor massal CSV `NIP,Nama,Email,Password,Departemen,Jabatan`, laporan error per baris | [`karyawan/impor/+page.server.js`](../../../src/routes/admin/karyawan/impor/+page.server.js) |
| `/admin/karyawan/[id]` | Admin, HR | Detail + 10 presensi terakhir + perangkat. Aksi: aktif/nonaktif, reset password, ubah lokasi, hapus, kelola perangkat | `karyawan/[id]/+page.server.js` |
| `/admin/laporan` | Admin, HR | Filter tanggal/departemen/karyawan/status/di luar radius, rekap per karyawan, ekspor **Excel** & **PDF** | [`laporan/+page.server.js`](../../../src/routes/admin/laporan/+page.server.js) |
| `/admin/akun` | Administrator | Semua akun + perangkat. Ubah role, hapus akun, reset perangkat | [`akun/+page.server.js`](../../../src/routes/admin/akun/+page.server.js) |
| `/admin/pengaturan` | Administrator | Jam kerja, toleransi, koordinat & radius kantor, retensi foto, hari libur | [`pengaturan/+page.server.js`](../../../src/routes/admin/pengaturan/+page.server.js) |
| `/admin/audit-log` | Administrator | Jejak aktivitas | [`audit-log/+page.server.js`](../../../src/routes/admin/audit-log/+page.server.js) |

## Perhitungan Dashboard

- `totalActiveEmployees`: jumlah `profiles` dengan role karyawan dan aktif.
- `totalHadir = tepat_waktu + terlambat`, `belumPresensi = aktif âˆ’ hadir âˆ’ tidak_hadir`.
- `diLuarRadius`: jarak masuk atau pulang melebihi `settings.office_radius_m`.
- `perangkatTidakDikenal`: jumlah presensi dengan `is_unrecognized_device`.
- Lima query dijalankan **paralel** dengan `Promise.all` (commit `1ba44d1`, *perf: parallelize page queries*).

## Laporan & Ekspor

- Rekap per karyawan: total hari, hadir, tepat waktu, terlambat (+menit), tidak hadir, pulang cepat (+menit), di luar radius, `attendanceRate = hadir / total hari Ã— 100`.
- Excel: `exceljs` dan PDF: `jspdf` + `jspdf-autotable`. Keduanya di-*import* dinamis di browser hanya saat tombol ekspor ditekan, sehingga bundle awal tetap kecil.

## Pola Penting / Gotcha

- Setiap action memeriksa ulang role aktor (`['administrator','admin_hr'].includes(actor.role)` atau `=== 'administrator'`), tidak hanya mengandalkan guard di hooks.
- Semua perubahan penting tercatat di `audit_logs` (`create_employee_account`, `bulk_import_employees`, `update_system_settings`, `add_holiday`, ...).
- Akun administrator tidak bisa diubah dari UI ("hanya dapat diubah melalui rotasi CLI").
- Impor CSV memakai `split(',')` sederhana, sehingga nilai yang mengandung koma tidak didukung. Pembuatan akun dilakukan berurutan per baris.
- `chart.js` tercantum di `package.json` tetapi belum dipakai. Grafik tren 30 hari dari PRD belum dibuat. Dashboard saat ini berupa kartu dan daftar.
