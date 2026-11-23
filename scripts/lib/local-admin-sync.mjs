// Sinkronisasi terarah administrator ke PostgreSQL lokal.
// Hanya menyentuh profil administrator terkait dan audit lognya; tidak pernah
// menimpa data operasional lokal (presensi, profil lain, pengaturan) dengan data cloud.
import pg from 'pg';

const { Pool } = pg;

async function fetchCloudProfile(requestFn, filter) {
  const query = new URLSearchParams({ select: '*', ...filter, limit: '1' });
  const res = await requestFn(`/rest/v1/profiles?${query}`);
  if (!res.ok) throw new Error(`Tidak dapat membaca profil administrator dari Supabase Cloud (HTTP ${res.status}).`);
  const profile = res.data?.[0];
  if (!profile?.id) throw new Error('Profil administrator tidak ditemukan di Supabase Cloud.');
  return profile;
}

async function insertProfileIfMissing(client, profile, role) {
  await client.query(
    `INSERT INTO public.profiles (id, nip, full_name, email, role, is_active, must_change_password)
     VALUES ($1::uuid, $2, $3, $4, $5::public.user_role, true, $6::boolean)
     ON CONFLICT (id) DO NOTHING`,
    [
      profile.id,
      profile.nip,
      profile.full_name,
      String(profile.email || '').toLowerCase().trim(),
      role,
      profile.must_change_password ?? true
    ]
  );
}

async function inTransaction(client, fn) {
  await client.query('BEGIN');
  try {
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Mencerminkan administrator hasil bootstrap ke PostgreSQL lokal.
 * Idempoten: profil dan audit hanya dibuat bila belum ada.
 */
export async function mirrorBootstrapAdmin(client, requestFn, email) {
  const profile = await fetchCloudProfile(requestFn, { email: `eq.${String(email).toLowerCase().trim()}` });
  if (profile.role !== 'administrator') {
    throw new Error('Profil cloud bukan administrator; sinkronisasi lokal dibatalkan.');
  }

  return inTransaction(client, async () => {
    const existing = await client.query(
      "SELECT id FROM public.profiles WHERE role = 'administrator' LIMIT 1"
    );
    const localAdminId = existing.rows[0]?.id;
    if (localAdminId && localAdminId !== profile.id) {
      throw new Error('PostgreSQL lokal sudah memiliki administrator lain. Gunakan rotasi administrator.');
    }

    await insertProfileIfMissing(client, profile, 'administrator');

    const audit = await client.query(
      `SELECT 1 FROM public.audit_logs
       WHERE action = 'bootstrap_administrator' AND target_id = $1 LIMIT 1`,
      [profile.id]
    );
    if (!audit.rows.length) {
      await client.query(
        `INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, detail)
         VALUES ($1::uuid, 'bootstrap_administrator', 'profiles', $1::text, '{"source":"seed-admin"}'::jsonb)`,
        [profile.id]
      );
    }
    return profile.id;
  });
}

/**
 * Menerapkan rotasi administrator yang sama pada PostgreSQL lokal melalui RPC lokal,
 * sehingga peran administrator lama/baru dan audit log tetap konsisten.
 */
export async function mirrorRotation(client, requestFn, { candidateId, previousRole, deactivatePrevious }) {
  const profile = await fetchCloudProfile(requestFn, { id: `eq.${candidateId}` });

  return inTransaction(client, async () => {
    // Calon baru dibuat sebagai karyawan dulu; RPC lokal yang mempromosikannya.
    await insertProfileIfMissing(client, profile, 'karyawan');
    await client.query(
      'SELECT public.rotate_administrator($1::uuid, $2::public.user_role, $3::boolean)',
      [candidateId, previousRole, deactivatePrevious]
    );
    return candidateId;
  });
}

export async function withLocalClient(databaseUrl, fn) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const client = await pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
