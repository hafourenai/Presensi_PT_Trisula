import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// PostgreSQL WASM asli untuk mengeksekusi migrasi/RLS. auth/storage adalah fixture
// minimal, bukan emulator layanan HTTP Supabase. Tidak menyentuh proyek cloud.
const tables = ['departments', 'profiles', 'attendances', 'settings', 'holidays', 'audit_logs'];
const ids = {
  administrator: '10000000-0000-4000-8000-000000000001',
  pemilik: '10000000-0000-4000-8000-000000000002',
  admin_hr: '10000000-0000-4000-8000-000000000003',
  karyawan: '10000000-0000-4000-8000-000000000004',
  other: '10000000-0000-4000-8000-000000000005',
  inactive: '10000000-0000-4000-8000-000000000006',
  onboarding: '10000000-0000-4000-8000-000000000007',
  unconsented: '10000000-0000-4000-8000-000000000008',
  stranger: '10000000-0000-4000-8000-000000000009'
};

test('Migrasi dan kontrol akses database', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text,
      raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}'
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to authenticated, anon;
    create schema storage;
    create table storage.buckets (
      id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, anon, service_role;
    grant select, insert, update, delete on storage.objects to authenticated, anon, service_role;
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1];
    $$;
  `);
  const migration = await readFile(new URL('../supabase/migrations/20261007000100_initial_schema.sql', import.meta.url), 'utf8');
  const seed = await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(seed);

  async function asUser(id, callback, role = 'authenticated') {
    await db.exec(`set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
    try { await callback(); }
    finally { await db.exec('reset role'); }
  }
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
  const count = async (table) => Number((await rows(`select count(*) as n from ${table}`))[0].n);
  const denied = (sql) => assert.rejects(db.exec(sql), (error) => error.code === '42501');
  const invalid = (sql, code = '23514') => assert.rejects(db.exec(sql), (error) => error.code === code);

  await t.test('RLS aktif di keenam tabel; schema private dan helper tidak terbuka ke anon', async () => {
    const result = await rows("select relname, relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'");
    assert.equal(result.length, 6);
    assert.ok(result.every((row) => row.relrowsecurity));
    assert.equal((await rows("select has_schema_privilege('anon','private','usage') as allowed"))[0].allowed, false);
    await asUser(null, () => denied('select private.get_my_role()'), 'anon');
  });

  await t.test('Seed idempotent dan pengaturan awal sesuai PRD', async () => {
    await db.exec(seed);
    assert.equal(await count('public.departments'), 5);
    const [settings] = await rows('select * from public.settings');
    assert.equal(settings.work_start, '08:00:00');
    assert.equal(settings.work_end, '16:00:00');
    assert.equal(settings.office_lat, null);
    assert.deepEqual(settings.work_days, [1, 2, 3, 4, 5]);
  });

  await t.test('Bootstrap membuat Auth, profil admin wajib ganti password, dan audit', async () => {
    await db.query(`insert into auth.users (id,email,raw_app_meta_data) values ($1,'admin@example.test', $2)`,
      [ids.administrator, JSON.stringify({ bootstrap_admin: true, bootstrap_nip: 'ADM001', bootstrap_name: 'Admin Uji' })]);
    const [profile] = await rows('select * from public.profiles where id=$1', [ids.administrator]);
    assert.equal(profile.role, 'administrator');
    assert.equal(profile.must_change_password, true);
    assert.equal(profile.consent_accepted_at, null);
    assert.equal(await count('public.audit_logs'), 1);
  });

  await t.test('Bootstrap kedua ditolak secara atomik, user_metadata tidak menaikkan role', async () => {
    await assert.rejects(db.query(`insert into auth.users (id,email,raw_app_meta_data)
      values ($1,'second@example.test','{"bootstrap_admin":true,"bootstrap_nip":"X","bootstrap_name":"X"}')`, [ids.stranger]));
    assert.equal((await rows('select id from auth.users where id=$1', [ids.stranger])).length, 0);
    await db.query(`insert into auth.users (id,email,raw_user_meta_data)
      values ($1,'stranger@example.test','{"bootstrap_admin":true,"role":"administrator"}')`, [ids.stranger]);
    assert.equal((await rows('select id from public.profiles where id=$1', [ids.stranger])).length, 0);
  });

  for (const [name, id] of Object.entries(ids)) {
    if (['administrator', 'stranger'].includes(name)) continue;
    await db.query('insert into auth.users (id,email) values ($1,$2)', [id, `${name}@example.test`]);
    await db.query(`insert into public.profiles (id,nip,full_name,email,role,is_active,must_change_password,consent_accepted_at,consent_version)
      values ($1,$2,$2,$3,$4,$5,$6,$7,$8)`, [
      id, name, `${name}@example.test`, ['pemilik', 'admin_hr'].includes(name) ? name : 'karyawan',
      name !== 'inactive', name === 'onboarding',
      name === 'unconsented' ? null : '2026-10-07T00:00:00Z', name === 'unconsented' ? null : 'v1'
    ]);
  }
  await db.query("update public.profiles set must_change_password=false, consent_accepted_at=now(), consent_version='v1' where id=$1", [ids.administrator]);
  for (const id of [ids.karyawan, ids.other, ids.inactive]) {
    await db.query(`insert into public.attendances (user_id,work_date,check_in_at,status)
      values ($1,'2026-10-07','2026-10-07T00:59:00Z','tepat_waktu')`, [id]);
    for (const bucket of ['attendance-photos', 'avatars']) {
      await db.query('insert into storage.objects (bucket_id,name) values ($1,$2)', [bucket, `${id}/2026-10-07/in.jpg`]);
    }
  }
  await db.exec("insert into public.holidays values ('2026-01-01','Hari libur uji')");

  await t.test('Anon ditolak untuk baca/tulis semua tabel', async () => {
    await asUser(null, async () => {
      for (const table of tables) {
        await denied(`select * from public.${table}`);
        await denied(`insert into public.${table} default values`);
        await denied(`delete from public.${table}`);
        const column = table === 'holidays' ? 'name' : table === 'departments' ? 'name' : table === 'profiles' ? 'full_name' : table === 'attendances' ? 'note' : table === 'settings' ? 'office_radius_m' : 'action';
        await denied(`update public.${table} set ${column}=${column}`);
      }
    }, 'anon');
  });

  await t.test('Karyawan hanya membaca profil, presensi, dan foto miliknya', async () => {
    await asUser(ids.karyawan, async () => {
      assert.deepEqual((await rows('select id from public.profiles')).map((r) => r.id), [ids.karyawan]);
      assert.deepEqual((await rows('select user_id from public.attendances')).map((r) => r.user_id), [ids.karyawan]);
      assert.equal((await rows('select * from public.profiles where id=$1', [ids.other])).length, 0);
      assert.equal(await count('storage.objects'), 2);
      assert.ok((await rows('select name from storage.objects')).every((r) => r.name.startsWith(ids.karyawan + '/')));
      assert.equal(await count('public.settings'), 0);
      assert.equal(await count('public.audit_logs'), 0);
      assert.equal(await count('public.holidays'), 1);
      assert.equal(await count('public.departments'), 5);
    });
  });

  for (const role of ['pemilik', 'admin_hr', 'administrator']) {
    await t.test(`${role}: baca lintas karyawan dengan batas audit/pengaturan`, async () => {
      await asUser(ids[role], async () => {
        assert.equal(await count('public.profiles'), 8);
        assert.equal(await count('public.attendances'), 3);
        assert.equal(await count('storage.objects'), 6);
        assert.equal(await count('public.settings'), role === 'administrator' ? 1 : 0);
        assert.equal(await count('public.audit_logs'), role === 'administrator' ? 1 : 0);
      });
    });
  }

  for (const role of ['karyawan', 'pemilik', 'admin_hr', 'administrator']) {
    await t.test(`${role}: klien tidak dapat melewati server untuk menulis atau menaikkan role`, async () => {
      await asUser(ids[role], async () => {
        await denied("update public.profiles set role='administrator'");
        await denied('update public.profiles set must_change_password=false');
        await denied('delete from public.profiles');
        await denied('insert into public.profiles select * from public.profiles');
        await denied(`insert into public.attendances (user_id, status) values ('${ids[role]}','tidak_hadir')`);
        await denied('update public.attendances set check_in_at=now()');
        await denied('delete from public.attendances');
        await denied('update public.settings set office_radius_m=999');
        await denied("insert into public.audit_logs(action) values ('palsu')");
        await denied('delete from public.audit_logs');
        await denied("update public.audit_logs set action='palsu'");
        await denied("insert into storage.objects(bucket_id,name) values ('attendance-photos','palsu/in.jpg')");
        assert.equal((await rows('delete from storage.objects returning id')).length, 0);
        assert.equal((await rows("update storage.objects set name='palsu' returning id")).length, 0);
      });
    });
  }

  for (const name of ['inactive', 'stranger', 'onboarding', 'unconsented']) {
    await t.test(`${name}: tidak mendapat data operasional atau foto`, async () => {
      await asUser(ids[name], async () => {
        assert.equal(await count('public.profiles'), ['onboarding', 'unconsented'].includes(name) ? 1 : 0);
        for (const table of tables.filter((name) => name !== 'profiles')) assert.equal(await count(`public.${table}`), 0);
        assert.equal(await count('storage.objects'), 0);
      });
    });
  }

  await t.test('Penonaktifan langsung berlaku walaupun identitas JWT masih sama', async () => {
    await db.query('update public.profiles set is_active=false where id=$1', [ids.pemilik]);
    await asUser(ids.pemilik, async () => {
      assert.equal(await count('public.profiles'), 0);
      assert.equal(await count('storage.objects'), 0);
    });
    await db.query('update public.profiles set is_active=true where id=$1', [ids.pemilik]);
  });

  await t.test('Bucket private, hanya JPEG, 200 KB; anon tidak bisa membaca foto', async () => {
    const buckets = await rows('select * from storage.buckets');
    assert.equal(buckets.length, 2);
    assert.ok(buckets.every((b) => !b.public && Number(b.file_size_limit) === 204800));
    assert.ok(buckets.every((b) => b.allowed_mime_types.join() === 'image/jpeg'));
    await asUser(null, async () => assert.equal(await count('storage.objects'), 0), 'anon');
  });

  await t.test('Constraint menolak presensi ganda, pulang tanpa masuk, GPS invalid, dan koreksi tanpa alasan', async () => {
    await invalid(`insert into public.attendances(user_id,work_date,status) values ('${ids.karyawan}','2026-10-07','tidak_hadir')`, '23505');
    await invalid(`insert into public.attendances(user_id,work_date,status,check_out_at) values ('${ids.karyawan}','2026-10-08','tidak_hadir',now())`);
    await invalid(`update public.attendances set check_in_lat=91,check_in_lng=0`);
    await invalid(`update public.attendances set check_in_lat=0,check_in_lng=null`);
    await invalid(`update public.attendances set check_in_lat=0,check_in_lng=0,check_in_accuracy='NaN'::real`);
    await invalid('update public.attendances set is_manual_correction=true,note=null');
    await invalid("update public.attendances set check_out_at='2026-10-06T00:00:00Z'");
    await invalid('update public.attendances set late_minutes=-1');
    await invalid('update public.settings set work_days=array[0,8]');
    await invalid('update public.settings set work_days=array[1,null]');
    await invalid('update public.settings set office_lat=90, office_lng=null');
    await invalid("update public.settings set work_end='07:00'");
    await invalid('update public.profiles set consent_version=null');
    assert.equal(await count('public.attendances'), 3);
  });

  await t.test('Data presensi bertahan terhadap penghapusan akun ber-riwayat', async () => {
    await assert.rejects(db.query('delete from auth.users where id=$1', [ids.karyawan]), (error) => ['23503', '23001'].includes(error.code));
    assert.equal((await rows('select * from auth.users where id=$1', [ids.karyawan])).length, 1);
  });

  await t.test('Server dapat menulis; audit API append-only', async () => {
    await asUser(null, async () => {
      await db.query(`insert into public.attendances(user_id,work_date,status) values ($1,'2026-10-08','tidak_hadir')`, [ids.karyawan]);
      assert.equal(await count('public.attendances'), 4);
      await db.exec("insert into public.audit_logs(action) values ('server_test')");
      await denied('delete from public.audit_logs');
      await denied("update public.audit_logs set action='changed'");
    }, 'service_role');
  });
});
