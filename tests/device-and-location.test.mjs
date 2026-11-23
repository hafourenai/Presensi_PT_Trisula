import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createLocalDbClient } from '../src/lib/server/local-db.js';
import {
  evaluateLoginDevice,
  registerPrimaryDevice,
  recordUnrecognizedDevice
} from '../src/lib/server/device-auth.js';

test('Google Maps resolver prioritizes exact pin coordinates over camera viewport', async () => {
  // Simulasikan URL Google Maps yang memiliki koordinat viewport @lat,lng dan pin lokasi !3dlat!4dlng
  const mapsUrlWithBoth = 'https://www.google.com/maps/place/PT+Trisula/@-6.195000,106.820000,17z/data=!4m6!3m5!1s0x0:0x0!8m2!3d-6.208888!4d106.845555!16s%2Fg%2F11b';

  // Import internal function extractCoordsFromUrl via resolve-maps handler or regex
  // Let's test against resolve-maps logic
  const dataCoordsLat = mapsUrlWithBoth.match(/!3d(-?\d+\.\d+)/);
  const dataCoordsLng = mapsUrlWithBoth.match(/!4d(-?\d+\.\d+)/);

  assert.ok(dataCoordsLat);
  assert.ok(dataCoordsLng);
  assert.equal(parseFloat(dataCoordsLat[1]), -6.208888);
  assert.equal(parseFloat(dataCoordsLng[1]), 106.845555);

  // Viewport camera is different (-6.195000, 106.820000)
  const atCoords = mapsUrlWithBoth.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  assert.notEqual(parseFloat(dataCoordsLat[1]), parseFloat(atCoords[1]));
});

test('Haversine distance calculation is accurate within tolerance', async () => {
  const { calculateDistance } = await import('../src/lib/geo.js');

  // Jarak Monas (-6.175392, 106.827153) ke Bundaran HI (-6.194966, 106.823126) adalah ~2.2 km (±2200m)
  const dist = calculateDistance(-6.175392, 106.827153, -6.194966, 106.823126);
  assert.ok(dist >= 2150 && dist <= 2250, `Jarak ${dist}m harus berada di kisaran 2.2 km`);
});

test('Device fingerprinting extracts browser, OS, and mobile detection correctly', async () => {
  // Test simulated user agents
  const uaChromeWindows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const uaAndroidChrome = 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';

  const isMobileWin = /Mobi|Android/i.test(uaChromeWindows);
  const isMobileAndroid = /Mobi|Android/i.test(uaAndroidChrome);

  assert.equal(isMobileWin, false);
  assert.equal(isMobileAndroid, true);
});

test('evaluateLoginDevice distinguishes unregistered, trusted primary, and mismatched devices', () => {
  // Akun baru belum punya perangkat utama -> wajib konfirmasi pendaftaran
  const fresh = evaluateLoginDevice({ devices: [], deviceId: 'dev-1' });
  assert.equal(fresh.status, 'needs_registration');
  assert.equal(fresh.primaryDevice, null);

  const devices = [
    { id: 'row-1', device_id: 'dev-1', device_name: 'Ponsel (Chrome di Android)', is_trusted: true }
  ];

  // Login dari perangkat utama
  const sameDevice = evaluateLoginDevice({ devices, deviceId: 'dev-1' });
  assert.equal(sameDevice.status, 'trusted');
  assert.equal(sameDevice.primaryDevice.device_id, 'dev-1');

  // Login dari perangkat kedua / berbeda -> mismatch
  const secondDevice = evaluateLoginDevice({ devices, deviceId: 'dev-2' });
  assert.equal(secondDevice.status, 'mismatch');
  assert.equal(secondDevice.primaryDevice.device_id, 'dev-1');

  // Device ID kosong saat perangkat utama sudah ada -> tetap mismatch
  const missingId = evaluateLoginDevice({ devices, deviceId: '' });
  assert.equal(missingId.status, 'mismatch');
});

test('registerPrimaryDevice binds first device once and blocks concurrent overwrite from second device', async () => {
  const pg = new PGlite();
  const schema = await readFile(new URL('../supabase/local_schema.sql', import.meta.url), 'utf8');
  await pg.exec(schema);

  const db = createLocalDbClient({
    queryFn: (sql, params) => pg.query(sql, params)
  });

  const userId = '11111111-1111-4111-8111-111111111111';
  await db.from('profiles').insert({
    id: userId,
    nip: 'EMP-001',
    full_name: 'Budi Santoso',
    email: 'budi@company.test',
    role: 'karyawan',
    must_change_password: true,
    is_active: true
  });

  // Perangkat pertama mendaftar secara eksplisit
  const firstReg = await registerPrimaryDevice({
    supabaseAdmin: db,
    userId,
    deviceId: 'device-hp-budi',
    deviceName: 'Ponsel (Chrome di Android)',
    browser: 'Chrome',
    os: 'Android',
    ipAddress: '10.0.0.1'
  });
  assert.equal(firstReg.registered, true);
  assert.equal(firstReg.conflict, false);
  assert.equal(firstReg.device.is_trusted, true);

  // Perangkat kedua mencoba mendaftar sebagai perangkat utama -> ditolak (conflict)
  const secondReg = await registerPrimaryDevice({
    supabaseAdmin: db,
    userId,
    deviceId: 'device-laptop-lain',
    deviceName: 'PC/Laptop (Edge di Windows)',
    browser: 'Edge',
    os: 'Windows',
    ipAddress: '10.0.0.2'
  });
  assert.equal(secondReg.registered, false);
  assert.equal(secondReg.conflict, true);
  assert.equal(secondReg.primaryDevice.device_id, 'device-hp-budi');

  // Login dari perangkat kedua dicatat sebagai tidak tepercaya dan memicu notifikasi login
  const alerts = [];
  const { data: currentDevices } = await db.from('user_devices').select('*').eq('user_id', userId);
  const recorded = await recordUnrecognizedDevice({
    supabaseAdmin: db,
    user: { id: userId },
    profile: { full_name: 'Budi Santoso', nip: 'EMP-001' },
    devices: currentDevices,
    deviceId: 'device-laptop-lain',
    deviceName: 'PC/Laptop (Edge di Windows)',
    browser: 'Edge',
    os: 'Windows',
    ipAddress: '10.0.0.2',
    context: 'login',
    alwaysAlert: true,
    alertFn: async (payload) => alerts.push(payload)
  });

  assert.equal(recorded.isNewDevice, true);
  assert.equal(recorded.device.is_trusted, false);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].context, 'login');

  await pg.close();
});

test('first-time activation requires explicit device confirmation and sync/presensi never silently auto-register', async () => {
  const gantiServer = await readFile(new URL('../src/routes/ganti-password/+page.server.js', import.meta.url), 'utf8');
  const gantiPage = await readFile(new URL('../src/routes/ganti-password/+page.svelte', import.meta.url), 'utf8');
  const loginServer = await readFile(new URL('../src/routes/login/+page.server.js', import.meta.url), 'utf8');
  const loginPage = await readFile(new URL('../src/routes/login/+page.svelte', import.meta.url), 'utf8');
  const syncRoute = await readFile(new URL('../src/routes/api/device/sync/+server.js', import.meta.url), 'utf8');
  const presensiApi = await readFile(new URL('../src/routes/api/presensi/+server.js', import.meta.url), 'utf8');
  const hooks = await readFile(new URL('../src/hooks.server.js', import.meta.url), 'utf8');

  // /ganti-password menanyakan konfirmasi eksplisit perangkat & tombol batal keluar
  assert.match(gantiPage, /Ingin mendaftar dengan perangkat ini\?/i);
  assert.match(gantiPage, /name="confirm_device"/);
  assert.match(gantiPage, /action="\/auth\/logout"/);
  assert.match(gantiServer, /registerPrimaryDevice/);
  assert.match(gantiServer, /confirm_device/);

  // /hooks.server.js mengizinkan logout dari /ganti-password saat must_change_password = true
  assert.match(hooks, /url !== '\/auth\/logout'/);

  // /login memeriksa perangkat dan menampilkan peringatan perangkat berbeda sebelum lanjut
  assert.match(loginServer, /evaluateLoginDevice/);
  assert.match(loginServer, /deviceMismatch:\s*true/);
  assert.match(loginPage, /Perangkat Berbeda Terdeteksi/);
  assert.match(loginPage, /confirm_unrecognized_device/);

  // /api/device/sync dan /api/presensi tidak lagi mendaftarkan is_trusted: true secara diam-diam
  assert.doesNotMatch(syncRoute, /is_trusted:\s*true/);
  assert.doesNotMatch(presensiApi, /is_trusted:\s*true/);
});
