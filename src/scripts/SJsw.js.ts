import { route, shouldRoute } from '@petezah-games/scramjet-controller/worker';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e: FetchEvent) => {
  if (shouldRoute(e)) {
    e.respondWith(route(e));
  }
});
