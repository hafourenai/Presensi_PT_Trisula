import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { createLocalDbClient } from '../src/lib/server/local-db.js';
import {
  clearVerifiedAuthCache,
  getAuthCookieFingerprint,
  getCachedVerifiedUser,
  setCachedVerifiedUser
} from '../src/lib/server/auth-cache.js';
import { syncDataToLocalPg } from '../scripts/sync-supabase-to-local.mjs';

const ids = {
  admin: '10000000-0000-4000-8000-000000000001',
  hr: '10000000-0000-4000-8000-000000000002',
  emp1: '10000000-0000-4000-8000-000000000003',
  emp2: '10000000-0000-4000-8000-000000000004'
};

test('Standalone local_schema.sql and createLocalDbClient support all app query patterns without auth.users', async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());

  const schemaSql = await readFile(new URL('../supabase/local_schema.sql', import.meta.url), 'utf8');
  await pg.exec(schemaSql);

  let queryCount = 0;
  const db = createLocalDbClient({
    queryFn: async (sql, params) => {
      queryCount++;
      return pg.query(sql, params);
    },
    cacheTtlMs: 5000
  });

  // 1. Default seeded settings and departments
  const { data: settings, error: settingsErr } = await db
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();
  assert.equal(settingsErr, null);
  assert.equal(settings.office_radius_m, 100);

  // Verify hot-table cache hit avoids extra query
  const beforeCacheCount = queryCount;
  const { data: cachedSettings } = await db.from('settings').select('*').eq('id', 1).single();
  assert.equal(cachedSettings.office_radius_m, 100);
  assert.equal(queryCount, beforeCacheCount, 'second identical settings read should hit cache');

  const { data: departments } = await db
    .from('departments')
    .select('*')
    .order('name', { ascending: true });
  assert.equal(departments.length, 5);
  const opsDept = departments.find((d) => d.name === 'Operasional');
  const sdmDept = departments.find((d) => d.name === 'SDM');
  assert.ok(opsDept && sdmDept);

  // 2. Insert profiles without auth.users table existing
  const { error: insErr } = await db.from('profiles').insert([
    {
      id: ids.admin,
      nip: 'ADM-001',
      full_name: 'Super Admin',
      email: 'admin@trisula.test',
      role: 'administrator',
      department_id: sdmDept.id,
      is_active: true,
      must_change_password: false
    },
    {
      id: ids.hr,
      nip: 'HR-001',
      full_name: 'HR Manager',
      email: 'hr@trisula.test',
      role: 'admin_hr',
      department_id: sdmDept.id,
      is_active: true,
      must_change_password: false
    },
    {
      id: ids.emp1,
      nip: 'EMP-001',
      full_name: 'Budi Santoso',
      email: 'budi@trisula.test',
      role: 'karyawan',
      department_id: opsDept.id,
      is_active: true,
      must_change_password: false
    },
    {
      id: ids.emp2,
      nip: 'EMP-002',
      full_name: 'Siti Rahma',
      email: 'siti@trisula.test',
      role: 'karyawan',
      department_id: sdmDept.id,
      is_active: true,
      must_change_password: true
    }
  ]);
  assert.equal(insErr, null);

  // 3. Head count query (used on dashboard)
  const { count: activeKaryawanCount, data: headData } = await db
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'karyawan')
    .eq('is_active', true);
  assert.equal(activeKaryawanCount, 2);
  assert.equal(headData, null);

  // 4. Paginated search + department nested join (used on /admin/karyawan)
  const { data: searchResults, count: searchCount } = await db
    .from('profiles')
    .select('*, department:departments(name)', { count: 'exact' })
    .or('full_name.ilike.%budi%,nip.ilike.%budi%,email.ilike.%budi%')
    .order('created_at', { ascending: false })
    .range(0, 9);
  assert.equal(searchCount, 1);
  assert.equal(searchResults[0].full_name, 'Budi Santoso');
  assert.equal(searchResults[0].department?.name, 'Operasional');

  // 5. Attendances insert, nested profile+department join, and inner join filter (used on dashboard & laporan)
  const today = '2026-11-23';
  const { error: attErr } = await db.from('attendances').insert({
    user_id: ids.emp1,
    work_date: today,
    check_in_at: '2026-11-23T01:15:00.000Z',
    check_in_lat: -6.2,
    check_in_lng: 106.816666,
    check_in_accuracy: 12,
    check_in_distance_m: 35,
    status: 'terlambat',
    late_minutes: 15,
    is_suspicious_location: false,
    location_flags: ['ACCURACY_OK']
  });
  assert.equal(attErr, null);

  const { data: todayAttendances } = await db
    .from('attendances')
    .select('*, profile:profiles(nip, full_name, role, department:departments(name))')
    .eq('work_date', today);
  assert.equal(todayAttendances.length, 1);
  assert.equal(todayAttendances[0].work_date, today);
  assert.equal(todayAttendances[0].profile?.full_name, 'Budi Santoso');
  assert.equal(todayAttendances[0].profile?.department?.name, 'Operasional');

  // Filter by nested department via profiles!inner
  const { data: opsAttendances } = await db
    .from('attendances')
    .select('*, profile:profiles!inner(id, nip, full_name, role, department_id, department:departments(id, name))')
    .gte('work_date', '2026-11-01')
    .lte('work_date', '2026-11-30')
    .eq('profiles.department_id', opsDept.id);
  assert.equal(opsAttendances.length, 1);

  const { data: sdmAttendances } = await db
    .from('attendances')
    .select('*, profile:profiles!inner(id, nip, full_name, role, department_id, department:departments(id, name))')
    .eq('profiles.department_id', sdmDept.id);
  assert.equal(sdmAttendances.length, 0);

  // 6. Notifications insert().select().single() and .or() filter
  const { data: createdNotif, error: notifErr } = await db
    .from('notifications')
    .insert({
      user_id: ids.emp1,
      target_role: 'admin_hr',
      title: 'Perangkat Baru',
      message: 'Login dari perangkat baru',
      type: 'device_mismatch',
      payload: { nip: 'EMP-001' },
      is_read: false
    })
    .select()
    .single();
  assert.equal(notifErr, null);
  assert.equal(createdNotif.title, 'Perangkat Baru');
  assert.equal(createdNotif.payload?.nip, 'EMP-001');

  const { data: hrNotifs } = await db
    .from('notifications')
    .select('*')
    .or('target_role.eq.admin_hr,target_role.is.null')
    .order('created_at', { ascending: false })
    .limit(5);
  assert.equal(hrNotifs.length, 1);

  // 7. Audit logs with actor nested join
  await db.from('audit_logs').insert({
    actor_id: ids.admin,
    action: 'update_system_settings',
    target_type: 'settings',
    target_id: '1',
    detail: { office_radius_m: 150 }
  });
  const { data: logs } = await db
    .from('audit_logs')
    .select('*, actor:profiles(nip, full_name, role)')
    .order('created_at', { ascending: false })
    .limit(10);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actor?.full_name, 'Super Admin');
  assert.equal(logs[0].detail?.office_radius_m, 150);

  // 8. Administrator protection trigger and atomic RPC rotation
  const { error: directDemoteErr } = await db
    .from('profiles')
    .update({ role: 'admin_hr' })
    .eq('id', ids.admin);
  assert.ok(directDemoteErr, 'Direct demotion of administrator must be blocked by trigger');

  const { error: rotateErr } = await db.rpc('rotate_administrator', {
    candidate_id: ids.hr,
    previous_role: 'admin_hr',
    deactivate_previous: false
  });
  assert.equal(rotateErr, null);

  const { data: newAdmin } = await db.from('profiles').select('role').eq('id', ids.hr).single();
  const { data: oldAdmin } = await db.from('profiles').select('role').eq('id', ids.admin).single();
  assert.equal(newAdmin.role, 'administrator');
  assert.equal(oldAdmin.role, 'admin_hr');
});

test('syncDataToLocalPg synchronizes Supabase Cloud datasets idempotently into local PostgreSQL', async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());

  const schemaSql = await readFile(new URL('../supabase/local_schema.sql', import.meta.url), 'utf8');
  await pg.exec(schemaSql);

  const cloudDeptId = '20000000-0000-4000-8000-000000000099';
  const datasets = {
    departments: [{ id: cloudDeptId, name: 'Operasional' }],
    profiles: [
      {
        id: ids.admin,
        nip: 'ADM-SYNC',
        full_name: 'Synced Admin',
        email: 'admin@sync.test',
        role: 'administrator',
        department_id: cloudDeptId,
        is_active: true,
        must_change_password: false
      },
      {
        id: ids.hr,
        nip: 'HR-SYNC',
        full_name: 'Legacy Owner Normalized',
        email: 'owner@sync.test',
        role: 'pemilik',
        department_id: cloudDeptId,
        is_active: true,
        must_change_password: false
      }
    ],
    settings: [
      {
        id: 1,
        work_start: '08:00',
        work_end: '16:30',
        late_tolerance_min: 10,
        work_days: [1, 2, 3, 4, 5],
        office_radius_m: 120,
        photo_retention_days: 30
      }
    ],
    holidays: [{ holiday_date: '2026-12-25', name: 'Hari Natal' }],
    attendances: [
      {
        id: '30000000-0000-4000-8000-000000000001',
        user_id: ids.admin,
        work_date: '2026-11-23',
        check_in_at: '2026-11-23T00:55:00.000Z',
        status: 'tepat_waktu',
        late_minutes: 0,
        early_leave_minutes: 0
      }
    ],
    user_devices: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        user_id: ids.admin,
        device_id: 'dev-123',
        device_name: 'Chrome Android'
      }
    ],
    notifications: [
      {
        id: '50000000-0000-4000-8000-000000000001',
        user_id: ids.admin,
        target_role: 'admin_hr',
        title: 'Sync Alert',
        message: 'Test sync notification',
        payload: { ok: true },
        is_read: false
      }
    ],
    audit_logs: [
      {
        id: 42,
        actor_id: ids.admin,
        action: 'bootstrap_administrator',
        target_type: 'profiles',
        target_id: ids.admin,
        detail: { source: 'cloud-sync' }
      }
    ]
  };

  const counts = await syncDataToLocalPg(pg, datasets);
  assert.equal(counts.profiles, 2);
  assert.equal(counts.attendances, 1);
  assert.equal(counts.audit_logs, 1);

  const db = createLocalDbClient({ queryFn: (sql, params) => pg.query(sql, params) });
  const { data: syncedOwner } = await db.from('profiles').select('*, department:departments(name)').eq('id', ids.hr).single();
  assert.equal(syncedOwner.role, 'admin_hr', 'Legacy pemilik role is normalized to admin_hr on sync');
  assert.equal(syncedOwner.department?.name, 'Operasional');

  // Verify subsequent audit log insert gets id > 42
  const { data: nextAudit, error: nextAuditErr } = await db
    .from('audit_logs')
    .insert({ actor_id: ids.admin, action: 'post_sync_event' })
    .select()
    .single();
  assert.equal(nextAuditErr, null);
  assert.ok(Number(nextAudit.id) > 42);
});

test('auth cookie fingerprint cache deduplicates verified user lookups and invalidates cleanly', () => {
  clearVerifiedAuthCache();
  const cookies = [
    { name: 'other_cookie', value: 'ignore' },
    { name: 'sb-project-auth-token.0', value: 'part0' },
    { name: 'sb-project-auth-token.1', value: 'part1' }
  ];
  const fp = getAuthCookieFingerprint(cookies);
  assert.ok(fp && fp.length === 64);

  const user = { id: ids.emp1, email: 'budi@trisula.test' };
  setCachedVerifiedUser(fp, user, 10000);
  assert.deepEqual(getCachedVerifiedUser(fp), user);

  clearVerifiedAuthCache(fp);
  assert.equal(getCachedVerifiedUser(fp), null);
});

