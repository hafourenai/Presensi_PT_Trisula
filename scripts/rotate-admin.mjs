import { request } from './lib/supabase.mjs';
import { rotateAdmin } from './lib/rotate-admin.mjs';
import { runFullSync } from './sync-supabase-to-local.mjs';

try {
  const result = await rotateAdmin(process.env, request);
  if (process.env.DATABASE_URL?.trim()) {
    await runFullSync({ databaseUrl: process.env.DATABASE_URL, requestFn: request });
    console.log('Perubahan rotasi administrator berhasil disinkronkan ke PostgreSQL lokal.');
  }
  console.log(`Rotasi administrator berhasil. Calon akun ${result.created ? 'baru dibuat' : 'yang sudah ada digunakan'}.`);
  console.log('Hapus ROTATION_ADMIN_PASSWORD dari environment setelah selesai. Administrator baru wajib mengganti password.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
