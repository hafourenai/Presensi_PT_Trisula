import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('migrasi perbaikan melengkapi kolom yang diperlukan saat membuat karyawan', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create table public.profiles (id uuid primary key);
    create table public.attendances (id uuid primary key);
  `);

  const migration = await readFile(
    new URL('../supabase/migrations/20261122000100_repair_employee_columns.sql', import.meta.url),
    'utf8'
  );
  await db.exec(migration);
  await db.exec(migration);

  const columns = (await db.query(`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and (
      (table_name = 'profiles' and column_name in ('work_lat', 'work_lng', 'work_radius_m', 'work_location_name'))
      or (table_name = 'attendances' and column_name in ('is_suspicious_location', 'location_flags'))
    )
  `)).rows.map(({ table_name, column_name }) => `${table_name}.${column_name}`).sort();
  assert.deepEqual(columns, [
    'attendances.is_suspicious_location', 'attendances.location_flags',
    'profiles.work_lat', 'profiles.work_lng', 'profiles.work_location_name', 'profiles.work_radius_m'
  ]);
  await assert.rejects(
    db.exec("insert into public.profiles (id, work_lat) values ('10000000-0000-4000-8000-000000000001', -6)"),
    (error) => error.code === '23514'
  );
});
