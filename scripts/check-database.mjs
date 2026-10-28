import { environment, request } from './lib/supabase.mjs';

try {
  const { publicKey } = environment();
  let ready = true;
  const auth = await request('/auth/v1/settings', { key: publicKey });
  const signupDisabled = auth.ok && auth.data?.disable_signup === true;
  console.log(`Pendaftaran mandiri: ${signupDisabled ? 'dinonaktifkan' : 'belum terverifikasi nonaktif; periksa Authentication → Sign In / Providers'}`);
  ready &&= signupDisabled;
  for (const table of ['departments', 'profiles', 'attendances', 'settings', 'holidays', 'audit_logs']) {
    const result = await request(`/rest/v1/${table}?select=*&limit=0`);
    console.log(`${table}: ${result.ok ? 'tersedia' : `belum dapat diakses (HTTP ${result.status})`}`);
    ready &&= result.ok;
    if (result.ok) {
      const anonymous = await request(`/rest/v1/${table}?select=*&limit=1`, { key: publicKey });
      const denied = [401, 403].includes(anonymous.status);
      console.log(`  Akses tanpa login: ${denied ? 'ditolak' : 'PERLU DIPERIKSA'}`);
      ready &&= denied;
    }
  }
  const result = await request('/storage/v1/bucket');
  for (const name of ['attendance-photos', 'avatars']) {
    const bucket = Array.isArray(result.data) ? result.data.find((item) => item.id === name) : null;
    const valid = bucket && bucket.public === false && Number(bucket.file_size_limit) === 204800 &&
      Array.isArray(bucket.allowed_mime_types) && bucket.allowed_mime_types.length === 1 &&
      bucket.allowed_mime_types[0] === 'image/jpeg';
    console.log(`${name}: ${valid ? 'private, JPEG, maksimal 200 KB' : 'belum sesuai konfigurasi'}`);
    ready &&= Boolean(valid);
  }
  const settings = await request('/rest/v1/settings?select=id&id=eq.1');
  const departments = await request('/rest/v1/departments?select=id&limit=1');
  const seeded = settings.ok && settings.data?.length === 1 && departments.ok && departments.data?.length > 0;
  console.log(`Pengaturan dan departemen awal: ${seeded ? 'tersedia' : 'belum lengkap'}`);
  ready &&= Boolean(seeded);
  const admins = await request('/rest/v1/profiles?select=id&role=eq.administrator&is_active=eq.true&limit=1');
  const hasAdmin = admins.ok && admins.data?.length > 0;
  console.log(`Administrator aktif: ${hasAdmin ? 'tersedia' : 'belum tersedia'}`);
  ready &&= Boolean(hasAdmin);
  if (!ready) process.exitCode = 1;
  else console.log('Pemeriksaan struktur melalui API selesai. Uji RLS lintas role dijalankan terpisah.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
