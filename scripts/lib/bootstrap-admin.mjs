export function adminInput(env) {
  const names = ['INITIAL_ADMIN_EMAIL', 'INITIAL_ADMIN_PASSWORD', 'INITIAL_ADMIN_NIP', 'INITIAL_ADMIN_NAME'];
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Isi environment administrator: ${missing.join(', ')}`);
  const email = env.INITIAL_ADMIN_EMAIL.trim().toLowerCase();
  const nip = env.INITIAL_ADMIN_NIP.trim();
  const fullName = env.INITIAL_ADMIN_NAME.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email administrator tidak valid.');
  if (env.INITIAL_ADMIN_PASSWORD.length < 12) throw new Error('Password awal administrator minimal 12 karakter.');
  if (nip.length > 50 || fullName.length > 200) throw new Error('NIP maksimal 50 karakter; nama maksimal 200 karakter.');
  return { email, nip, fullName, password: env.INITIAL_ADMIN_PASSWORD };
}

// request diinjeksi agar alur bootstrap dapat diuji tanpa membuat akun cloud.
export async function bootstrapAdmin(env, request) {
  const input = adminInput(env);
  const query = new URLSearchParams({ select: 'id,role,nip,is_active', email: `eq.${input.email}`, limit: '1' });
  const existing = await request(`/rest/v1/profiles?${query}`);
  if (!existing.ok) throw new Error(`Tabel profiles belum siap (HTTP ${existing.status}). Jalankan migrasi Fase 1 terlebih dahulu.`);
  const profile = existing.data?.[0];
  if (profile) {
    if (profile.role === 'administrator' && profile.nip === input.nip && profile.is_active) return 'existing';
    throw new Error('Email sudah terkait profil lain/nonaktif. Skrip tidak mengubah akun yang sudah ada.');
  }
  const admins = await request('/rest/v1/profiles?select=id&role=eq.administrator&limit=1');
  if (!admins.ok) throw new Error('Tidak dapat memeriksa administrator yang sudah ada.');
  if (admins.data?.length) throw new Error('Administrator sudah ada. Gunakan panel pengelolaan akun untuk administrator tambahan.');

  const created = await request('/auth/v1/admin/users', {
    method: 'POST',
    body: {
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: {
        bootstrap_admin: true,
        bootstrap_nip: input.nip,
        bootstrap_name: input.fullName
      }
    }
  });
  if (!created.ok) {
    throw new Error(`Pembuatan administrator ditolak (HTTP ${created.status}). Periksa migrasi/trigger dan apakah email sudah ada di Authentication → Users. Akun yang sudah ada tidak dipromosikan otomatis.`);
  }
  const id = created.data?.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error('Respons pembuatan akun tidak dapat diverifikasi. Periksa Authentication → Users sebelum mencoba lagi.');
  }
  const saved = await request(`/rest/v1/profiles?select=role,must_change_password&id=eq.${id}`);
  if (!saved.ok || saved.data?.[0]?.role !== 'administrator' || saved.data[0].must_change_password !== true) {
    throw new Error('Akun Auth dibuat tetapi profil administrator belum terverifikasi. Periksa trigger bootstrap dan profiles sebelum mencoba lagi.');
  }
  return 'created';
}
