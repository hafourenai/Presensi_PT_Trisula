# Roadmap: administrator tunggal dan pemisahan domain

## Status

Dokumen ini adalah rencana implementasi, **belum diterapkan**. Agent berikutnya harus membaca skema database, route guards, dan test yang ada sebelum mengubah kode.

## Tujuan akhir

| Pengguna | URL produksi |
|---|---|
| Karyawan | `https://presensi.trisulaprimaagung.my.id` |
| Administrator dan backoffice | `https://admin.trisulaprimaagung.my.id` |
| Dokumentasi | `https://hafourenai.github.io/Presensi_PT_Trisula/` |

Aturan utama:

1. Hanya boleh ada tepat satu akun dengan role `administrator`.
2. Administrator tidak dapat dibuat, dipromosikan, diturunkan, dinonaktifkan, atau dihapus melalui UI umum.
3. Role lain tidak boleh memiliki kewenangan penuh yang setara administrator.
4. Environment VPS hanya digunakan untuk bootstrap atau rotasi terkontrol. Password tidak boleh dibaca dari `.env` pada setiap login.
5. Supabase Auth tetap menjadi sumber autentikasi setelah bootstrap.
6. Pemisahan domain tidak menggantikan pemeriksaan authorization pada server.

## Model role target

Gunakan hanya role berikut:

- `administrator`: tepat satu akun, akses konfigurasi sistem dan audit penuh.
- `admin_hr`: operator backoffice dengan akses operasional terbatas.
- `karyawan`: akses presensi dan data pribadi.

Role `pemilik` direncanakan untuk dihapus atau dimigrasikan menjadi `admin_hr`. Saat ini terdapat inkonsistensi `hr` pada aplikasi dan `admin_hr` pada database; semua pemakaian harus diseragamkan menjadi `admin_hr`.

### Matriks akses

| Kemampuan | Administrator | Admin HR | Karyawan |
|---|---:|---:|---:|
| Dashboard backoffice | Ya | Ya | Tidak |
| Kelola data karyawan | Ya | Ya | Tidak |
| Laporan dan koreksi presensi | Ya | Ya | Tidak |
| Pengaturan jam/GPS | Ya | Tidak | Tidak |
| Audit log penuh | Ya | Tidak | Tidak |
| Kelola role operasional | Ya | Tidak | Tidak |
| Menetapkan administrator | CLI rotasi saja | Tidak | Tidak |
| Presensi dan riwayat pribadi | Tidak | Tidak | Ya |

## Fase 1: audit dan normalisasi role

1. Inventarisasi semua pemeriksaan role pada migrasi SQL, server routes, hooks, dan komponen Svelte.
2. Buat migrasi idempotent untuk mengubah nilai lama:
   - `hr` menjadi `admin_hr` jika nilai tersebut pernah tersimpan.
   - `pemilik` menjadi `admin_hr` jika role pemilik resmi dihapus.
3. Perbarui enum/check constraint, policy RLS, notification targets, route guards, dan UI.
4. Tambahkan test matriks akses untuk ketiga role target.
5. Jangan menghapus nilai enum PostgreSQL secara langsung tanpa strategi migrasi aman.

## Fase 2: jaminan administrator tunggal

Tambahkan proteksi berlapis:

1. Unique partial index atau mekanisme database ekuivalen yang menolak administrator kedua.
2. Function server/database yang mencegah client biasa menaikkan role menjadi `administrator`.
3. Hapus pilihan Administrator dari dropdown role di halaman Monitoring Akun.
4. Lindungi akun administrator dari delete, deactivate, dan downgrade melalui endpoint umum.
5. Batasi halaman Monitoring Akun dan Audit Log penuh hanya untuk administrator.
6. Pastikan service key tidak dapat dipicu dari input client untuk melewati aturan bisnis.

Invariant setelah setiap transaksi:

```text
jumlah administrator aktif = 1
```

## Fase 3: bootstrap dari environment

Nama environment yang dipakai harus konsisten dengan skrip existing:

```dotenv
INITIAL_ADMIN_EMAIL=
INITIAL_ADMIN_PASSWORD=
INITIAL_ADMIN_NIP=
INITIAL_ADMIN_NAME=
```

Alur:

1. Bootstrap hanya berjalan melalui perintah operator, bukan otomatis pada setiap startup/request.
2. Jika belum ada administrator, buat user melalui Supabase Admin API dan tandai wajib ganti password.
3. Jika sudah ada administrator, bootstrap kedua harus gagal tanpa memodifikasi akun mana pun.
4. Setelah bootstrap berhasil, hapus `INITIAL_ADMIN_PASSWORD` dari `.env` VPS bila tidak lagi diperlukan.
5. Jangan mencatat password atau secret ke log dan audit detail.

Target command operasional:

```sh
docker compose run --rm app npm run admin:bootstrap
```

Image produksi saat ini minimal dan belum menyertakan skrip administrasi. Implementasi command harus mempertimbangkan dedicated admin image, bind mount terkontrol, atau command dari checkout host; jangan menambah source dan dev dependency ke runtime tanpa pertimbangan ukuran serta keamanan.

## Fase 4: rotasi administrator

Sediakan command terpisah, misalnya:

```sh
docker compose run --rm app npm run admin:rotate
```

Rotasi wajib atomik:

1. Validasi calon administrator dari environment.
2. Buat atau verifikasi akun Auth baru.
3. Tetapkan akun baru sebagai administrator.
4. Turunkan administrator lama menjadi role yang dipilih atau nonaktifkan sesuai input eksplisit.
5. Tulis audit log tanpa data rahasia.
6. Rollback seluruh perubahan jika satu langkah gagal.

Tidak boleh ada keadaan sementara yang persisten dengan nol atau dua administrator. Pertimbangkan database transaction/function karena operasi Auth dan tabel publik berada pada boundary berbeda; dokumentasikan mekanisme kompensasi jika transaksi lintas Auth tidak memungkinkan.

## Fase 5: pemisahan domain

DNS:

```text
presensi  A  IP_VPS
admin     A  IP_VPS
```

Nginx menggunakan dua virtual host yang meneruskan request ke container yang sama pada loopback port aplikasi. Terbitkan sertifikat admin dengan Certbot setelah DNS aktif.

### Domain karyawan

Host: `presensi.trisulaprimaagung.my.id`

Route yang diperbolehkan:

- `/login`
- `/ganti-password`
- `/presensi`
- `/riwayat`
- `/profil`
- endpoint API karyawan yang relevan

Administrator atau Admin HR yang masuk melalui domain karyawan diarahkan ke domain admin.

### Domain backoffice

Host: `admin.trisulaprimaagung.my.id`

Route yang diperbolehkan:

- `/login`
- `/ganti-password`
- `/admin/**`
- `/profil`
- `/auth/**`
- endpoint API backoffice yang relevan

Karyawan ditolak pada domain admin dengan pesan generik yang tidak membocorkan detail akun.

### Aturan server

1. Pemeriksaan hostname dilakukan di `src/hooks.server.js` atau helper server terpusat.
2. Hanya hostname produksi yang dikonfigurasi dan hostname pengembangan yang eksplisit yang diterima.
3. Jangan mempercayai hostname tanpa konfigurasi trusted proxy yang benar.
4. Route `/admin/**` tetap memeriksa role walaupun hostname admin sudah benar.
5. Redirect harus menggunakan origin yang dikonfigurasi, bukan nilai Host arbitrer dari request.

## Fase 6: login terpisah

Login karyawan:

- Branding portal karyawan.
- Hanya menerima role `karyawan`.
- Redirect sukses ke `/presensi`.

Login backoffice:

- Branding portal administrasi.
- Hanya menerima `administrator` atau `admin_hr`.
- Redirect sukses ke `/admin/dashboard`.

Keduanya tetap menggunakan Supabase Auth. Uji cookie/session pada subdomain secara eksplisit; jangan mengasumsikan session harus dibagikan lintas subdomain.

## Fase 7: Supabase URL Configuration

Site URL tetap:

```text
https://presensi.trisulaprimaagung.my.id
```

Redirect URLs:

```text
https://presensi.trisulaprimaagung.my.id/**
https://admin.trisulaprimaagung.my.id/**
```

Tambahkan URL localhost secara terpisah hanya untuk development.

## Fase 8: migrasi produksi

Urutan aman:

1. Backup database dan catat jumlah user per role.
2. Pastikan tepat satu administrator aktif sebelum constraint diterapkan.
3. Tambahkan DNS `admin` dan tunggu propagasi.
4. Terapkan migrasi role dan policy RLS.
5. Deploy aplikasi dengan route guard baru.
6. Tambahkan virtual host Nginx admin dan validasi menggunakan `nginx -t`.
7. Terbitkan HTTPS admin.
8. Tambahkan redirect URL Supabase.
9. Uji menggunakan browser Incognito untuk setiap role.
10. Pantau log aplikasi, Nginx, dan audit log.

Siapkan rollback source, konfigurasi Nginx, dan migrasi data. Constraint keamanan yang sudah melindungi data tidak boleh dihapus secara tergesa-gesa saat rollback UI.

## Test dan acceptance criteria

### Administrator tunggal

- Bootstrap pertama berhasil ketika belum ada administrator.
- Bootstrap kedua ditolak.
- Database menolak administrator kedua dari semua jalur.
- UI dan endpoint umum tidak dapat mempromosikan user menjadi administrator.
- Admin HR tidak dapat mengubah role atau membuka fungsi sistem penuh.
- Administrator tidak dapat menghapus atau menurunkan dirinya melalui UI.
- Rotasi berhasil dengan tepat satu administrator pada hasil akhir.
- Kegagalan rotasi tidak meninggalkan akun setengah jadi tanpa prosedur pemulihan.

### Pemisahan domain

- Karyawan dapat login pada domain presensi.
- Karyawan ditolak pada domain admin.
- Administrator dan Admin HR dapat login pada domain admin sesuai haknya.
- Backoffice diarahkan dari domain karyawan ke domain admin.
- `/admin/**` tidak dapat digunakan melalui domain karyawan.
- Hostname asing dan manipulasi Host ditolak atau diarahkan dengan aman.
- HTTPS valid untuk kedua subdomain.

### Regresi

- Kamera, face detection, GPS, dan anti-fake-GPS tetap bekerja.
- Signed URL foto tetap bekerja.
- Presensi masuk/pulang dan riwayat tetap bekerja.
- Laporan, ekspor, koreksi, notifikasi, logout, dan ganti password tetap bekerja.
- Test database/RLS existing tetap lulus.

## Catatan untuk agent implementasi

1. Jangan langsung mengubah enum atau role produksi tanpa migrasi data dan test.
2. Jangan memasukkan secret ke repository, Docker build arguments, output test, atau dokumentasi publik.
3. Pertahankan perubahan user yang belum terkait pada working tree.
4. Buat commit kecil berbahasa Inggris untuk setiap fase yang selesai.
5. Jalankan minimal `npm run check`, `npm test`, dan `npm run build` sebelum deployment.
6. Perbarui dokumentasi GitHub Pages setelah alur final terverifikasi.
