import { bootstrapAdmin, adminInput } from './lib/bootstrap-admin.mjs';
import { request } from './lib/supabase.mjs';
import { mirrorBootstrapAdmin, withLocalClient } from './lib/local-admin-sync.mjs';

try {
  const status = await bootstrapAdmin(process.env, request);
  if (process.env.DATABASE_URL?.trim()) {
    const { email } = adminInput(process.env);
    await withLocalClient(process.env.DATABASE_URL, (client) => mirrorBootstrapAdmin(client, request, email));
    console.log('Profil administrator berhasil disinkronkan ke PostgreSQL lokal.');
  }
  console.log(status === 'created'
    ? 'Administrator awal berhasil dibuat bersama profil dan audit. Wajib ganti password saat login pertama.'
    : 'Administrator awal sudah tersedia. Password dan profil tidak diubah.');
  console.log('Hapus INITIAL_ADMIN_PASSWORD dari .env setelah selesai. Halaman login tersedia pada Fase 2.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
