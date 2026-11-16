import assert from 'node:assert/strict';
import { test } from 'node:test';
import { portalConfig, portalForHost, portalUrl } from '../src/lib/server/domains.js';

test('Portal hosts are explicit and unknown hosts are rejected', () => {
  const config = portalConfig({
    EMPLOYEE_ORIGIN: 'https://presence.example.test',
    ADMIN_ORIGIN: 'https://office.example.test',
    INTERNAL_HOSTS: 'health.internal'
  });

  assert.equal(portalForHost('presence.example.test', config), 'employee');
  assert.equal(portalForHost('office.example.test', config), 'admin');
  assert.equal(portalForHost('health.internal', config), 'development');
  assert.equal(portalForHost('attacker.example', config), null);
});

test('Production redirects use configured origins instead of request hosts', () => {
  assert.equal(
    portalUrl('https://office.example.test', '/admin/dashboard', '?from=presence'),
    'https://office.example.test/admin/dashboard?from=presence'
  );
});

test('Local hosts are accepted only outside production unless configured', () => {
  assert.equal(portalForHost('localhost', portalConfig({}, 'development')), 'development');
  assert.equal(portalForHost('localhost', portalConfig({}, 'production')), null);
});
