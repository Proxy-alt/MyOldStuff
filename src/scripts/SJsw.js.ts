import { shouldRoute, route } from '@petezah-games/scramjet-controller/worker'

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

addEventListener("fetch", (e) => {
  if (shouldRoute(e)) {
    e.respondWith(route(e));
  }
});
