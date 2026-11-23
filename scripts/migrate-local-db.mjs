import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Pool } = pg;

export async function migrateLocalDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl?.trim()) {
    throw new Error('DATABASE_URL belum dikonfigurasi pada environment.');
  }

  const schemaSql = await readFile(new URL('../supabase/local_schema.sql', import.meta.url), 'utf8');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query(schemaSql);
    const { rows } = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    return rows.map((r) => r.tablename);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('migrate-local-db.mjs')) {
  try {
    const tables = await migrateLocalDb();
    console.log(`Skema PostgreSQL lokal berhasil diterapkan. Tabel aktif (${tables.length}): ${tables.join(', ')}`);
  } catch (err) {
    console.error('Gagal menerapkan skema PostgreSQL lokal:', err.message);
    process.exitCode = 1;
  }
}
