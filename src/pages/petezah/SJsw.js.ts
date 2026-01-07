import type { APIRoute } from 'astro';

const serviceWorker = `\
import { shouldRoute, route } from '/scramcontroller/controller.sw.js'

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
`;


export const GET: APIRoute = () => {
  return new Response(serviceWorker, {
    headers: { "Content-Type": "application/javascript" }
  })
}

