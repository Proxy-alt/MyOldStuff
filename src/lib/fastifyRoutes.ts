/**
 * Fastify-specific routes configuration.
 * These routes are handled by the Fastify backend on port 3001.
 * All other /api/* routes are handled by Astro serverless endpoints.
 */
export const FASTIFY_ROUTES: Record<string, string> = {
  bare: '/bare/',
  barePremium: '/api/bare-premium/',
  scram: '/scram/',
  scramController: '/scramcontroller/',
  wisp: '/wisp/',
  wispPremium: '/api/wisp-premium/',
  altWisp: '/api/alt-wisp-'
};

/**
 * Check if a given path should be handled by Fastify.
 * @param {string} pathname - The path to check
 * @returns {boolean} True if the path matches any Fastify route, false otherwise
 */
export function shouldRouteTofastify(pathname: string): boolean {
  return Object.values(FASTIFY_ROUTES).some((route) => pathname.startsWith(route));
}

/**
 * Get all Fastify route patterns as an array.
 * @returns {string[]} Array of all registered Fastify route prefixes
 */
export function getFastifyRoutePrefixes(): string[] {
  return Object.values(FASTIFY_ROUTES);
}
