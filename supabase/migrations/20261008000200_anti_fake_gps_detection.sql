begin;

-- Tambah kolom integritas lokasi / deteksi manipulasi GPS pada tabel attendances
alter table public.attendances
  add column if not exists is_suspicious_location boolean not null default false,
  add column if not exists location_flags text[] default '{}'::text[];

create index if not exists attendances_suspicious_idx on public.attendances (is_suspicious_location) where is_suspicious_location = true;

commit;
