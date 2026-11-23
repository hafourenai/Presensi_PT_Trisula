import { request } from './lib/supabase.mjs';
import { rotateAdmin, rotationInput } from './lib/rotate-admin.mjs';
import { mirrorRotation, withLocalClient } from './lib/local-admin-sync.mjs';

try {
  const result = await rotateAdmin(process.env, request);
  if (process.env.DATABASE_URL?.trim()) {
    const { previousRole, deactivatePrevious } = rotationInput(process.env);
    await withLocalClient(process.env.DATABASE_URL, (client) =>
      mirrorRotation(client, request, { candidateId: result.candidateId, previousRole, deactivatePrevious })
    );
    console.log('Perubahan rotasi administrator berhasil disinkronkan ke PostgreSQL lokal.');
  }
  console.log(`Rotasi administrator berhasil. Calon akun ${result.created ? 'baru dibuat' : 'yang sudah ada digunakan'}.`);
  console.log('Hapus ROTATION_ADMIN_PASSWORD dari environment setelah selesai. Administrator baru wajib mengganti password.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
