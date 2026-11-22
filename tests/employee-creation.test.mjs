import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { employeeLocation } from '../src/lib/server/employee-location.js';

test('lokasi kosong diperbolehkan untuk karyawan kantor pusat', () => {
  assert.deepEqual(employeeLocation(new FormData()), {
    work_lat: null, work_lng: null, work_radius_m: null
  });
});

test('koordinat harus berpasangan sebelum akun Auth dibuat', () => {
  const form = new FormData();
  form.set('work_lat', '-6.2');
  assert.throws(() => employeeLocation(form), /berpasangan/);
});

test('koordinat tidak valid ditolak sebelum akun Auth dibuat', () => {
  const form = new FormData();
  form.set('work_lat', 'abc');
  form.set('work_lng', '106');
  assert.throws(() => employeeLocation(form), /Latitude/);
});

test('aksi pembuatan memvalidasi lokasi sebelum membuat akun dan tidak menaruh sandi di URL', async () => {
  const source = await readFile(new URL('../src/routes/admin/karyawan/baru/+page.server.js', import.meta.url), 'utf8');
  const validation = source.indexOf('employeeLocation(formData)');
  const create = source.indexOf('auth.admin.createUser(');
  assert.ok(validation >= 0 && validation < create);
  assert.doesNotMatch(source, /[?&]pwd=/);
});

test('onboarding admin HR diarahkan ke rute dashboard yang ada', async () => {
  const source = await readFile(new URL('../src/routes/ganti-password/+page.server.js', import.meta.url), 'utf8');
  assert.match(source, /redirect\(303, '\/admin\/dashboard'\)/);
  assert.doesNotMatch(source, /redirect\(303, '\/dashboard'\)/);
});

test('halaman detail tidak membaca sandi dari parameter URL', async () => {
  const server = await readFile(new URL('../src/routes/admin/karyawan/[id]/+page.server.js', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/routes/admin/karyawan/[id]/+page.svelte', import.meta.url), 'utf8');
  assert.doesNotMatch(server, /searchParams\.get\('pwd'\)/);
  assert.doesNotMatch(page, /data\.initialPwd/);
});
