begin;

-- A deployment may have marked earlier migrations applied before these columns
-- were installed. Keep the repair additive and safe to run more than once.
alter table public.profiles
  add column if not exists work_location_name text,
  add column if not exists work_lat double precision,
  add column if not exists work_lng double precision,
  add column if not exists work_radius_m int;

alter table public.attendances
  add column if not exists is_suspicious_location boolean not null default false,
  add column if not exists location_flags text[] default '{}'::text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_work_location_check') then
    alter table public.profiles add constraint profiles_work_location_check check (
      (work_lat is null and work_lng is null) or
      (work_lat is not null and work_lng is not null and
       work_lat between -90 and 90 and work_lng between -180 and 180)
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_work_radius_m_check') then
    alter table public.profiles add constraint profiles_work_radius_m_check
      check (work_radius_m is null or work_radius_m > 0);
  end if;
end;
$$;

create index if not exists attendances_suspicious_idx
  on public.attendances (is_suspicious_location) where is_suspicious_location = true;

notify pgrst, 'reload schema';
commit;
