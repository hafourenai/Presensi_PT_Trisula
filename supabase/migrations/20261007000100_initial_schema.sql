begin;

create type public.user_role as enum ('administrator', 'pemilik', 'admin_hr', 'karyawan');
create type public.attendance_status as enum ('tepat_waktu', 'terlambat', 'tidak_hadir');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (length(btrim(name)) between 1 and 100)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_consent_pair check (
    (consent_accepted_at is null and consent_version is null) or
    (consent_accepted_at is not null and consent_version is not null and length(btrim(consent_version)) > 0)
  )
);
create unique index profiles_email_unique on public.profiles (lower(email));
create index profiles_department_idx on public.profiles (department_id);
create index profiles_role_active_idx on public.profiles (role, is_active);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  -- RESTRICT menjaga riwayat. Nonaktifkan akun; penghapusan permanen butuh alur tersendiri.
  user_id uuid not null references public.profiles(id) on delete restrict,
  work_date date not null default ((now() at time zone 'Asia/Jakarta')::date),
  check_in_at timestamptz,
  check_in_photo text,
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_accuracy real,
  check_in_distance_m real,
  check_out_at timestamptz,
  check_out_photo text,
  check_out_lat double precision,
  check_out_lng double precision,
  check_out_accuracy real,
  check_out_distance_m real,
  status public.attendance_status not null,
  late_minutes int not null default 0 check (late_minutes >= 0),
  early_leave_minutes int not null default 0 check (early_leave_minutes >= 0),
  missing_checkout boolean not null default false,
  is_manual_correction boolean not null default false,
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
create index attendances_work_date_idx on public.attendances (work_date);
create index attendances_user_date_idx on public.attendances (user_id, work_date desc);

create table public.settings (
  id int primary key default 1 check (id = 1),
  work_start time not null default '08:00',
  work_end time not null default '16:00',
  late_tolerance_min int not null default 0 check (late_tolerance_min between 0 and 480),
  -- ISO weekday: Senin=1, Minggu=7.
  work_days int[] not null default '{1,2,3,4,5}',
  office_lat double precision,
  office_lng double precision,
  office_radius_m int not null default 100 check (office_radius_m > 0),
  photo_retention_days int not null default 30 check (photo_retention_days between 1 and 365),
  updated_at timestamptz not null default now(),
  check (work_end > work_start),
  check (cardinality(work_days) between 1 and 7 and work_days <@ array[1,2,3,4,5,6,7]
    and array_position(work_days, null) is null),
  check ((office_lat is null and office_lng is null) or
    (office_lat is not null and office_lng is not null and
     office_lat between -90 and 90 and office_lng between -180 and 180))
);

create table public.holidays (
  holiday_date date primary key,
  name text not null check (length(btrim(name)) between 1 and 200)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (length(btrim(action)) > 0),
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Membaca role dari database, bukan user_metadata/JWT yang bisa usang.
-- Security definer memutus rekursi policy profiles. Schema private jangan diekspos via API.
create function private.get_my_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid()) and is_active;
$$;
revoke all on function private.get_my_role() from public, anon, authenticated;
grant execute on function private.get_my_role() to authenticated;

-- Onboarding hanya boleh membaca profil sendiri sampai password dan consent selesai.
create function private.get_app_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles
  where id = (select auth.uid()) and is_active and not must_change_password
    and consent_accepted_at is not null and consent_version is not null;
$$;
revoke all on function private.get_app_role() from public, anon, authenticated;
grant execute on function private.get_app_role() to authenticated;

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
create trigger profiles_updated before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger attendances_updated before update on public.attendances
for each row execute function private.touch_updated_at();
create trigger settings_updated before update on public.settings
for each row execute function private.touch_updated_at();

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.attendances enable row level security;
alter table public.settings enable row level security;
alter table public.holidays enable row level security;
alter table public.audit_logs enable row level security;

-- Semua mutasi melalui server: validasi role, field, dan audit tidak bisa dilewati klien.
revoke all on public.departments, public.profiles, public.attendances,
  public.settings, public.holidays, public.audit_logs from public, anon, authenticated;
grant select on public.departments, public.profiles, public.attendances,
  public.settings, public.holidays, public.audit_logs to authenticated;
grant select, insert, update, delete on public.departments, public.profiles,
  public.attendances, public.settings, public.holidays to service_role;
-- Audit append-only bagi API server, bukan log yang bisa diedit klien/admin.
revoke all on public.audit_logs from service_role;
grant select, insert on public.audit_logs to service_role;
revoke all on sequence public.audit_logs_id_seq from public, anon, authenticated;
grant usage, select on sequence public.audit_logs_id_seq to service_role;

create policy profiles_read on public.profiles for select to authenticated
using (
  (id = (select auth.uid()) and (select private.get_my_role()) is not null)
  or (select private.get_app_role()) in ('administrator', 'pemilik', 'admin_hr')
);
create policy attendances_read on public.attendances for select to authenticated
using (
  (select private.get_app_role()) in ('administrator', 'pemilik', 'admin_hr')
  or ((select private.get_app_role()) = 'karyawan' and user_id = (select auth.uid()))
);
create policy departments_read on public.departments for select to authenticated
using ((select private.get_app_role()) is not null);
create policy holidays_read on public.holidays for select to authenticated
using ((select private.get_app_role()) is not null);
create policy settings_read on public.settings for select to authenticated
using ((select private.get_app_role()) = 'administrator');
create policy audit_logs_read on public.audit_logs for select to authenticated
using ((select private.get_app_role()) = 'administrator');

-- Buckets private; semua upload melalui server/signed upload yang diberikan server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attendance-photos', 'attendance-photos', false, 204800, array['image/jpeg']),
  ('avatars', 'avatars', false, 204800, array['image/jpeg']);

create policy attendance_photos_read on storage.objects for select to authenticated
using (
  bucket_id = 'attendance-photos' and (
    (select private.get_app_role()) in ('administrator', 'pemilik', 'admin_hr')
    or ((select private.get_app_role()) = 'karyawan'
      and (storage.foldername(name))[1] = (select auth.uid())::text)
  )
);
create policy avatars_read on storage.objects for select to authenticated
using (
  bucket_id = 'avatars' and (
    (select private.get_app_role()) in ('administrator', 'pemilik', 'admin_hr')
    or ((select private.get_app_role()) is not null
      and (storage.foldername(name))[1] = (select auth.uid())::text)
  )
);

-- Bootstrap khusus administrator pertama. app_metadata hanya bisa diisi Admin API.
-- Tidak menggunakan user_metadata karena dapat dimanipulasi pemilik akun.
-- Auth user, profil, dan audit dibuat dalam transaksi Auth yang sama.
create function private.bootstrap_first_admin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.raw_app_meta_data ->> 'bootstrap_admin' is distinct from 'true' then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(72491001);
  if exists (select 1 from public.profiles where role = 'administrator') then
    raise exception 'Administrator sudah ada. Bootstrap hanya untuk administrator pertama.';
  end if;
  if new.email is null
    or nullif(btrim(new.raw_app_meta_data ->> 'bootstrap_nip'), '') is null
    or nullif(btrim(new.raw_app_meta_data ->> 'bootstrap_name'), '') is null then
    raise exception 'Email, NIP, dan nama bootstrap wajib diisi.';
  end if;
  insert into public.profiles (id, nip, full_name, email, role, must_change_password)
  values (new.id, btrim(new.raw_app_meta_data ->> 'bootstrap_nip'),
    btrim(new.raw_app_meta_data ->> 'bootstrap_name'), lower(btrim(new.email)),
    'administrator', true);
  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
  values (new.id, 'bootstrap_administrator', 'profiles', new.id::text,
    '{"source":"seed-admin"}'::jsonb);
  return new;
end;
$$;
revoke all on function private.bootstrap_first_admin() from public, anon, authenticated, service_role;
create trigger on_auth_user_bootstrap_admin after insert on auth.users
for each row execute function private.bootstrap_first_admin();

insert into public.settings (id) values (1);
notify pgrst, 'reload schema';
commit;
