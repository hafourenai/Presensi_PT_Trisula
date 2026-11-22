import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Execute the real hook with network boundaries replaced, without booting a dev server.
async function loadHook(getUser, getProfile) {
  const source = await readFile(new URL('../src/hooks.server.js', import.meta.url), 'utf8');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFunction(
    'createServerSupabaseClient', 'supabaseAdmin', 'portalConfig', 'portalForHost',
    'portalUrl', 'env', 'error', 'redirect',
    source.replace(/^import .*;\r?\n/gm, '').replace('export async function handle', 'async function handle') + '\nreturn handle;'
  )(
    () => ({ auth: { getUser } }),
    { from: () => ({ select: () => ({ eq: () => ({ single: getProfile }) }) }) },
    () => ({}), () => 'development', () => '', {},
    (status, message) => new Error(`${status}: ${message}`),
    (status, location) => new Error(`${status}: ${location}`)
  );
}

test('navigation shares one verified session across hook, layout and parallel page loaders', async () => {
  let authCalls = 0;
  let profileCalls = 0;
  const user = { id: 'employee-1' };
  const profile = { role: 'karyawan', is_active: true };
  const handle = await loadHook(
    async () => { authCalls++; return { data: { user } }; },
    async () => { profileCalls++; return { data: profile }; }
  );
  const event = { request: new Request('http://localhost/profil'), url: new URL('http://localhost/profil'), locals: {} };
  await handle({ event, resolve: async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => event.locals.safeGetSession()));
    for (const result of results) assert.equal(result.profile, profile);
    return new Response('ok');
  } });
  assert.equal(authCalls, 1, 'getUser must run only once per navigation request');
  assert.equal(profileCalls, 1, 'profile must be fetched only once per navigation request');
});

async function runLoader(path, expectedConcurrency, locals = {}) {
  let active = 0;
  let peak = 0;
  const client = { from(table) {
    const query = new Proxy({}, { get(_target, key) {
      if (key === 'then') return async (resolve, reject) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise(setImmediate);
        active--;
        resolve({ data: table === 'settings' ? { office_radius_m: 100 } : [], count: 0 });
      };
      return () => query;
    } });
    return query;
  } };
  const source = await readFile(new URL(`../src/routes/${path}/+page.server.js`, import.meta.url), 'utf8');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const load = await new AsyncFunction('supabaseAdmin',
    source.split('export const actions')[0].replace(/^import .*;\r?\n/gm, '').replace('export const load', 'const load') + '\nreturn load;'
  )(client);
  const result = await load({ locals, url: new URL('http://localhost/') });
  assert.equal(peak, expectedConcurrency, `${path}: independent queries should overlap`);
  return result;
}

test('dashboard does not serialize its five independent database reads', async () => {
  const result = await runLoader('admin/dashboard', 5);
  assert.equal(result.summary.totalHadir, 0);
  assert.deepEqual(result.recentAttendances, []);
});

test('presensi loads attendance and settings concurrently', async () => {
  await runLoader('presensi', 2, { safeGetSession: async () => ({ user: { id: 'employee-1' }, profile: {} }) });
});

test('employee list loads departments and employees concurrently', async () => {
  await runLoader('admin/karyawan', 2);
});

test('settings loads holidays and configuration concurrently', async () => {
  await runLoader('admin/pengaturan', 2);
});

test('reports do not wait for filter dropdowns before querying attendance', async () => {
  const result = await runLoader('admin/laporan', 4);
  assert.deepEqual(result.attendances, []);
  assert.deepEqual(result.recap, []);
});

test('profile page reuses the verified profile instead of fetching it again', async () => {
  const profile = { id: 'employee-1', full_name: 'Employee' };
  const result = await runLoader('profil', 0, { safeGetSession: async () => ({ user: { id: profile.id }, profile }) });
  assert.equal(result.profile, profile);
});

test('session verification stays isolated between requests and observes profile changes', async () => {
  let authCalls = 0;
  let profile = { role: 'karyawan', is_active: true };
  const handle = await loadHook(
    async () => { authCalls++; return { data: { user: { id: 'employee-1' } } }; },
    async () => ({ data: profile })
  );
  for (let i = 0; i < 2; i++) {
    const event = { request: new Request('http://localhost/profil'), url: new URL('http://localhost/profil'), locals: {} };
    await handle({ event, resolve: async () => {
      assert.equal((await event.locals.safeGetSession()).profile, profile);
      return new Response('ok');
    } });
    profile = { ...profile, full_name: 'Updated' };
  }
  assert.equal(authCalls, 2);
});

test('mutations can re-read a profile changed by an action', async () => {
  let profile = { role: 'karyawan', is_active: true };
  const handle = await loadHook(
    async () => ({ data: { user: { id: 'employee-1' } } }),
    async () => ({ data: profile })
  );
  const event = { request: new Request('http://localhost/profil', { method: 'POST' }), url: new URL('http://localhost/profil'), locals: {} };
  await handle({ event, resolve: async () => {
    profile = { ...profile, full_name: 'Updated by action' };
    assert.equal((await event.locals.safeGetSession()).profile, profile);
    return new Response('ok');
  } });
});
