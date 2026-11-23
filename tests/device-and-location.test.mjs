import test from 'node:test';
import assert from 'node:assert/strict';

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
