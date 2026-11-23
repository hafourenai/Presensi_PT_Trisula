# Naskah & Narasi Presentasi (Slide demi Slide)

File ini berpasangan langsung dengan **`Presentasi-Presensi-Karyawan.pptx`** (13 slide, sudah termasuk *Speaker Notes* di dalam file PPTX). Estimasi durasi bicara: **10–13 menit**, disusul demo & tanya jawab.

---

## Slide 1: Judul & Pembuka (±45 detik)

**Yang tampil di layar:** Judul aplikasi, ringkasan 4 angka kunci (`500–1.000 karyawan`, `2 Portal`, `< 2 ms query lokal`, `72 Tes otomatis`).

**Narasi yang diucapkan:**
> "Selamat pagi/siang Bapak/Ibu dan rekan-rekan sekalian. Pada kesempatan ini saya akan mempresentasikan **Aplikasi Presensi Karyawan Berbasis Web** yang kami bangun untuk kebutuhan internal perusahaan dengan skala 500 hingga 1.000 karyawan.
>
> Dalam presentasi ini saya akan menjelaskan secara berurutan: **awal mula** dan masalah yang ingin kami selesaikan, **langkah pertama** yang kami kerjakan saat memulai proyek, **alasan pemilihan tech stack**, **struktur kode dan arsitektur**, **flow bisnis**, **data flow** dari kamera HP sampai database, serta **lapisan keamanan anti-joki dan anti-fake-GPS**."

---

## Slide 2: Awal Mula & Masalah yang Diselesaikan (±1 menit)

**Narasi yang diucapkan:**
> "Kita mulai dari **awal mula** proyek ini. Ada tiga masalah nyata di lapangan yang menjadi latar belakang:
>
> 1. **Mesin fingerprint fisik tidak fleksibel.** Pada jam masuk pukul 07:45 sampai 08:00 sering terjadi antrean, butuh biaya pengadaan dan perawatan perangkat, serta tidak bisa digunakan oleh karyawan lapangan atau yang ditempatkan di lokasi berbeda.
> 2. **Kecurangan pada absensi mobile biasa.** Sistem absensi yang sederhana sangat mudah diakali: karyawan bisa menitipkan akun ke temannya di kantor (joki absen), memakai aplikasi Fake GPS, memundurkan jam di pengaturan HP, atau mengunggah foto lama dari galeri.
> 3. **Biaya langganan SaaS dan hambatan instalasi aplikasi.** Layanan SaaS absensi umumnya menarik biaya per karyawan setiap bulan, sedangkan aplikasi native mengharuskan karyawan meng-install dari Play Store atau App Store yang sering terkendala memori HP atau kompatibilitas.
>
> Karena itu, solusi yang kami rancang adalah **aplikasi web mobile-first** yang cukup dibuka lewat browser HTTPS. Kami juga sejak awal menetapkan **batasan cakupan yang tegas**: sistem ini melakukan *face detection* (memastikan ada tepat satu wajah nyata di depan kamera), bukan *face recognition* pencocok identitas yang membutuhkan server GPU mahal. Selain itu, jika lokasi atau perangkat mencurigakan, kebijakan sistem adalah **menerima presensi sambil memberi penanda (flag) dan mengirim peringatan ke HR**, supaya karyawan yang jujur tidak gagal absen hanya karena sinyal GPS sedang buruk."

---

## Slide 3: Langkah Pertama Kali yang Dilakukan (±1 menit)

**Narasi yang diucapkan:**
> "Kalau ditanya: **langkah apa yang pertama kali kami lakukan saat membangun sistem ini?**
>
> Kami **tidak** mulai dari mendesain tampilan atau menulis halaman kamera. Urutan yang kami jalankan adalah:
>
> 1. **Pertama, menyusun PRD (`PRD.md`).** Kami mengunci aturan bisnis, matriks role, model data 8 tabel, perhitungan kapasitas penyimpanan foto, dan roadmap 12 fase.
> 2. **Kedua, menyiapkan kerangka SvelteKit 2 + Svelte 5 + Tailwind CSS v4** dan memastikan pemeriksaan tipe `svelte-check` berjalan bersih.
> 3. **Ketiga — dan ini langkah teknis paling krusial — membangun fondasi Database PostgreSQL dan keamanannya lebih dulu.** Sebelum ada halaman login, kami sudah menulis migrasi SQL lengkap dengan `CHECK constraint`, `UNIQUE index`, fungsi helper `private.get_my_role()` dan `get_app_role()`, *Row Level Security* (RLS), bucket storage private, serta **mengujinya secara otomatis menggunakan PGlite**.
> 4. **Keempat**, membuat prototipe desain UI responsif (lebar 360px untuk HP dan tampilan desktop).
> 5. **Kelima dan keenam**, barulah kami membangun pipeline autentikasi di `hooks.server.js`, halaman presensi dengan kamera dan MediaPipe, diikuti fitur backoffice, anti-joki dengan Telegram, pemisahan dua subdomain, hingga optimasi database hybrid."

---

## Slide 4: Kenapa Memilih Tech Stack Ini? (±1,5 menit)

**Narasi yang diucapkan:**
> "Mengapa kami memilih kombinasi teknologi ini? Setiap komponen dipilih dengan alasan yang spesifik:
>
> - **SvelteKit 2 + Svelte 5 (JavaScript):** Berbeda dengan React atau Next.js yang mengirim runtime Virtual DOM cukup besar ke browser, Svelte adalah *compiler* yang menghasilkan JavaScript sangat kecil dan cepat. Ini penting agar halaman presensi terbuka ringan di HP karyawan kelas entry-level. Selain itu, satu repositori SvelteKit sudah mencakup frontend sekaligus server API routes.
> - **MediaPipe `@mediapipe/tasks-vision` (BlazeFace WebAssembly):** Deteksi wajah berjalan **100% di browser HP karyawan** menggunakan GPU HP dengan fallback ke CPU. Hasilnya, **biaya server untuk pemrosesan AI adalah Rp0**, dan ketika 500 karyawan absen bersamaan pukul 08:00 pagi, server tidak mengalami antrean komputasi gambar.
> - **Kompresi Canvas + Rumus Haversine murni:** Foto dari kamera langsung diperkecil di browser menjadi lebar 480 piksel JPEG kualitas 0,65 sehingga ukurannya di bawah **50 KB** — menghemat kuota storage lebih dari 95%. Jarak ke kantor dihitung dengan rumus matematika Haversine sekitar 20 baris kode, tanpa biaya API Google Maps.
> - **Arsitektur Database Hybrid (PostgreSQL 16 Lokal VPS + Supabase Cloud):** Awalnya semua query mengarah ke Supabase Cloud. Namun karena lokasi cloud berada di luar negeri (Sydney), ada latensi jaringan saat berpindah menu. Kami membuat lapisan `supabaseAdmin` berbentuk Proxy: semua query tabel operasional (`.from()` dan `.rpc()`) dieksekusi ke **PostgreSQL 16 lokal di dalam VPS** dalam waktu **di bawah 2 milidetik**, sedangkan **Supabase Auth** dan **Supabase Storage** tetap dipakai untuk autentikasi dan penyimpanan foto private.
> - **Docker Compose + Caddy 2:** Memastikan deployment satu perintah di VPS, dan Caddy mengurus sertifikat HTTPS secara otomatis — karena browser modern menolak menyalakan kamera dan GPS tanpa HTTPS."

---

## Slide 5: Struktur Proyek & Peta Modul (±1 menit)

**Narasi yang diucapkan:**
> "Secara struktur kode, proyek ini terdiri dari 53 file di dalam `src/` dengan sekitar 9.400 baris kode, 9 file SQL, dan 11 file pengujian otomatis.
>
> Kami membaginya menjadi **9 modul** yang batas tanggung jawabnya jelas:
> - Di dalam `src/lib/server/` tersimpan kode yang **hanya boleh berjalan di server**: `admin.js` dan `local-db.js` untuk database hybrid, `device-auth.js` untuk verifikasi perangkat utama, `domains.js` untuk pemisahan subdomain, `notifications.js` dan `telegram.js` untuk peringatan ke HR, serta `audit.js`.
> - Di dalam `src/routes/` terbagi menjadi tiga kelompok: halaman karyawan (`/presensi`, `/riwayat`, `/profil`), halaman backoffice (`/admin/*`), dan endpoint API (`/api/presensi`, `/api/device/sync`, `/api/storage/signed-url`, `/api/resolve-maps`)."

---

## Slide 6: Arsitektur Sistem & Database Hybrid (±1 menit)

**Narasi yang diucapkan:**
> "Bagan ini memperlihatkan bagaimana seluruh komponen saling terhubung di produksi.
>
> Pengguna masuk melalui dua subdomain berbeda: karyawan lewat `presensi.<domain>` dan pengelola lewat `admin.<domain>`. Keduanya diterima oleh **Caddy** yang memasang TLS dan header keamanan `Permissions-Policy` untuk kamera dan geolokasi.
>
> Di dalam aplikasi SvelteKit, setiap request melewati **`hooks.server.js`** terlebih dahulu. Di sini sesi diverifikasi — dilengkapi cache token SHA-256 selama 30 detik agar tidak bolak-balik ke cloud — lalu dicek apakah role pengguna cocok dengan subdomain yang diakses.
>
> Ketika halaman atau API membutuhkan data, semuanya memanggil **`supabaseAdmin`**. Proxy ini secara otomatis mengarahkan operasi tabel ke **PostgreSQL 16 lokal** di VPS, sementara operasi akun mengarah ke **Supabase Auth**, upload foto ke **Supabase Storage**, dan peringatan anomali dikirim ke **Telegram Bot API**."

---

## Slide 7: Model Role, Isolasi Subdomain & Administrator Tunggal (±1 menit)

**Narasi yang diucapkan:**
> "Untuk hak akses, kami menyederhanakan model menjadi **3 role**:
> 1. **Karyawan**: hanya bisa mengakses portal `presensi.*` untuk absen, melihat riwayat sendiri, dan profil. Jika karyawan mencoba membuka domain `admin.*`, sistem otomatis memutus sesi dan menolak akses.
> 2. **Admin HR**: bertugas di portal `admin.*` untuk memantau dashboard, mengelola data karyawan, impor CSV, mereset perangkat karyawan bila ganti HP, serta mengekspor laporan Excel dan PDF.
> 3. **Administrator**: memegang kontrol penuh termasuk manajemen akun, pengaturan jam kerja dan radius kantor, serta melihat audit log.
>
> Satu keputusan keamanan penting di proyek ini adalah **Jaminan Administrator Tunggal di level PostgreSQL**. Kami memasang *partial unique index* `WHERE role = 'administrator'` ditambah trigger `protect_administrator_profile()`. Artinya, **hanya boleh ada tepat satu akun Administrator** di seluruh sistem, dan akun tersebut tidak bisa dibuat, diturunkan, atau dihapus lewat tampilan web — bahkan oleh koneksi `service_role` sekalipun. Pergantian administrator hanya bisa dilakukan secara atomik melalui perintah CLI `npm run admin:rotate`."

---

## Slide 8: Flow Bisnis (End-to-End) (±1 menit)

**Narasi yang diucapkan:**
> "Berikut adalah **alur bisnis** sistem dari hulu ke hilir:
>
> - **Tahap 1 — Onboarding Akun:** Tidak ada pendaftaran mandiri. Akun dibuat oleh Admin atau HR, baik satu per satu maupun impor CSV massal. Saat karyawan login pertama kali menggunakan NIP atau email, sistem memaksa masuk ke halaman `/ganti-password`. Di halaman ini ada **tiga syarat wajib**: mengganti password awal, menyetujui **consent pengumpulan data foto & lokasi sesuai UU PDP**, serta mengonfirmasi perangkat yang dipakai sebagai **Perangkat Utama**.
> - **Tahap 2 — Presensi Harian:** Karyawan hanya bisa melakukan 1 kali presensi masuk dan 1 kali presensi pulang per hari pada jam kerja. Status ditentukan otomatis oleh server: jika jam masuk melewati `work_start + toleransi` maka berstatus **Terlambat** beserta jumlah menitnya; jika pulang sebelum `work_end` maka tercatat **Pulang Cepat**.
> - **Tahap 3 — Pemantauan & Laporan:** HR memantau kehadiran hari ini secara real-time di dashboard, menindaklanjuti notifikasi jika ada perangkat asing atau lokasi di luar radius, lalu di akhir periode mengekspor rekap kehadiran ke **Excel (.xlsx)** atau **PDF**."

---

## Slide 9: Data Flow Presensi Masuk/Pulang (±1,5 menit)

**Narasi yang diucapkan:**
> "Mari kita bedah **data flow** secara detail ketika seorang karyawan menekan tombol presensi:
>
> 1. **Di browser HP:** kamera depan menyala dan setiap frame video diperiksa oleh model MediaPipe BlazeFace. Tombol *Ambil Foto* terkunci (`disabled`) selama jumlah wajah yang terdeteksi bukan 1.
> 2. Begitu foto diambil, browser menggambar frame ke `<canvas>` lebar 480 piksel, mengompresnya menjadi JPEG di bawah 50 KB, lalu mengirimkannya lewat `POST /api/presensi` bersama koordinat GPS, akurasi, timestamp GPS, flag `is_mock`, dan `device_id`.
> 3. **Di server:** `hooks.server.js` dan endpoint memastikan sesi sah dan user adalah karyawan aktif.
> 4. Server mengambil **waktu server saat ini dalam zona Asia/Jakarta** — jadi jam dari HP diabaikan untuk pencatatan kehadiran.
> 5. Server menjalankan **inspeksi Anti-Fake-GPS** dan **verifikasi Perangkat Utama** terhadap tabel `user_devices`.
> 6. Server menentukan titik koordinat target — mengutamakan lokasi kerja khusus karyawan jika ada, atau fallback ke koordinat kantor pusat — lalu menghitung jarak meter dengan rumus **Haversine**.
> 7. Foto diunggah ke bucket private `attendance-photos` dengan path `{user_id}/{tanggal}/{in|out}.jpg`.
> 8. Terakhir, data disimpan ke tabel `attendances`, dicatat ke `audit_logs`, dan server mengembalikan ringkasan status ke layar karyawan."

---

## Slide 10: 5 Lapisan Keamanan & Anti-Fraud (±1 menit)

**Narasi yang diucapkan:**
> "Slide ini merangkum **5 lapisan anti-fraud** yang kami tanamkan:
> 1. **Anti-Foto Galeri & Tanpa Wajah:** Tidak ada input upload file; foto wajib dari stream kamera langsung dan wajib terdeteksi tepat 1 wajah.
> 2. **Anti-Manipulasi Jam HP:** Seluruh perhitungan tanggal dan keterlambatan memakai jam server WIB.
> 3. **Inspeksi Anti-Fake-GPS:** Server memberi flag `is_suspicious_location` jika terdeteksi tiga sinyal: flag `mock_provider_detected` dari perangkat, nilai akurasi GPS yang terlalu sempurna di bawah **1,5 meter** (ciri khas injeksi koordinat palsu), atau selisih timestamp GPS dengan jam server lebih dari **30 detik**.
> 4. **Anti-Joki (Device Binding + Telegram):** Jika seorang karyawan mencoba login di HP temannya, server langsung menahan login dengan kode **409** dan menampilkan peringatan bahwa akun sudah terikat ke perangkat lain. Bila ia tetap memaksa lanjut, perangkat tersebut dicatat sebagai `is_trusted = false`, presensinya ditandai `is_unrecognized_device`, dan detik itu juga **bot Telegram mengirim pesan peringatan ke grup HR** berisi nama, NIP, perangkat, dan waktu kejadian.
> 5. **Privasi Foto & Audit Log Append-Only:** Foto tidak pernah dibuka ke publik; hanya bisa dilihat lewat *Signed URL* yang kedaluwarsa dalam 60 detik. Dan tabel `audit_logs` dicabut izin `UPDATE` serta `DELETE`-nya di PostgreSQL sehingga jejak audit tidak bisa dihapus."

---

## Slide 11: Model Data PostgreSQL (±45 detik)

**Narasi yang diucapkan:**
> "Ini adalah 8 tabel inti di PostgreSQL kami: `profiles`, `attendances`, `user_devices`, `settings`, `departments`, `holidays`, `notifications`, dan `audit_logs`.
>
> Hal yang ingin saya garis bawahi adalah **aturan bisnis dikunci di level database**, bukan hanya di kode JavaScript. Contohnya: `UNIQUE (user_id, work_date)` menjamin mustahil ada dua baris presensi di hari yang sama; `CHECK (check_out_at >= check_in_at)` menjamin urutan waktu; dan `CHECK (not is_manual_correction or note is not null)` mewajibkan alasan tertulis jika ada koreksi data."

---

## Slide 12: Performa, 72 Automated Test & Deployment (±45 detik)

**Narasi yang diucapkan:**
> "Untuk menjamin kualitas dan kecepatan di produksi:
> - Dari sisi **performa**, kombinasi PostgreSQL lokal di VPS, `HotTableCache` 10 detik, cache verifikasi token 30 detik, dan eksekusi query paralel `Promise.all` membuat perpindahan halaman sangat responsif. Kami juga memasang header HTTP `Server-Timing` untuk memantau durasi sesi dan database di setiap request.
> - Dari sisi **pengujian**, kami memiliki **72 automated test** di 11 file tes yang menguji skema SQL, RLS per role dengan PGlite, rotasi administrator, rumus Haversine, hingga alur device binding — seluruhnya lulus 100% dalam waktu sekitar 11 detik.
> - Dari sisi **deployment**, seluruh stack dikemas dalam `compose.yml` berisi 4 container (`postgres`, `app`, `caddy`, dan `admin-tools`) lengkap dengan healthcheck dan runbook operasional."

---

## Slide 13: Penutup & Roadmap Berikutnya (±45 detik)

**Narasi yang diucapkan:**
> "Sebagai penutup: seluruh alur utama mulai dari manajemen akun, onboarding UU PDP dan perangkat utama, presensi kamera dengan MediaPipe dan Haversine, deteksi anti-joki terintegrasi Telegram, laporan Excel/PDF, hingga arsitektur database hybrid sudah selesai dibangun dan teruji.
>
> Untuk tahap pengembangan berikutnya, kami sudah menyiapkan fondasi skema database untuk tiga hal: pertama, penjadwalan otomatis (`pg_cron` atau worker) untuk menandai status *Tidak Hadir* pukul 23:59 WIB serta retensi foto 30 hari; kedua, penambahan rate limiting dan penegakan jam kerja langsung di endpoint server; serta ketiga, modul izin, sakit, dan cuti.
>
> Demikian presentasi dari saya. Selanjutnya saya siap mendemokan aplikasi atau menjawab pertanyaan Bapak/Ibu. Terima kasih."

---

## Lembar Contekan Tanya-Jawab Penguji (Q&A)

1. **"Kenapa hanya deteksi wajah (Face Detection), bukan pengenalan wajah (Face Recognition)?"**
   - *Jawab:* "Keputusan ini tertulis sejak di PRD. Face recognition untuk 500–1.000 karyawan membutuhkan penyimpanan vektor biometrik dan pencocokan di server atau model besar yang membebani perangkat/GPU. Kami memilih kombinasi yang jauh lebih ringan namun tetap efektif mencegah titip absen: **kamera langsung tanpa galeri + deteksi tepat 1 wajah di browser + pengikatan Perangkat Utama (device binding) + GPS + foto bukti di setiap presensi**."

2. **"Bagaimana kalau karyawan ganti HP atau HP-nya rusak/hilang?"**
   - *Jawab:* "Ada dua jalur. Pertama, karyawan tetap bisa login dan presensi dari HP baru setelah menyetujui layar peringatan perangkat berbeda — presensinya tetap masuk supaya tidak dirugikan, tetapi otomatis ditandai dan HR menerima notifikasi Telegram. Kedua, Admin HR cukup membuka menu `/admin/karyawan/[id]`, lalu menekan **Tetapkan sebagai Perangkat Utama** atau **Reset Perangkat**."

3. **"Bagaimana kalau karyawan menghapus data browser / localStorage? Bukankah `device_id` berubah?"**
   - *Jawab:* "Betul, karena aplikasi berbasis web browser memiliki batasan sandbox dan tidak bisa membaca IMEI perangkat keras. Jika `localStorage` dihapus, browser akan membuat UUID baru yang oleh server dianggap sebagai **perangkat tidak dikenal**, sehingga justru memicu peringatan 409 dan notifikasi ke HR. Jadi menghapus storage tidak membantu karyawan untuk curang, malah membuat aktivitasnya dilaporkan ke HR."

4. **"Kenapa database-nya dibuat hybrid (Postgres lokal + Supabase Cloud)? Kenapa tidak satu saja?"**
   - *Jawab:* "Ketika diuji di VPS, query REST ke Supabase Cloud memiliki latensi jaringan lintas negara (ke region cloud) di setiap klik menu. Dengan menaruh PostgreSQL 16 di container lokal VPS dan membuat `LocalQueryBuilder` yang kompatibel dengan sintaks `.from().select()`, waktu query turun menjadi di bawah 2 ms. Sementara itu, Supabase Auth dan Storage tetap kami pakai di cloud karena sudah teruji menangani manajemen sesi JWT dan objek foto private."

5. **"Apakah ada celah yang masih perlu diperkuat di versi saat ini?"** *(Menjawab jujur seperti ini biasanya sangat disukai penguji)*
   - *Jawab:* "Ada tiga hal yang sudah kami catat di roadmap: (1) saat ini penguncian di luar jam kerja baru dilakukan di UI (`timeStatus.allowed`), sehingga ke depan perlu ditegakkan juga di endpoint `/api/presensi`; (2) job cron otomatis pukul 23:59 untuk menulis baris `tidak_hadir` dan membersihkan foto > 30 hari belum diaktifkan walaupun enum dan kolomnya sudah siap di database; dan (3) penambahan rate limiting di endpoint presensi."
