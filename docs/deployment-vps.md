# Deployment produksi ke VPS dengan Docker

Panduan ini ditujukan untuk VPS Ubuntu/Debian yang sudah memiliki Docker. Aplikasi berjalan dalam container SvelteKit. Reverse proxy dapat memakai Caddy bawaan atau Nginx yang sudah digunakan proyek lain. Database, autentikasi, dan storage tetap menggunakan Supabase Cloud.

## 1. Siapkan domain dan Supabase

HTTPS wajib tersedia karena kamera dan geolocation browser tidak bekerja pada koneksi HTTP biasa.

1. Tentukan satu domain, misalnya `presensi.perusahaan.com`.
2. Di pengelola DNS, buat **A record**:
   - Name/Host: `presensi`
   - Value: alamat IP VPS Anda
   - TTL: 300 atau Auto
3. Tunggu propagasi, kemudian periksa dari komputer lokal:

   ```sh
   nslookup presensi.perusahaan.com
   ```

4. Di Supabase Dashboard buka **Authentication → URL Configuration**:
   - Site URL: `https://presensi.perusahaan.com`
   - Redirect URLs: tambahkan `https://presensi.perusahaan.com/**`

Jangan meneruskan proses sampai domain menunjuk ke IP VPS. Caddy tidak dapat menerbitkan sertifikat jika DNS belum benar atau port 80/443 tertutup.

## 2. Masuk dan periksa VPS

Dari PowerShell komputer lokal:

```powershell
ssh -p PORT_SSH USER_VPS@IP_VPS
```

Di VPS, periksa sistem dan Docker:

```sh
cat /etc/os-release
docker --version
docker compose version
df -h
free -h
```

Jika `docker compose` belum tersedia tetapi Docker sudah ada, pada Ubuntu/Debian pasang plugin Compose:

```sh
apt update
apt install -y docker-compose-plugin git ufw
```

## 3. Amankan firewall tanpa memutus SSH

Gunakan port SSH sesuai panel provider. Izinkan port internal SSH yang benar **sebelum** mengaktifkan UFW:

```sh
ufw allow PORT_SSH_INTERNAL/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP for Caddy'
ufw allow 443/tcp comment 'HTTPS for Caddy'
ufw allow 443/udp comment 'HTTP3 for Caddy'
ufw enable
ufw status verbose
```

Jangan membuka port aplikasi 3000 ke publik. Port itu hanya tersedia pada network internal Docker.

## 4. Ambil source code dari GitHub

Buat direktori aplikasi:

```sh
mkdir -p /opt/presensi
cd /opt/presensi
```

Untuk repository publik:

```sh
git clone https://github.com/hafourenai/Presensi_PT_Trisula.git .
```

Jika repository private, gunakan deploy key agar token GitHub tidak tersimpan di command history:

```sh
ssh-keygen -t ed25519 -C "presensi-vps" -f /root/.ssh/presensi_deploy -N ""
cat /root/.ssh/presensi_deploy.pub
```

Salin output public key tersebut ke GitHub repository → **Settings → Deploy keys → Add deploy key**. Akses tulis tidak diperlukan. Setelah itu:

```sh
cat >> /root/.ssh/config <<'EOF'
Host github-presensi
  HostName github.com
  User git
  IdentityFile /root/.ssh/presensi_deploy
  IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config
ssh-keyscan github.com >> /root/.ssh/known_hosts
git clone git@github-presensi:hafourenai/Presensi_PT_Trisula.git .
```

## 5. Buat environment produksi

```sh
cp .env.example .env
nano .env
```

Isi minimal berikut dengan nilai asli dari Supabase Dashboard:

```dotenv
DOMAIN=presensi.perusahaan.com
PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx
```

Aturan penting:

- `DOMAIN` tidak memakai `https://` dan tidak diakhiri `/`.
- Secret Supabase tidak boleh dikirim melalui chat atau dimasukkan ke Git.
- `.env` sudah diabaikan Git dan Docker build context.
- Batasi hak baca file:

  ```sh
  chmod 600 .env
  ```

## 6. Build dan jalankan aplikasi

Jika port 80/443 masih kosong dan akan memakai Caddy bawaan:

```sh
docker compose config
docker compose build
docker compose --profile caddy up -d
docker compose ps
```

Jika VPS sudah memiliki Nginx untuk proyek lain, jalankan aplikasi saja. Secara default aplikasi tersedia hanya di loopback host pada port 3002:

```sh
docker compose build
docker compose up -d app
docker compose ps
```

Buat virtual host Nginx `/etc/nginx/sites-available/presensi` yang meneruskan request ke `http://127.0.0.1:3002`, lalu aktifkan HTTPS dengan Certbot. Jangan membuka port 3002 melalui firewall.

Build pertama dapat memerlukan beberapa menit. Pantau log:

```sh
docker compose logs -f --tail=100
```

Tekan `Ctrl+C` untuk keluar dari tampilan log; container tetap berjalan. Setelah status `app` menjadi healthy, buka `https://DOMAIN_ANDA` dari browser.

Pemeriksaan dari VPS:

```sh
curl -I https://presensi.perusahaan.com/login
docker stats --no-stream
```

## 7. Menyiapkan database dan administrator pertama

Migrasi SQL pada folder `supabase/migrations` harus sudah diterapkan ke project Supabase. Ikuti [panduan database](./fase-1-database.md). Image produksi dibuat minimal dan tidak memuat skrip administrasi. Jika bootstrap administrator belum pernah dijalankan, lakukan dari komputer pengembangan dengan `.env` lokal sesuai panduan database, kemudian hapus variabel `INITIAL_ADMIN_*` dari environment setelah berhasil.

## 8. Update setiap ada commit baru

Jalankan di `/opt/presensi`:

```sh
git fetch origin
git pull --ff-only origin main
docker compose build
docker compose up -d app --remove-orphans
docker image prune -f
docker compose ps
```

Periksa log setelah update:

```sh
docker compose logs --tail=100 app caddy
```

## 9. Operasional rutin

Perintah penting:

```sh
# Status
docker compose ps

# Log aplikasi
docker compose logs -f --tail=100 app

# Restart tanpa build
docker compose restart

# Stop aplikasi
docker compose down

# Jalankan kembali
docker compose up -d
```

Data persisten Caddy (termasuk sertifikat) berada di Docker volume `caddy_data`. Jangan gunakan `docker compose down -v` kecuali memang ingin menghapus volume tersebut.

## 10. Troubleshooting

### HTTPS tidak terbit

```sh
docker compose logs --tail=200 caddy
```

Pastikan A record benar, port 80/443 tidak diblokir provider VPS, dan tidak ada service lain memakai port tersebut:

```sh
ss -lntup | grep -E ':80|:443'
```

### Container aplikasi tidak healthy

```sh
docker compose logs --tail=200 app
docker compose config
```

Penyebab umum adalah environment Supabase kosong atau salah.

### Kamera/GPS tidak muncul

Pastikan halaman dibuka melalui HTTPS, izin kamera/lokasi browser diberikan, dan header `Permissions-Policy` dari Caddy tidak diubah.

### Kapasitas disk menipis

```sh
df -h
docker system df
docker image prune -f
```

Dengan 2 vCPU, RAM 4 GB, dan disk 60 GB, konfigurasi dua container ini mencukupi. Hindari menjalankan Supabase self-hosted pada VPS yang sama agar kapasitas RAM tetap aman.

## 11. Catatan deployment aktual PT Trisula

Deployment produksi dilakukan pada 15 November 2026 dengan hasil berikut:

- Domain: `presensi.trisulaprimaagung.my.id`
- VPS: Ubuntu 24.04, 2 vCPU, RAM 4 GB, NVMe 60 GB
- Docker 29.1.3, Docker Compose 2.40.3, Git 2.43.0
- Nginx host sudah digunakan proyek lain pada port 80/443
- Port 3000 dan 3001 juga sudah digunakan; aplikasi presensi memakai `127.0.0.1:3002`
- Sertifikat Let's Encrypt diterbitkan melalui Certbot dan diperpanjang otomatis
- Login administrator berhasil diuji melalui HTTPS

### Error build Supabase

Build pertama berhenti dengan pesan `SUPABASE_SECRET_KEY wajib tersedia`. Ini bukan karena `.env` salah. Secret sengaja tidak dimasukkan ke Docker build context, tetapi client admin saat itu diinisialisasi terlalu dini. Commit `0449008` memperbaikinya dengan menunda pembuatan client sampai runtime.

```sh
git pull --ff-only origin main
docker compose build
```

### Konflik port Caddy dan Nginx

Caddy tidak dijalankan karena port 80 sudah dipakai Nginx proyek lain. Commit `710fd1b` menjadikan Caddy opsional dan memublikasikan aplikasi hanya ke loopback port yang dapat dikonfigurasi.

```sh
docker compose up -d app --remove-orphans
docker compose ps
curl -I http://127.0.0.1:3002/login
```

### Konfigurasi Nginx produksi

File `/etc/nginx/sites-available/presensi.trisulaprimaagung.my.id` sebelum dimodifikasi Certbot:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name presensi.trisulaprimaagung.my.id;
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

### Checklist hasil akhir

- `docker compose ps` menunjukkan aplikasi `healthy`.
- `curl -I http://127.0.0.1:3002/login` menghasilkan HTTP 200.
- `nginx -t` berhasil sebelum reload.
- `curl -I https://presensi.trisulaprimaagung.my.id/login` menghasilkan HTTP 200.
- Supabase Site URL: `https://presensi.trisulaprimaagung.my.id`.
- Supabase Redirect URL: `https://presensi.trisulaprimaagung.my.id/**`.
- Jangan membuka port 3002 pada firewall; akses publik harus melalui Nginx HTTPS.
