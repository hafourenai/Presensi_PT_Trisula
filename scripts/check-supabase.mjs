// Jalankan: node --env-file=.env scripts/check-supabase.mjs
// Pemeriksaan read-only; tidak mencetak key atau data akun.
const names = [
  'PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY'
];
const missing = names.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Environment belum terisi: ${missing.join(', ')}`);
  process.exit(1);
}

let url;
try {
  url = new URL(process.env.PUBLIC_SUPABASE_URL);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password) {
    throw new Error('URL tidak valid');
  }
} catch {
  console.error('Project URL harus berupa URL HTTPS proyek Supabase yang valid.');
  process.exit(1);
}

console.log('Ketiga environment terisi; format Project URL valid.');
for (const [label, path, key] of [
  ['Publishable key', '/auth/v1/settings', process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY],
  ['Secret key / Admin API', '/auth/v1/admin/users?page=1&per_page=1', process.env.SUPABASE_SECRET_KEY]
]) {
  try {
    const headers = { apikey: key };
    // Legacy JWT keys memerlukan bearer; key sb_* menggunakan header apikey.
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(new URL(path, url), {
      headers,
      signal: AbortSignal.timeout(15000)
    });
    console.log(`${label}: HTTP ${response.status} (${response.ok ? 'berhasil' : 'gagal'})`);
    if (!response.ok) process.exitCode = 1;
    await response.body?.cancel();
  } catch {
    console.error(`${label}: koneksi gagal atau timeout.`);
    process.exitCode = 1;
  }
}
