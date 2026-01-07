/// <reference lib="webworker" />
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, CacheOnly, NetworkFirst, NetworkOnly, StaleWhileRevalidate, Strategy, StrategyHandler } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

// --- 1. Configuration Types ---

export enum CachingStrategy {
  CacheOnly = 'CACHE_ONLY',
  NetworkOnly = 'NETWORK_ONLY',
  StaleWhileRevalidate = 'SWR',
  Fastest = 'RACE', // Whichever returns first
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

// --- 2. The Configuration ---
// Modify this section to configure your specific Astro routes

const config: RouteConfig[] = [
  {
    name: 'images',
    pattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
    strategy: CachingStrategy.PreferCache, // Cache First
    expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 } // 30 Days
  },
  {
    name: 'api-fresh-data',
    pattern: /\/api\/live-data/,
    strategy: CachingStrategy.PreferNetwork // Network First
  },
  {
    name: 'api-static-data',
    pattern: /\/api\/catalogue/,
    strategy: CachingStrategy.StaleWhileRevalidate
  },
  {
    name: 'critical-fonts',
    pattern: /\.(?:woff|woff2)$/,
    strategy: CachingStrategy.CacheOnly // Must be pre-cached or previously loaded
  },
  {
    name: 'time-sensitive-race',
    pattern: /\/api\/ping/,
    strategy: CachingStrategy.Fastest // Race network vs cache
  }
];

// --- 3. Custom Strategy: Race (Whichever is Fastest) ---

class RaceStrategy extends Strategy {
  async _handle(request: Request, handler: StrategyHandler): Promise<Response> {
    const cacheKey = await this.cacheName;

    // Create promises for both
    const networkPromise = handler.fetch(request).catch(() => null);
    const cachePromise = handler.cacheMatch(request).catch(() => null);

    // Race them
    const response = await Promise.race([
      networkPromise.then((r) => r || cachePromise), // If network fails, fallback to cache
      cachePromise.then((r) => r || networkPromise) // If cache misses, fallback to network
    ]);

    if (!response) {
      throw new Error('Both cache and network failed');
    }

    // Optionally update cache if the winner was the network
    // Note: To be fully robust, we should also update cache in background
    // if the winner was cache but network eventually returns different data.
    return response;
  }
}

// --- 4. Strategy Resolver ---

const getStrategy = (type: CachingStrategy, cacheName: string, expiration?: RouteConfig['expiration']) => {
  const plugins = expiration ? [new ExpirationPlugin({ maxEntries: expiration.maxEntries, maxAgeSeconds: expiration.maxAgeSeconds })] : [];

  const options = { cacheName, plugins };

  switch (type) {
    case CachingStrategy.CacheOnly:
      return new CacheOnly(options);
    case CachingStrategy.NetworkOnly:
      return new NetworkOnly({ plugins }); // NetworkOnly typically doesn't use cacheName
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

// --- 5. Initialization ---

// Standard lifecycle management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Clean up old caches
cleanupOutdatedCaches();

// Precache Astro build assets (injected during build)
precacheAndRoute(self.__WB_MANIFEST);

// Register user-configured routes
config.forEach((route) => {
  registerRoute(({ url }) => route.pattern.test(url.pathname), getStrategy(route.strategy, route.name, route.expiration));
});

// Default fallback for navigation requests (SPA support)
registerRoute(({ request }) => request.mode === 'navigate', new NetworkFirst({ cacheName: 'pages' }));
