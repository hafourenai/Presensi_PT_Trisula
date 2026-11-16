begin;

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
    raise exception 'Role administrator lama harus admin_hr atau karyawan.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(72491002);

  select id into current_id
  from public.profiles
  where role = 'administrator' and is_active
  for update;

  if current_id is null then
    raise exception 'Administrator aktif tidak ditemukan.';
  end if;
  if current_id = candidate_id then
    raise exception 'Calon administrator sudah menjadi administrator.' using errcode = '22023';
  end if;

  select * into candidate
  from public.profiles
  where id = candidate_id
  for update;

  if candidate.id is null or not candidate.is_active or candidate.role not in ('admin_hr', 'karyawan') then
    raise exception 'Calon administrator harus merupakan akun aktif non-administrator.' using errcode = '22023';
  end if;

  perform set_config('app.administrator_rotation', 'true', true);

  update public.profiles
  set role = previous_role,
      is_active = not deactivate_previous,
      updated_at = now()
  where id = current_id;

  update public.profiles
  set role = 'administrator',
      is_active = true,
      must_change_password = true,
      updated_at = now()
  where id = candidate_id;

  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
  values (
    candidate_id,
    'rotate_administrator',
    'profiles',
    candidate_id::text,
    jsonb_build_object(
      'previous_administrator_id', current_id,
      'previous_role', previous_role,
      'previous_deactivated', deactivate_previous
    )
  );
end;
$$;

revoke all on function public.rotate_administrator(uuid, public.user_role, boolean)
from public, anon, authenticated;
grant execute on function public.rotate_administrator(uuid, public.user_role, boolean)
to service_role;

notify pgrst, 'reload schema';
commit;
