-- Standalone Local PostgreSQL Schema for PT Trisula Attendance System
-- Compatible with PostgreSQL 15/16/17 without Supabase auth/storage schema dependencies.
-- Auth and Storage remain on Supabase Cloud; profiles.id stores the Supabase Auth user UUID.

begin;

create schema if not exists private;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'user_role') then
    create type public.user_role as enum ('administrator', 'pemilik', 'admin_hr', 'karyawan');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'attendance_status') then
    create type public.attendance_status as enum ('tepat_waktu', 'terlambat', 'tidak_hadir');
  end if;
end
$$;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (length(btrim(name)) between 1 and 100)
);

create table if not exists public.profiles (
  id uuid primary key,
  nip text unique not null check (length(btrim(nip)) between 1 and 50),
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  phone text,
  gender text check (gender in ('laki_laki', 'perempuan')),
  address text,
  position text,
  department_id uuid references public.departments(id) on delete restrict,
  join_date date,
  photo_path text,
  role public.user_role not null default 'karyawan',
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  consent_accepted_at timestamptz,
  consent_version text,
  last_login_at timestamptz,
  work_location_name text,
  work_lat double precision,
  work_lng double precision,
  work_radius_m int check (work_radius_m is null or work_radius_m > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_consent_pair check (
    (consent_accepted_at is null and consent_version is null) or
    (consent_accepted_at is not null and consent_version is not null and length(btrim(consent_version)) > 0)
  ),
  constraint profiles_work_location_check check (
    (work_lat is null and work_lng is null) or
    (work_lat is not null and work_lng is not null and
     work_lat between -90 and 90 and work_lng between -180 and 180)
  )
);

create unique index if not exists profiles_email_unique on public.profiles (lower(email));
create index if not exists profiles_department_idx on public.profiles (department_id);
create index if not exists profiles_role_active_idx on public.profiles (role, is_active);
create unique index if not exists profiles_single_administrator_idx on public.profiles (role) where role = 'administrator';

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null default ((now() at time zone 'Asia/Jakarta')::date),
  check_in_at timestamptz,
  check_in_photo text,
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_accuracy real,
  check_in_distance_m real,
  check_in_device_id text,
  check_in_device_name text,
  is_unrecognized_device boolean not null default false,
  check_out_at timestamptz,
  check_out_photo text,
  check_out_lat double precision,
  check_out_lng double precision,
  check_out_accuracy real,
  check_out_distance_m real,
  check_out_device_id text,
  status public.attendance_status not null,
  late_minutes int not null default 0 check (late_minutes >= 0),
  early_leave_minutes int not null default 0 check (early_leave_minutes >= 0),
  missing_checkout boolean not null default false,
  is_manual_correction boolean not null default false,
  is_suspicious_location boolean not null default false,
  location_flags text[] default '{}'::text[],
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date),
  constraint attendances_status_time check (
    (status = 'tidak_hadir' and check_in_at is null and check_out_at is null) or
    (status in ('tepat_waktu', 'terlambat') and check_in_at is not null)
  ),
  constraint attendances_checkout_order check (
    check_out_at is null or (check_in_at is not null and check_out_at >= check_in_at)
  ),
  constraint attendances_missing_checkout check (
    not missing_checkout or (check_in_at is not null and check_out_at is null)
  ),
  constraint attendances_correction_reason check (
    not is_manual_correction or (note is not null and length(btrim(note)) > 0)
  ),
  constraint attendances_in_location check (
    (check_in_lat is null and check_in_lng is null and check_in_accuracy is null and check_in_distance_m is null) or
    (check_in_lat is not null and check_in_lng is not null and
     check_in_lat between -90 and 90 and check_in_lng between -180 and 180)
  ),
  constraint attendances_out_location check (
    (check_out_lat is null and check_out_lng is null and check_out_accuracy is null and check_out_distance_m is null) or
    (check_out_lat is not null and check_out_lng is not null and
     check_out_lat between -90 and 90 and check_out_lng between -180 and 180)
  ),
  check (check_in_accuracy >= 0 and check_in_accuracy < 'Infinity'::real),
  check (check_out_accuracy >= 0 and check_out_accuracy < 'Infinity'::real),
  check (check_in_distance_m >= 0 and check_in_distance_m < 'Infinity'::real),
  check (check_out_distance_m >= 0 and check_out_distance_m < 'Infinity'::real)
);

create index if not exists attendances_work_date_idx on public.attendances (work_date);
create index if not exists attendances_user_date_idx on public.attendances (user_id, work_date desc);
create index if not exists attendances_suspicious_idx on public.attendances (is_suspicious_location) where is_suspicious_location = true;
create index if not exists attendances_date_status_idx on public.attendances (work_date, status);
create index if not exists attendances_status_date_user_idx on public.attendances (status, work_date, user_id);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  work_start time not null default '08:00',
  work_end time not null default '16:00',
  late_tolerance_min int not null default 0 check (late_tolerance_min between 0 and 480),
  work_days int[] not null default '{1,2,3,4,5}',
  office_lat double precision,
  office_lng double precision,
  office_radius_m int not null default 100 check (office_radius_m > 0),
  photo_retention_days int not null default 30 check (photo_retention_days between 1 and 365),
  telegram_bot_token text,
  telegram_chat_id text,
  telegram_alerts_enabled boolean not null default true,
  require_device_binding boolean not null default true,
  updated_at timestamptz not null default now(),
  check (work_end > work_start),
  check (cardinality(work_days) between 1 and 7 and work_days <@ array[1,2,3,4,5,6,7]
    and array_position(work_days, null) is null),
  check ((office_lat is null and office_lng is null) or
    (office_lat is not null and office_lng is not null and
     office_lat between -90 and 90 and office_lng between -180 and 180))
);

create table if not exists public.holidays (
  holiday_date date primary key,
  name text not null check (length(btrim(name)) between 1 and 200)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (length(btrim(action)) > 0),
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  device_name text not null default 'Perangkat Utama',
  user_agent text,
  browser text,
  os text,
  ip_address text,
  is_trusted boolean not null default true,
  registered_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists idx_user_devices_user_id on public.user_devices(user_id);
create index if not exists idx_user_devices_device_id on public.user_devices(device_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  target_role text,
  title text not null,
  message text not null,
  type text not null default 'device_mismatch',
  payload jsonb default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_target_role on public.notifications(target_role);
create index if not exists idx_notifications_is_read on public.notifications(is_read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists notifications_role_created_idx on public.notifications(target_role, created_at desc);

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
for each row execute function private.touch_updated_at();

drop trigger if exists attendances_updated on public.attendances;
create trigger attendances_updated before update on public.attendances
for each row execute function private.touch_updated_at();

drop trigger if exists settings_updated on public.settings;
create trigger settings_updated before update on public.settings
for each row execute function private.touch_updated_at();

create or replace function private.protect_administrator_profile()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.role = 'administrator'
    and current_setting('app.administrator_rotation', true) is distinct from 'true'
    and (
      tg_op = 'DELETE'
      or new.role is distinct from old.role
      or new.is_active is distinct from true
    ) then
    raise exception 'Administrator hanya dapat diubah melalui prosedur rotasi.'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists profiles_protect_administrator on public.profiles;
create trigger profiles_protect_administrator
before update or delete on public.profiles
for each row execute function private.protect_administrator_profile();

create or replace function public.rotate_administrator(
  candidate_id uuid,
  previous_role public.user_role default 'admin_hr',
  deactivate_previous boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_id uuid;
  candidate public.profiles%rowtype;
begin
  if previous_role not in ('admin_hr', 'karyawan') then
    raise exception 'Role administrator lama harus admin_hr atau karyawan.';
  end if;

  if candidate_id is null then
    raise exception 'Kandidat administrator wajib diisi.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(72491002);

  select * into candidate
  from public.profiles
  where id = candidate_id
  for update;

  if not found then
    raise exception 'Profil kandidat administrator tidak ditemukan.';
  end if;

  if not candidate.is_active then
    raise exception 'Kandidat administrator harus akun aktif.';
  end if;

  select id into current_id
  from public.profiles
  where role = 'administrator'
  for update;

  perform pg_catalog.set_config('app.administrator_rotation', 'true', true);

  if current_id is not null and current_id <> candidate_id then
    update public.profiles
    set role = previous_role,
        is_active = case when deactivate_previous then false else is_active end
    where id = current_id;
  end if;

  update public.profiles
  set role = 'administrator',
      is_active = true
  where id = candidate_id;

  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
  values (
    candidate_id,
    'rotate_administrator',
    'profiles',
    candidate_id::text,
    pg_catalog.jsonb_build_object(
      'previous_administrator_id', current_id,
      'previous_role', previous_role,
      'deactivated_previous', deactivate_previous,
      'source', 'rotate-admin-cli'
    )
  );
end;
$$;

insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.departments (name)
values ('Manajemen'), ('SDM'), ('Keuangan'), ('Operasional'), ('Teknologi Informasi')
on conflict (name) do nothing;

commit;
