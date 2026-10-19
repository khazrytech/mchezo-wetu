'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Dummy but well-formed Supabase settings so the app boots without real credentials.
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const app = require('../server.js');

let server;
let baseUrl;

test.before(async () => {
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

const get = (route, options) => fetch(`${baseUrl}${route}`, { redirect: 'manual', ...options });

test('GET /api/health inarudisha hali ya mtandaoni', async () => {
  const res = await get('/api/health');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.status, 'online');
});

test('GET /api/config inarudisha anwani ya Supabase', async () => {
  const res = await get('/api/config');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.supabaseUrl, process.env.SUPABASE_URL);
  assert.ok(body.supabaseAnonKey);
});

test('API ya admin haifikiriki bila kuingia', async () => {
  const res = await get('/api/admin/users');
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.success, false);
});

test('API ya admin inakataa token isiyo sahihi', async () => {
  const res = await get('/api/admin/users', { headers: { Authorization: 'Bearer not-a-real-token' } });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.success, false);
});

test('njia isiyojulikana ya API inarudisha 404 ya JSON', async () => {
  const res = await get('/api/hakuna-kitu');
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.success, false);
});

test('ukurasa usiopo unarudisha 404', async () => {
  const res = await get('/hakuna-ukurasa');
  assert.equal(res.status, 404);
});

test('ukurasa wa kuingia unapatikana', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
});

test('manifest ina icons za PNG na maskable', async () => {
  const res = await get('/manifest.webmanifest');
  assert.equal(res.status, 200);
  const manifest = JSON.parse(await res.text());
  const sources = manifest.icons.map(icon => icon.src);
  assert.ok(sources.includes('/pwa-icon-192.png'));
  assert.ok(sources.includes('/pwa-icon-512.png'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});

test('icons za PNG zinahudumiwa kwa aina sahihi', async () => {
  for (const icon of ['/pwa-icon-192.png', '/pwa-icon-512.png', '/pwa-icon-maskable-512.png']) {
    const res = await get(icon);
    assert.equal(res.status, 200, `${icon} haipatikani`);
    assert.match(res.headers.get('content-type') || '', /image\/png/);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  }
});

test('service worker haitunzi kurasa za akaunti na haivunjiki kwa faili moja', async () => {
  const res = await get('/service-worker.js');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('allSettled'), 'usakinishaji unapaswa kuvumilia faili moja kukosa');
  assert.ok(!body.includes('cache.addAll'), 'cache.addAll huvunja usakinishaji wote');
  assert.ok(body.includes("'/dashboard'"), 'kurasa za akaunti zinapaswa kutambulika');
});

test('faili za HTML za frontend zipo na zina <script>', async () => {
  for (const page of ['admin.html', 'dashboard.html', 'index.html', 'admin-login.html']) {
    const source = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.ok(source.includes('<script>'), `${page} haina script ya ndani`);
    assert.ok(source.includes('manifest.webmanifest'), `${page} haiunganishi manifest`);
  }
});
