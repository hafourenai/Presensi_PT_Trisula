import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('Role normalization and single-administrator database invariants', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create schema storage;
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1]
    $$;
    create type public.user_role as enum ('administrator', 'pemilik', 'admin_hr', 'karyawan');
    create table public.profiles (
      id uuid primary key,
      role public.user_role not null,
      is_active boolean not null default true,
      must_change_password boolean not null default false,
      updated_at timestamptz not null default now()
    );
    create table public.attendances (id uuid primary key default gen_random_uuid(), user_id uuid);
    create table public.notifications (id uuid primary key default gen_random_uuid(), target_role text);
    create table public.audit_logs (
      id bigint generated always as identity primary key,
      actor_id uuid,
      action text not null,
      target_type text,
      target_id text,
      detail jsonb,
      created_at timestamptz not null default now()
    );
    create schema private;
    create function private.get_my_role() returns public.user_role language sql stable as $$ select null::public.user_role $$;
    create function private.get_app_role() returns public.user_role language sql stable as $$ select null::public.user_role $$;
    insert into public.profiles (id, role) values
      ('10000000-0000-4000-8000-000000000001', 'administrator'),
      ('10000000-0000-4000-8000-000000000002', 'pemilik');
    insert into public.notifications (target_role) values ('hr'), ('pemilik');
  `);

  const migration = await readFile(
    new URL('../supabase/migrations/20261116000100_single_administrator_roles.sql', import.meta.url),
    'utf8'
  );
  await db.exec(migration);

  const roles = (await db.query('select role::text as role from public.profiles order by id')).rows;
  assert.deepEqual(roles.map(({ role }) => role), ['administrator', 'admin_hr']);
  const targets = (await db.query('select target_role from public.notifications order by target_role')).rows;
  assert.deepEqual(targets.map(({ target_role }) => target_role), ['admin_hr', 'admin_hr']);

  await assert.rejects(
    db.exec("insert into public.profiles (id, role) values ('10000000-0000-4000-8000-000000000003', 'administrator')"),
    (error) => error.code === '23505'
  );
  await assert.rejects(
    db.exec("update public.profiles set role='admin_hr' where role='administrator'"),
    (error) => error.code === '42501'
  );
  await assert.rejects(
    db.exec("update public.profiles set is_active=false where role='administrator'"),
    (error) => error.code === '42501'
  );
  await assert.rejects(
    db.exec("delete from public.profiles where role='administrator'"),
    (error) => error.code === '42501'
  );

  const rotationMigration = await readFile(
    new URL('../supabase/migrations/20261116000200_atomic_administrator_rotation.sql', import.meta.url),
    'utf8'
  );
  await db.exec(rotationMigration);
  await db.exec('set role service_role');
  await db.exec("select public.rotate_administrator('10000000-0000-4000-8000-000000000002', 'admin_hr', false)");
  await db.exec('reset role');

  const rotated = (await db.query('select id, role::text as role, is_active, must_change_password from public.profiles order by id')).rows;
  assert.equal(rotated[0].role, 'admin_hr');
  assert.equal(rotated[1].role, 'administrator');
  assert.equal(rotated[1].must_change_password, true);
  assert.equal((await db.query("select count(*)::int as count from public.profiles where role='administrator' and is_active")).rows[0].count, 1);
  assert.equal((await db.query("select count(*)::int as count from public.audit_logs where action='rotate_administrator'")).rows[0].count, 1);
});
