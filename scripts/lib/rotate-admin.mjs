function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Isi environment rotasi administrator: ${name}`);
  return value;
}

export function rotationInput(env) {
  const email = required(env, 'ROTATION_ADMIN_EMAIL').toLowerCase();
  const nip = required(env, 'ROTATION_ADMIN_NIP');
  const fullName = required(env, 'ROTATION_ADMIN_NAME');
  const previousRole = (env.PREVIOUS_ADMIN_ROLE || 'admin_hr').trim();
  const deactivatePrevious = env.DEACTIVATE_PREVIOUS_ADMIN === 'true';
  const password = env.ROTATION_ADMIN_PASSWORD || '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email calon administrator tidak valid.');
  if (!['admin_hr', 'karyawan'].includes(previousRole)) throw new Error('PREVIOUS_ADMIN_ROLE harus admin_hr atau karyawan.');
  if (password && password.length < 12) throw new Error('Password calon administrator minimal 12 karakter.');
  if (nip.length > 50 || fullName.length > 200) throw new Error('NIP maksimal 50 karakter; nama maksimal 200 karakter.');

  return { email, nip, fullName, password, previousRole, deactivatePrevious };
}

export async function rotateAdmin(env, request) {
  const input = rotationInput(env);
  const query = new URLSearchParams({ select: 'id,role,nip,full_name,is_active', email: `eq.${input.email}`, limit: '1' });
  const existing = await request(`/rest/v1/profiles?${query}`);
  if (!existing.ok) throw new Error('Tidak dapat memeriksa profil calon administrator.');

  let candidate = existing.data?.[0];
  let createdUserId = null;

  if (candidate) {
    if (!candidate.is_active || !['admin_hr', 'karyawan'].includes(candidate.role)) {
      throw new Error('Calon administrator harus merupakan akun aktif Admin HR atau Karyawan.');
    }
    if (candidate.nip !== input.nip || candidate.full_name !== input.fullName) {
      throw new Error('NIP atau nama calon tidak cocok dengan profil yang sudah ada.');
    }
  } else {
    if (!input.password) throw new Error('ROTATION_ADMIN_PASSWORD wajib untuk calon akun baru.');
    const created = await request('/auth/v1/admin/users', {
      method: 'POST',
      body: { email: input.email, password: input.password, email_confirm: true }
    });
    if (!created.ok || !created.data?.id) throw new Error(`Pembuatan calon Auth ditolak (HTTP ${created.status}).`);
    createdUserId = created.data.id;
    candidate = { id: createdUserId };

    const profile = await request('/rest/v1/profiles', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: {
        id: createdUserId,
        nip: input.nip,
        full_name: input.fullName,
        email: input.email,
        role: 'karyawan',
        is_active: true,
        must_change_password: true
      }
    });
    if (!profile.ok) {
      await request(`/auth/v1/admin/users/${createdUserId}`, { method: 'DELETE' });
      throw new Error('Profil calon gagal dibuat; akun Auth baru telah dibatalkan.');
    }
  }

  const rotated = await request('/rest/v1/rpc/rotate_administrator', {
    method: 'POST',
    body: {
      candidate_id: candidate.id,
      previous_role: input.previousRole,
      deactivate_previous: input.deactivatePrevious
    }
  });

  if (!rotated.ok) {
    if (createdUserId) await request(`/auth/v1/admin/users/${createdUserId}`, { method: 'DELETE' });
    throw new Error('Rotasi database gagal; perubahan dibatalkan dan calon akun baru telah dikompensasi.');
  }

  return { candidateId: candidate.id, created: Boolean(createdUserId) };
}
