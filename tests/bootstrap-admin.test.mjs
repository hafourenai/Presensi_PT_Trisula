import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminInput, bootstrapAdmin } from '../scripts/lib/bootstrap-admin.mjs';

const env = {
  INITIAL_ADMIN_EMAIL: ' Admin@Example.test ',
  INITIAL_ADMIN_PASSWORD: 'test-only-password-123',
  INITIAL_ADMIN_NIP: 'ADM001',
  INITIAL_ADMIN_NAME: 'Admin Uji'
};
const id = '20000000-0000-4000-8000-000000000001';
function mock(responses) {
  const calls = [];
  return {
    calls,
    request: async (...args) => {
      calls.push(args);
      const response = responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response, 'Tidak boleh ada request tambahan tak terduga');
      return response;
    }
  };
}
const ok = (data) => ({ ok: true, status: 200, data });

test('Bootstrap memvalidasi input sebelum akses jaringan', async () => {
  assert.throws(() => adminInput({}), /INITIAL_ADMIN_EMAIL/);
  assert.throws(() => adminInput({ ...env, INITIAL_ADMIN_PASSWORD: '123' }), /minimal 12/);
  assert.throws(() => adminInput({ ...env, INITIAL_ADMIN_EMAIL: 'invalid' }), /tidak valid/);
  assert.throws(() => adminInput({ ...env, INITIAL_ADMIN_NIP: 'x'.repeat(51) }), /maksimal/);
  assert.equal(adminInput(env).email, 'admin@example.test');
});

test('Administrator awal dibuat lewat satu panggilan Admin API dengan metadata tepercaya', async () => {
  const api = mock([ok([]), ok([]), ok({ id }), ok([{ role: 'administrator', must_change_password: true }])]);
  assert.equal(await bootstrapAdmin(env, api.request), 'created');
  const writes = api.calls.filter(([, options]) => options?.method === 'POST');
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], '/auth/v1/admin/users');
  assert.equal(writes[0][1].body.app_metadata.bootstrap_admin, true);
  assert.equal(writes[0][1].body.user_metadata, undefined);
});

test('Pengulangan bootstrap tidak mereset password administrator yang sudah ada', async () => {
  const api = mock([ok([{ id, role: 'administrator', nip: 'ADM001', is_active: true }])]);
  assert.equal(await bootstrapAdmin(env, api.request), 'existing');
  assert.equal(api.calls.length, 1);
});

test('Akun biasa, akun nonaktif, atau administrator kedua tidak diubah', async () => {
  for (const profile of [
    { role: 'karyawan', nip: 'ADM001', is_active: true },
    { role: 'administrator', nip: 'ADM001', is_active: false },
    { role: 'administrator', nip: 'OTHER', is_active: true }
  ]) {
    const api = mock([ok([profile])]);
    await assert.rejects(bootstrapAdmin(env, api.request), /profil lain/);
    assert.equal(api.calls.length, 1);
  }
  const api = mock([ok([]), ok([{ id }])]);
  await assert.rejects(bootstrapAdmin(env, api.request), /sudah ada/);
  assert.equal(api.calls.length, 2);
});

test('Migrasi belum siap menghentikan bootstrap sebelum membuat Auth user', async () => {
  const api = mock([{ ok: false, status: 404 }]);
  await assert.rejects(bootstrapAdmin(env, api.request), /migrasi Fase 1/);
  assert.equal(api.calls.length, 1);
});

test('Kegagalan Auth tidak memicu pengulangan otomatis atau memaparkan respons provider', async () => {
  const api = mock([ok([]), ok([]), { ok: false, status: 422, data: { message: env.INITIAL_ADMIN_PASSWORD } }]);
  await assert.rejects(bootstrapAdmin(env, api.request), (error) =>
    error.message.includes('HTTP 422') && !error.message.includes(env.INITIAL_ADMIN_PASSWORD));
  assert.equal(api.calls.length, 3);
});

test('Profil yang tidak tercipta tidak diklaim berhasil', async () => {
  const api = mock([ok([]), ok([]), ok({ id }), ok([])]);
  await assert.rejects(bootstrapAdmin(env, api.request), /belum terverifikasi/);
});
