import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rotateAdmin, rotationInput } from '../scripts/lib/rotate-admin.mjs';

const env = {
  ROTATION_ADMIN_EMAIL: 'next@example.test',
  ROTATION_ADMIN_PASSWORD: 'test-only-password-123',
  ROTATION_ADMIN_NIP: 'ADM002',
  ROTATION_ADMIN_NAME: 'Admin Berikutnya',
  PREVIOUS_ADMIN_ROLE: 'admin_hr',
  DEACTIVATE_PREVIOUS_ADMIN: 'false'
};
const id = '30000000-0000-4000-8000-000000000001';
const ok = (data) => ({ ok: true, status: 200, data });

function mock(responses) {
  const calls = [];
  return {
    calls,
    request: async (...args) => {
      calls.push(args);
      const response = responses.shift();
      assert.ok(response, 'Tidak boleh ada request tambahan tak terduga');
      return response;
    }
  };
}

test('Rotation input validates role and new-account password', () => {
  assert.throws(() => rotationInput({}), /ROTATION_ADMIN_EMAIL/);
  assert.throws(() => rotationInput({ ...env, PREVIOUS_ADMIN_ROLE: 'administrator' }), /admin_hr atau karyawan/);
  assert.throws(() => rotationInput({ ...env, ROTATION_ADMIN_PASSWORD: 'short' }), /minimal 12/);
});

test('Existing candidate is rotated without changing Auth credentials', async () => {
  const api = mock([
    ok([{ id, role: 'admin_hr', nip: 'ADM002', full_name: 'Admin Berikutnya', is_active: true }]),
    ok(null)
  ]);
  const result = await rotateAdmin({ ...env, ROTATION_ADMIN_PASSWORD: '' }, api.request);
  assert.deepEqual(result, { candidateId: id, created: false });
  assert.equal(api.calls[1][0], '/rest/v1/rpc/rotate_administrator');
  assert.equal(api.calls.some(([path]) => path.startsWith('/auth/')), false);
});

test('New candidate Auth is deleted when atomic database rotation fails', async () => {
  const api = mock([
    ok([]),
    ok({ id }),
    ok(null),
    { ok: false, status: 409, data: null },
    ok(null)
  ]);
  await assert.rejects(rotateAdmin(env, api.request), /dikompensasi/);
  assert.deepEqual(api.calls.at(-1), [`/auth/v1/admin/users/${id}`, { method: 'DELETE' }]);
});
