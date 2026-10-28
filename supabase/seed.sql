begin;
insert into public.departments (name)
values ('Manajemen'), ('SDM'), ('Keuangan'), ('Operasional'), ('Teknologi Informasi')
on conflict (name) do nothing;
commit;
