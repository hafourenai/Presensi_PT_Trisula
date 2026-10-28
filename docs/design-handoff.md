# Arahan desain dan handoff Figma

Permintaan pengguna: gunakan referensi https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git pada fase desain, dan sediakan halaman `.html` untuk dibawa ke Figma.

## Pelaksanaan pada fase desain/layout

- Gunakan panduan UI UX Pro Max untuk merumuskan design system aplikasi presensi, lalu terapkan konsisten pada Svelte dan HTML handoff.
- Baca instruksi skill dan dokumentasi versi yang digunakan saat mulai desain. Referensi sudah diperiksa, tetapi skill belum dipasang pada Fase 1 database.
- Siapkan direktori `design/` dengan `index.html` sebagai daftar layar dan file HTML per layar utama: login, ganti password/consent, presensi, riwayat, profil, dashboard, karyawan, laporan, serta halaman administrator sesuai fase implementasinya.
- Sertakan CSS yang dapat dibaca browser secara langsung; halaman handoff tidak memerlukan build Svelte atau koneksi Supabase.
- Gunakan data contoh fiktif. HTML handoff tidak menyertakan environment, akun asli, foto karyawan, atau akses kamera langsung.
- Sediakan tampilan 360px, 768px, 1024px, dan 1440px. Bahasa Indonesia, target sentuh minimal 44px, status tidak hanya dibedakan lewat warna.

## Memindahkan ke Figma

Figma tidak mengimpor file HTML sebagai desain editable secara native. Gunakan plugin HTML-to-Figma (misalnya html.to.design), dengan file atau URL sesuai dukungan plugin pada saat handoff. Sertakan petunjuk impor bersama HTML. Hasil impor tetap perlu diperiksa untuk font, auto-layout, komponen, dan responsivitas; perilaku aplikasi tidak otomatis menjadi interaksi Figma.

Dokumen ini mencatat kebutuhan untuk fase desain berikutnya; file HTML handoff belum dibuat pada Fase 1.
