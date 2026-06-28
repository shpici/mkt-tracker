const CACHE = 'mkt-kicevo-v17';

// On install: skip waiting immediately, don't pre-cache anything
self.addEventListener('install', e => {
  self.skipWaiting();
});

// On activate: delete ALL old caches, claim all clients immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: ALWAYS go to network for HTML, cache everything else
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never intercept Firebase/Google requests
  if (url.includes('firestore') || url.includes('firebase') ||
      url.includes('googleapis') || url.includes('gstatic')) return;

  // For HTML files: always fetch from network (never serve from cache)
  if (e.request.headers.get('accept')?.includes('text/html') ||
      url.endsWith('.html') || url.endsWith('/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // For everything else: network first, cache fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  let data = { title: '📢 MKT Кичево', body: 'Нова порака од менаџерот' };
  try { if(e.data) data = e.data.json(); } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './favicon-32.png',
      tag: data.tag || 'mkt-info',
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('./'));
});
