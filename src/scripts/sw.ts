/// <reference lib="webworker" />
// Scramjet

// Workbox
import { route, shouldRoute } from '@petezah-games/scramjet-controller/worker';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, CacheOnly, NetworkFirst, NetworkOnly, StaleWhileRevalidate, Strategy, StrategyHandler } from 'workbox-strategies';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
addEventListener('fetch', (e) => {
  if (shouldRoute(e)) {
    e.respondWith(route(e));
  }
});

declare let self: ServiceWorkerGlobalScope;
// Types

export enum CachingStrategy {
  CacheOnly = 'CACHE_ONLY',
  NetworkOnly = 'NETWORK_ONLY',
  StaleWhileRevalidate = 'SWR',
  Fastest = 'RACE',
  PreferNetwork = 'NETWORK_FIRST',
  PreferCache = 'CACHE_FIRST'
}

interface RouteConfig {
  name: string;
  pattern: RegExp;
  strategy: CachingStrategy;
  expiration?: {
    maxEntries: number;
    maxAgeSeconds: number;
  };
}

/**
 * The configuration
 */
const config: RouteConfig[] = [
  {
    name: 'images',
    pattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
    strategy: CachingStrategy.PreferCache,
    expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }
  },
  {
    name: 'api-fresh-data',
    pattern: /\/api\/live-data/,
    strategy: CachingStrategy.PreferNetwork
  },
  {
    name: 'api-static-data',
    pattern: /\/api\/catalogue/,
    strategy: CachingStrategy.StaleWhileRevalidate
  },
  {
    name: 'critical-fonts',
    pattern: /\.(?:woff|woff2)$/,
    strategy: CachingStrategy.PreferCache
  },
  {
    name: 'time-sensitive-race',
    pattern: /\/api\/ping/,
    strategy: CachingStrategy.Fastest
  }
];

// Which ever one is fastest wins

class RaceStrategy extends Strategy {
  async _handle(request: Request, handler: StrategyHandler): Promise<Response> {
    const networkPromise = handler.fetch(request).catch(() => null);
    const cachePromise = handler.cacheMatch(request).catch(() => null);

    const response = await Promise.race([networkPromise.then((r) => r || cachePromise), cachePromise.then((r) => r || networkPromise)]);

    if (!response) {
      throw new Error('Both cache and network failed');
    }
    return response;
  }
}

// Resolver strategy

const getStrategy = (type: CachingStrategy, cacheName: string, expiration?: RouteConfig['expiration']) => {
  const plugins = expiration ? [new ExpirationPlugin({ maxEntries: expiration.maxEntries, maxAgeSeconds: expiration.maxAgeSeconds })] : [];
  const options = { cacheName, plugins };

  switch (type) {
    case CachingStrategy.CacheOnly:
      return new CacheOnly(options);
    case CachingStrategy.NetworkOnly:
      return new NetworkOnly({ plugins });
    case CachingStrategy.StaleWhileRevalidate:
      return new StaleWhileRevalidate(options);
    case CachingStrategy.PreferNetwork:
      return new NetworkFirst(options);
    case CachingStrategy.PreferCache:
      return new CacheFirst(options);
    case CachingStrategy.Fastest:
      return new RaceStrategy(options);
    default:
      return new NetworkFirst(options);
  }
};

/**
 * The Event listeners
 */

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Clean up old caches
cleanupOutdatedCaches();

// Precache Astro build assets
precacheAndRoute(self.__WB_MANIFEST);

// Register user-configured routes
config.forEach((route) => {
  registerRoute(({ url }) => route.pattern.test(url.pathname), getStrategy(route.strategy, route.name, route.expiration));
});

// Default fallback for navigation requests (SPA support)
registerRoute(({ request }) => request.mode === 'navigate', new NetworkFirst({ cacheName: 'pages' }));
