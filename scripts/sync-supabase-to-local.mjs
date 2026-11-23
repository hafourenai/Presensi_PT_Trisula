import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { request } from './lib/supabase.mjs';

const { Pool } = pg;

export const SYNC_TABLES_ORDER = [
  'departments',
  'profiles',
  'settings',
  'holidays',
  'attendances',
  'user_devices',
  'notifications',
  'audit_logs'
];

export async function fetchAllFromSupabase(table, requestFn = request) {
  const pageSize = 1000;
  let offset = 0;
  const allRows = [];

  while (true) {
    const orderParam =
      table === 'holidays'
        ? 'holiday_date.asc'
        : table === 'settings' || table === 'departments' || table === 'audit_logs'
          ? 'id.asc'
          : 'created_at.asc';

    const res = await requestFn(
      `/rest/v1/${table}?select=*&order=${orderParam}&limit=${pageSize}&offset=${offset}`
    );

    if (!res.ok) {
      if (res.status === 404 && ['user_devices', 'notifications'].includes(table)) {
        return [];
      }
      throw new Error(`Gagal membaca tabel ${table} dari Supabase Cloud (HTTP ${res.status})`);
    }

    const batch = Array.isArray(res.data) ? res.data : [];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}

/**
 * Synchronizes fetched table datasets into a local PostgreSQL client/connection.
 */
export async function syncDataToLocalPg(client, datasets) {
  const counts = {};

  await client.query('BEGIN');
  try {
    // Allow administrator profile synchronization without triggering tamper error
    await client.query("SELECT pg_catalog.set_config('app.administrator_rotation', 'true', true)");

    // 1. Departments
    const departments = datasets.departments || [];
    for (const row of departments) {
      await client.query(
        `UPDATE public.departments
         SET id = $1
         WHERE name = $2 AND id <> $1
           AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE department_id = public.departments.id)`,
        [row.id, row.name]
      );
      await client.query(
        `INSERT INTO public.departments (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [row.id, row.name]
      );
    }
    counts.departments = departments.length;

    // 2. Profiles
    const profiles = datasets.profiles || [];
    for (const row of profiles) {
      const normalizedRole = ['pemilik', 'hr'].includes(row.role) ? 'admin_hr' : (row.role || 'karyawan');
      await client.query(
        `INSERT INTO public.profiles (
          id, nip, full_name, email, phone, gender, address, position,
          department_id, join_date, photo_path, role, is_active,
          must_change_password, consent_accepted_at, consent_version,
          last_login_at, work_location_name, work_lat, work_lng, work_radius_m,
          created_at, updated_at
        ) VALUES (
          $1::uuid, $2, $3, $4, $5, $6, $7, $8,
          $9::uuid, $10::date, $11, $12::public.user_role, $13::boolean,
          $14::boolean, $15::timestamptz, $16,
          $17::timestamptz, $18, $19::double precision, $20::double precision, $21::int,
          COALESCE($22::timestamptz, now()), COALESCE($23::timestamptz, now())
        )
        ON CONFLICT (id) DO UPDATE SET
          nip = EXCLUDED.nip,
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          gender = EXCLUDED.gender,
          address = EXCLUDED.address,
          position = EXCLUDED.position,
          department_id = EXCLUDED.department_id,
          join_date = EXCLUDED.join_date,
          photo_path = EXCLUDED.photo_path,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active,
          must_change_password = EXCLUDED.must_change_password,
          consent_accepted_at = EXCLUDED.consent_accepted_at,
          consent_version = EXCLUDED.consent_version,
          last_login_at = EXCLUDED.last_login_at,
          work_location_name = EXCLUDED.work_location_name,
          work_lat = EXCLUDED.work_lat,
          work_lng = EXCLUDED.work_lng,
          work_radius_m = EXCLUDED.work_radius_m,
          updated_at = EXCLUDED.updated_at`,
        [
          row.id,
          row.nip,
          row.full_name,
          String(row.email || '').toLowerCase().trim(),
          row.phone ?? null,
          row.gender ?? null,
          row.address ?? null,
          row.position ?? null,
          row.department_id ?? null,
          row.join_date ?? null,
          row.photo_path ?? null,
          normalizedRole,
          row.is_active ?? true,
          row.must_change_password ?? true,
          row.consent_accepted_at ?? null,
          row.consent_version ?? null,
          row.last_login_at ?? null,
          row.work_location_name ?? null,
          row.work_lat ?? null,
          row.work_lng ?? null,
          row.work_radius_m ?? null,
          row.created_at ?? null,
          row.updated_at ?? null
        ]
      );
    }
    counts.profiles = profiles.length;

    // 3. Settings
    const settings = datasets.settings || [];
    for (const row of settings) {
      await client.query(
        `INSERT INTO public.settings (
          id, work_start, work_end, late_tolerance_min, work_days,
          office_lat, office_lng, office_radius_m, photo_retention_days,
          telegram_bot_token, telegram_chat_id, telegram_alerts_enabled,
          require_device_binding, updated_at
        ) VALUES (
          1, COALESCE($1::time, '08:00'::time), COALESCE($2::time, '16:00'::time), COALESCE($3::int, 0), COALESCE($4::int[], '{1,2,3,4,5}'::int[]),
          $5::double precision, $6::double precision, COALESCE($7::int, 100), COALESCE($8::int, 30),
          $9, $10, COALESCE($11::boolean, true),
          COALESCE($12::boolean, true), COALESCE($13::timestamptz, now())
        )
        ON CONFLICT (id) DO UPDATE SET
          work_start = EXCLUDED.work_start,
          work_end = EXCLUDED.work_end,
          late_tolerance_min = EXCLUDED.late_tolerance_min,
          work_days = EXCLUDED.work_days,
          office_lat = EXCLUDED.office_lat,
          office_lng = EXCLUDED.office_lng,
          office_radius_m = EXCLUDED.office_radius_m,
          photo_retention_days = EXCLUDED.photo_retention_days,
          telegram_bot_token = EXCLUDED.telegram_bot_token,
          telegram_chat_id = EXCLUDED.telegram_chat_id,
          telegram_alerts_enabled = EXCLUDED.telegram_alerts_enabled,
          require_device_binding = EXCLUDED.require_device_binding,
          updated_at = EXCLUDED.updated_at`,
        [
          row.work_start ?? '08:00',
          row.work_end ?? '16:00',
          row.late_tolerance_min ?? 0,
          row.work_days ?? [1, 2, 3, 4, 5],
          row.office_lat ?? null,
          row.office_lng ?? null,
          row.office_radius_m ?? 100,
          row.photo_retention_days ?? 30,
          row.telegram_bot_token ?? null,
          row.telegram_chat_id ?? null,
          row.telegram_alerts_enabled ?? true,
          row.require_device_binding ?? true,
          row.updated_at ?? null
        ]
      );
    }
    counts.settings = settings.length;

    // 4. Holidays
    const holidays = datasets.holidays || [];
    for (const row of holidays) {
      await client.query(
        `INSERT INTO public.holidays (holiday_date, name)
         VALUES ($1::date, $2)
         ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name`,
        [row.holiday_date, row.name]
      );
    }
    counts.holidays = holidays.length;

    // 5. Attendances
    const attendances = datasets.attendances || [];
    for (const row of attendances) {
      await client.query(
        `INSERT INTO public.attendances (
          id, user_id, work_date, check_in_at, check_in_photo,
          check_in_lat, check_in_lng, check_in_accuracy, check_in_distance_m,
          check_in_device_id, check_in_device_name, is_unrecognized_device,
          check_out_at, check_out_photo, check_out_lat, check_out_lng,
          check_out_accuracy, check_out_distance_m, check_out_device_id,
          status, late_minutes, early_leave_minutes, missing_checkout,
          is_manual_correction, is_suspicious_location, location_flags,
          note, created_at, updated_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::date, $4::timestamptz, $5,
          $6::double precision, $7::double precision, $8::real, $9::real,
          $10, $11, COALESCE($12::boolean, false),
          $13::timestamptz, $14, $15::double precision, $16::double precision,
          $17::real, $18::real, $19,
          $20::public.attendance_status, COALESCE($21::int, 0), COALESCE($22::int, 0), COALESCE($23::boolean, false),
          COALESCE($24::boolean, false), COALESCE($25::boolean, false), COALESCE($26::text[], '{}'::text[]),
          $27, COALESCE($28::timestamptz, now()), COALESCE($29::timestamptz, now())
        )
        ON CONFLICT (id) DO UPDATE SET
          check_in_at = EXCLUDED.check_in_at,
          check_in_photo = EXCLUDED.check_in_photo,
          check_in_lat = EXCLUDED.check_in_lat,
          check_in_lng = EXCLUDED.check_in_lng,
          check_in_accuracy = EXCLUDED.check_in_accuracy,
          check_in_distance_m = EXCLUDED.check_in_distance_m,
          check_in_device_id = EXCLUDED.check_in_device_id,
          check_in_device_name = EXCLUDED.check_in_device_name,
          is_unrecognized_device = EXCLUDED.is_unrecognized_device,
          check_out_at = EXCLUDED.check_out_at,
          check_out_photo = EXCLUDED.check_out_photo,
          check_out_lat = EXCLUDED.check_out_lat,
          check_out_lng = EXCLUDED.check_out_lng,
          check_out_accuracy = EXCLUDED.check_out_accuracy,
          check_out_distance_m = EXCLUDED.check_out_distance_m,
          check_out_device_id = EXCLUDED.check_out_device_id,
          status = EXCLUDED.status,
          late_minutes = EXCLUDED.late_minutes,
          early_leave_minutes = EXCLUDED.early_leave_minutes,
          missing_checkout = EXCLUDED.missing_checkout,
          is_manual_correction = EXCLUDED.is_manual_correction,
          is_suspicious_location = EXCLUDED.is_suspicious_location,
          location_flags = EXCLUDED.location_flags,
          note = EXCLUDED.note,
          updated_at = EXCLUDED.updated_at`,
        [
          row.id,
          row.user_id,
          row.work_date,
          row.check_in_at ?? null,
          row.check_in_photo ?? null,
          row.check_in_lat ?? null,
          row.check_in_lng ?? null,
          row.check_in_accuracy ?? null,
          row.check_in_distance_m ?? null,
          row.check_in_device_id ?? null,
          row.check_in_device_name ?? null,
          row.is_unrecognized_device ?? false,
          row.check_out_at ?? null,
          row.check_out_photo ?? null,
          row.check_out_lat ?? null,
          row.check_out_lng ?? null,
          row.check_out_accuracy ?? null,
          row.check_out_distance_m ?? null,
          row.check_out_device_id ?? null,
          row.status,
          row.late_minutes ?? 0,
          row.early_leave_minutes ?? 0,
          row.missing_checkout ?? false,
          row.is_manual_correction ?? false,
          row.is_suspicious_location ?? false,
          row.location_flags ?? [],
          row.note ?? null,
          row.created_at ?? null,
          row.updated_at ?? null
        ]
      );
    }
    counts.attendances = attendances.length;

    // 6. User Devices
    const userDevices = datasets.user_devices || [];
    for (const row of userDevices) {
      await client.query(
        `INSERT INTO public.user_devices (
          id, user_id, device_id, device_name, user_agent,
          browser, os, ip_address, is_trusted, registered_at, last_used_at
        ) VALUES (
          $1::uuid, $2::uuid, $3, COALESCE($4, 'Perangkat Utama'), $5,
          $6, $7, $8, COALESCE($9::boolean, true), COALESCE($10::timestamptz, now()), COALESCE($11::timestamptz, now())
        )
        ON CONFLICT (id) DO UPDATE SET
          device_name = EXCLUDED.device_name,
          user_agent = EXCLUDED.user_agent,
          browser = EXCLUDED.browser,
          os = EXCLUDED.os,
          ip_address = EXCLUDED.ip_address,
          is_trusted = EXCLUDED.is_trusted,
          last_used_at = EXCLUDED.last_used_at`,
        [
          row.id,
          row.user_id,
          row.device_id,
          row.device_name ?? 'Perangkat Utama',
          row.user_agent ?? null,
          row.browser ?? null,
          row.os ?? null,
          row.ip_address ?? null,
          row.is_trusted ?? true,
          row.registered_at ?? null,
          row.last_used_at ?? null
        ]
      );
    }
    counts.user_devices = userDevices.length;

    // 7. Notifications
    const notifications = datasets.notifications || [];
    for (const row of notifications) {
      await client.query(
        `INSERT INTO public.notifications (
          id, user_id, target_role, title, message, type, payload, is_read, created_at
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4, $5, COALESCE($6, 'device_mismatch'), $7::jsonb, COALESCE($8::boolean, false), COALESCE($9::timestamptz, now())
        )
        ON CONFLICT (id) DO UPDATE SET
          is_read = EXCLUDED.is_read,
          payload = EXCLUDED.payload`,
        [
          row.id,
          row.user_id ?? null,
          row.target_role ?? null,
          row.title,
          row.message,
          row.type ?? 'device_mismatch',
          JSON.stringify(row.payload ?? {}),
          row.is_read ?? false,
          row.created_at ?? null
        ]
      );
    }
    counts.notifications = notifications.length;

    // 8. Audit Logs
    const auditLogs = datasets.audit_logs || [];
    for (const row of auditLogs) {
      await client.query(
        `INSERT INTO public.audit_logs (
          id, actor_id, action, target_type, target_id, detail, created_at
        ) OVERRIDING SYSTEM VALUE VALUES (
          $1::bigint, $2::uuid, $3, $4, $5, $6::jsonb, COALESCE($7::timestamptz, now())
        )
        ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.actor_id ?? null,
          row.action,
          row.target_type ?? null,
          row.target_id ?? null,
          row.detail ? JSON.stringify(row.detail) : null,
          row.created_at ?? null
        ]
      );
    }
    if (auditLogs.length > 0) {
      await client.query(`
        SELECT setval(
          pg_get_serial_sequence('public.audit_logs', 'id'),
          COALESCE((SELECT MAX(id) FROM public.audit_logs), 1),
          true
        )
      `);
    }
    counts.audit_logs = auditLogs.length;

    await client.query('COMMIT');
    return counts;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

export async function runFullSync({
  databaseUrl = process.env.DATABASE_URL,
  requestFn = request
} = {}) {
  if (!databaseUrl?.trim()) {
    throw new Error('DATABASE_URL belum dikonfigurasi pada environment.');
  }

  const schemaSql = await readFile(new URL('../supabase/local_schema.sql', import.meta.url), 'utf8');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query(schemaSql);

    const datasets = {};
    for (const table of SYNC_TABLES_ORDER) {
      datasets[table] = await fetchAllFromSupabase(table, requestFn);
    }

    const client = await pool.connect();
    try {
      return await syncDataToLocalPg(client, datasets);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('sync-supabase-to-local.mjs')) {
  try {
    console.log('Memulai sinkronisasi data dari Supabase Cloud ke PostgreSQL lokal...');
    const counts = await runFullSync();
    for (const [table, count] of Object.entries(counts)) {
      console.log(`  - ${table}: ${count} baris tersinkronisasi`);
    }
    console.log('Sinkronisasi selesai dengan sukses.');
  } catch (err) {
    console.error('Sinkronisasi gagal:', err.message);
    process.exitCode = 1;
  }
}
