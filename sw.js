/* Portée : travail hors ligne. L'app (une page) est prise au réseau d'abord, gardée pour la suite ; les tuiles de carte
   swisstopo sont servies depuis l'appareil quand elles y sont. Relief, bâtiments et forêt sont gardés par le moteur. */
'use strict';
const SHELL = 'portee-app-v1', TILES = 'portee-carte';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('portee-app-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    e.respondWith(fetch(req).then(r => {
      if (r.ok && !u.search) { const copy = r.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
    return;
  }
  if (u.hostname === 'wmts.geo.admin.ch') {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req.url);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok || r.type === 'opaque') c.put(req.url, r.clone());
        return r;
      } catch (err) { return hit || Response.error(); }
    }));
  }
});
