import { defineMiddleware } from 'astro:middleware';
import { shouldRouteTofastify } from './lib/fastifyRoutes';

/**
 * Middleware to redirect specific requests to the Fastify backend on port 3001.
 * Routes handled by Fastify include:
 * - Proxy servers for accessing external content (/bare/*, /api/bare-premium/*)
 * - Static asset serving (/scram/*, /scramcontroller/*)
 * - WebSocket handlers (/wisp/*, /api/wisp-premium/*, /api/alt-wisp-*)
 *
 * All /api/* routes handled by Astro serverless endpoints are passed through normally.
 * @param {any} context - Astro middleware context
 * @param {Function} next - Next middleware function
 * @returns {Promise<Response>} Response from Fastify backend or Astro rendering
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const url: URL = context.url;

  // Check if the current request path should be routed to Fastify
  const shouldRedirectToFastify: boolean = shouldRouteTofastify(url.pathname);

  if (shouldRedirectToFastify) {
    // Construct the backend URL pointing to Fastify on port 3001
    const backendUrl: URL = new URL(url);
    backendUrl.host = `localhost:3001`;
    backendUrl.protocol = 'http';

    try {
      // Forward the request to Fastify backend
      const response: Response = await fetch(backendUrl.toString(), {
        method: context.request.method,
        headers: context.request.headers,
        body: context.request.method !== 'GET' && context.request.method !== 'HEAD' ? await context.request.clone().arrayBuffer() : undefined
      });

      return response;
    } catch (error) {
      console.error(`Error redirecting to Fastify backend: ${error}`);
      // Fall back to next() if backend is unavailable
      return next();
    }
  }

  // For all other routes (including Astro-handled /api/* endpoints), proceed with normal Astro rendering
  return next();
});
