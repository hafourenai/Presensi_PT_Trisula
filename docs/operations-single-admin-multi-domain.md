# Operasi administrator tunggal dan dua domain

Dokumen ini digunakan setelah commit aplikasi yang memuat migrasi
`20261116000100_single_administrator_roles.sql` dan
`20261116000200_atomic_administrator_rotation.sql`.

## Prasyarat

1. Backup database Supabase dan uji bahwa backup dapat dipulihkan.
2. Catat jumlah profil per role.
3. Pastikan hanya ada satu profil `administrator` aktif sebelum migrasi.
4. DNS berikut harus mengarah ke IP VPS:
   - `presensi.trisulaprimaagung.my.id`
   - `admin.trisulaprimaagung.my.id`
5. Tambahkan kedua URL berikut ke Supabase Authentication > URL Configuration > Redirect URLs:
   - `https://presensi.trisulaprimaagung.my.id/**`
   - `https://admin.trisulaprimaagung.my.id/**`

Site URL tetap `https://presensi.trisulaprimaagung.my.id`.

## Urutan migrasi database

Jalankan SQL melalui mekanisme migrasi Supabase yang biasa digunakan proyek. Jangan deploy aplikasi baru sebelum kedua file berikut berhasil, sesuai urutan:

1. `supabase/migrations/20261116000100_single_administrator_roles.sql`
2. `supabase/migrations/20261116000200_atomic_administrator_rotation.sql`

Migrasi pertama mengubah data `pemilik`/`hr` menjadi `admin_hr`, memperbarui RLS, menolak administrator kedua, serta melindungi administrator saat ini. Migrasi kedua menambahkan prosedur rotasi atomik.

Verifikasi sesudah migrasi:

```sql
select role, is_active, count(*)
from public.profiles
group by role, is_active
order by role, is_active;

select count(*) as active_administrators
from public.profiles
where role = 'administrator' and is_active;
```

Nilai `active_administrators` wajib `1`.

## Environment VPS

Tambahkan atau sesuaikan nilai berikut di `.env` tanpa menghapus credential Supabase yang sudah ada:

```dotenv
EMPLOYEE_ORIGIN=https://presensi.trisulaprimaagung.my.id
ADMIN_ORIGIN=https://admin.trisulaprimaagung.my.id
EMPLOYEE_DOMAIN=presensi.trisulaprimaagung.my.id
ADMIN_DOMAIN=admin.trisulaprimaagung.my.id
INTERNAL_HOSTS=127.0.0.1,localhost
APP_PORT=3002
```

Hapus variabel lama `DOMAIN` setelah reverse proxy dan aplikasi baru tervalidasi.

## Deploy aplikasi di VPS

Masuk ke VPS:

```sh
ssh -p 20231 root@217.216.146.16
```

Masuk ke direktori checkout aplikasi, lalu jalankan:

```sh
git status --short
git pull --ff-only origin main
docker compose build app admin-tools
docker compose up -d app
docker compose ps
docker compose logs --tail=100 app
```

Jangan lanjut jika `git status --short` menampilkan perubahan yang tidak dikenali. Jangan memakai `git reset --hard` untuk mengatasinya.

Jika VPS memakai Nginx host dan bukan profile Caddy pada repository, pastikan kedua server block meneruskan header yang ditimpa oleh Nginx, bukan meneruskan nilai dari client secara bebas:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Kedua virtual host meneruskan request ke `http://127.0.0.1:3002`. Jalankan `nginx -t` sebelum reload dan terbitkan sertifikat untuk domain admin hanya setelah DNS aktif.

## Bootstrap administrator pertama

Bootstrap hanya untuk database yang belum memiliki administrator. Isi sementara `INITIAL_ADMIN_*` di `.env`, lalu:

```sh
docker compose run --rm admin-tools npm run admin:bootstrap
```

Setelah berhasil, hapus `INITIAL_ADMIN_PASSWORD` dari `.env`. Pengulangan bootstrap tidak membuat administrator kedua.

## Rotasi administrator

Isi sementara:

```dotenv
ROTATION_ADMIN_EMAIL=
ROTATION_ADMIN_PASSWORD=
ROTATION_ADMIN_NIP=
ROTATION_ADMIN_NAME=
PREVIOUS_ADMIN_ROLE=admin_hr
DEACTIVATE_PREVIOUS_ADMIN=false
```

`ROTATION_ADMIN_PASSWORD` hanya wajib jika calon belum mempunyai profil. Untuk calon yang sudah ada, email, NIP, dan nama harus sama persis dengan profil aktif `admin_hr` atau `karyawan`.

Jalankan:

```sh
docker compose run --rm admin-tools npm run admin:rotate
```

Setelah berhasil, hapus `ROTATION_ADMIN_PASSWORD` dari `.env`, lalu verifikasi jumlah administrator aktif tetap satu.

## Smoke test

```sh
curl -I https://presensi.trisulaprimaagung.my.id/login
curl -I https://admin.trisulaprimaagung.my.id/login
curl -I -H 'Host: invalid.example' http://127.0.0.1:3002/login
```

Gunakan browser Incognito terpisah untuk menguji Karyawan, Admin HR, dan Administrator. Uji login, ganti password, presensi, riwayat, laporan, pengaturan, monitoring akun, audit log, signed URL foto, dan logout.

## Rollback

Rollback image aplikasi boleh dilakukan dengan menjalankan commit/image sebelumnya. Jangan buru-buru menghapus unique index atau trigger perlindungan administrator. Jika masalah berada pada migrasi data atau RLS, gunakan backup dan prosedur pemulihan Supabase yang sudah diuji, lalu investigasi sebelum membuka kembali akses produksi.
