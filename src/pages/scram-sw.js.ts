import type { APIRoute } from 'astro';
export const GET: APIRoute = async () => {
  return new Response(
    `
import { route, shouldRoute } from "https://cdn.jsdelivr.net/npm/@petezah-games/scramjet-controller@0.1.4/dist/controller.sw.js";
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
});`,
    {
      headers: { 'Content-Type': 'application/javascript' }
    }
  );
};
