import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('app.css provides global warm palette and consistent theme tokens', async () => {
  const css = await readFile(new URL('../src/app.css', import.meta.url), 'utf8');
  assert.match(css, /--color-paper:\s*#f7f3ea;/);
  assert.match(css, /--color-surface:\s*#fffcf6;/);
  assert.match(css, /--color-brand:\s*#a94d21;/);
  assert.match(css, /\.app-theme/);
});

test('app.html mounts the global app-theme class on body', async () => {
  const html = await readFile(new URL('../src/app.html', import.meta.url), 'utf8');
  assert.match(html, /<body[^>]*class="[^"]*app-theme[^"]*"/);
});

test('login and password activation use shared auth-page and auth-card styling', async () => {
  const login = await readFile(new URL('../src/routes/login/+page.svelte', import.meta.url), 'utf8');
  const changePwd = await readFile(new URL('../src/routes/ganti-password/+page.svelte', import.meta.url), 'utf8');
  assert.match(login, /class="[^"]*auth-page/);
  assert.match(login, /class="[^"]*auth-card/);
  assert.match(changePwd, /class="[^"]*auth-page/);
  assert.match(changePwd, /class="[^"]*auth-card/);
});

test('shared layout applies unified header and mobile navigation highlights', async () => {
  const layout = await readFile(new URL('../src/routes/+layout.svelte', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /border-emerald-100/);
  assert.doesNotMatch(layout, /bg-emerald-50\/80/);
});

test('interactive cursor pointer and navigation loading indicator are configured', async () => {
  const css = await readFile(new URL('../src/app.css', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/routes/+layout.svelte', import.meta.url), 'utf8');
  assert.match(css, /button:not\(:disabled\)[\s\S]*cursor:\s*pointer;/);
  assert.match(css, /\.nav-loading-bar/);
  assert.match(layout, /navigating\.to/);
  assert.match(layout, /class="nav-loading-bar"/);
});

test('admin dashboard uses balanced two-column content grid without nested page padding', async () => {
  const dashboard = await readFile(new URL('../src/routes/admin/dashboard/+page.svelte', import.meta.url), 'utf8');
  assert.match(dashboard, /class="content-grid"/);
  assert.match(dashboard, /class="side-column"/);
  assert.doesNotMatch(dashboard, /\.attendance-dashboard\s*\{[^}]*padding:/);
});

test('settings form aligns three-column inputs and uses concise single-line labels', async () => {
  const settings = await readFile(new URL('../src/routes/admin/pengaturan/+page.svelte', import.meta.url), 'utf8');
  assert.match(settings, />Toleransi \(Menit\)</);
  assert.match(settings, />Radius \(Meter\)</);
  assert.match(settings, /class="flex flex-col"/);
  assert.match(settings, /mt-auto/);
});

