begin;

-- 1. Tambah kolom lokasi kerja khusus karyawan ke tabel profiles
alter table public.profiles
  add column if not exists work_location_name text,
  add column if not exists work_lat double precision,
  add column if not exists work_lng double precision,
  add column if not exists work_radius_m int check (work_radius_m is null or work_radius_m > 0);

-- Validasi koordinat GPS profil jika diisi
alter table public.profiles
  drop constraint if exists profiles_work_location_check,
  add constraint profiles_work_location_check check (
    (work_lat is null and work_lng is null) or
    (work_lat is not null and work_lng is not null and
     work_lat between -90 and 90 and work_lng between -180 and 180)
  );

-- 2. Ubah foreign key attendances.user_id agar ON DELETE CASCADE
alter table public.attendances
  drop constraint if exists attendances_user_id_fkey;

alter table public.attendances
  add constraint attendances_user_id_fkey
  foreign key (user_id) references public.profiles(id)
  on delete cascade;

commit;
