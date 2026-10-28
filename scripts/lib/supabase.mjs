// Utilitas CLI Node.js; tidak boleh diimpor oleh kode browser.
export function environment() {
  const names = ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY'];
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Environment belum terisi: ${missing.join(', ')}`);
  const url = new URL(process.env.PUBLIC_SUPABASE_URL);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password) {
    throw new Error('Project URL Supabase tidak valid.');
  }
  return {
    url: url.origin,
    publicKey: process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secretKey: process.env.SUPABASE_SECRET_KEY
  };
}

export async function request(path, { method = 'GET', body, key, headers = {} } = {}) {
  const config = environment();
  const apiKey = key ?? config.secretKey;
  const authHeaders = { apikey: apiKey };
  if (apiKey.startsWith('eyJ')) authHeaders.Authorization = `Bearer ${apiKey}`;
  let response;
  try {
    response = await fetch(`${config.url}${path}`, {
      method,
      headers: { ...authHeaders, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    throw new Error('Koneksi Supabase gagal atau timeout. Periksa kondisi proyek sebelum mengulangi operasi tulis.');
  }
  const data = await response.json().catch(() => null);
  // Jangan cetak respons mentah: error provider bisa menyertakan data pengguna.
  return { ok: response.ok, status: response.status, data };
}
