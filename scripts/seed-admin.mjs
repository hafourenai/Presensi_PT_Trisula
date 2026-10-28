import { bootstrapAdmin } from './lib/bootstrap-admin.mjs';
import { request } from './lib/supabase.mjs';

try {
  const status = await bootstrapAdmin(process.env, request);
  console.log(status === 'created'
    ? 'Administrator awal berhasil dibuat bersama profil dan audit. Wajib ganti password saat login pertama.'
    : 'Administrator awal sudah tersedia. Password dan profil tidak diubah.');
  console.log('Hapus INITIAL_ADMIN_PASSWORD dari .env setelah selesai. Halaman login tersedia pada Fase 2.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
