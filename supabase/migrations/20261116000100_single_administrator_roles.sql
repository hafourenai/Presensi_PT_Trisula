begin;

-- Keep legacy enum values for a safe PostgreSQL migration, but normalize all data
-- and stop granting access to them. Removing enum values requires rebuilding the
-- enum type and is intentionally deferred until no deployment can write them.
update public.profiles
set role = 'admin_hr'
where role::text in ('pemilik', 'hr');

update public.notifications
set target_role = 'admin_hr'
where target_role in ('pemilik', 'hr');

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (
  (id = (select auth.uid()) and (select private.get_my_role()) is not null)
  or (select private.get_app_role()) in ('administrator', 'admin_hr')
);

drop policy if exists attendances_read on public.attendances;
create policy attendances_read on public.attendances for select to authenticated
using (
  (select private.get_app_role()) in ('administrator', 'admin_hr')
  or ((select private.get_app_role()) = 'karyawan' and user_id = (select auth.uid()))
);

drop policy if exists attendance_photos_read on storage.objects;
create policy attendance_photos_read on storage.objects for select to authenticated
using (
  bucket_id = 'attendance-photos' and (
    (select private.get_app_role()) in ('administrator', 'admin_hr')
    or ((select private.get_app_role()) = 'karyawan'
      and (storage.foldername(name))[1] = (select auth.uid())::text)
  )
);

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated
using (
  bucket_id = 'avatars' and (
    (select private.get_app_role()) in ('administrator', 'admin_hr')
    or ((select private.get_app_role()) is not null
      and (storage.foldername(name))[1] = (select auth.uid())::text)
  )
);

-- A profile can never become a second administrator, including through the
-- service role. Inactive administrator profiles are included deliberately.
create unique index if not exists profiles_single_administrator_idx
on public.profiles ((role = 'administrator'))
where role = 'administrator';

create or replace function private.protect_administrator_profile()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.role = 'administrator' and (
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

revoke all on function private.protect_administrator_profile() from public, anon, authenticated, service_role;
drop trigger if exists protect_administrator_profile on public.profiles;
create trigger protect_administrator_profile
before update or delete on public.profiles
for each row execute function private.protect_administrator_profile();

notify pgrst, 'reload schema';
commit;
