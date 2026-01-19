import type { APIRoute } from 'astro';

// 1. In-Memory Cache
// Note: In a serverless environment (Vercel/Netlify), this cache resets
// when the function spins down. For persistent caching, use Redis/KV.
const cache = new Map<string, { content: string; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 5; // 5 Minutes

const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/PeteZah-Games/Games-lib/';

export const GET: APIRoute = async ({ params, request, redirect }) => {
  // 2. sanitize the path
  const path = params.path;
  if (!path) {
    return new Response('Path is required', { status: 400 });
  }

  // Construct the upstream URL
  const upstreamUrl = `${JSDELIVR_BASE}/${path}`;
  const isHtml = path.endsWith('.html');

  // --- SCENARIO A: Non-HTML Files (Redirect) ---
  if (!isHtml) {
    // 307 Temporary Redirect ensures the method (GET) remains unchanged
    // Use 301 if you want this to be permanently cached by browsers
    return redirect(upstreamUrl, 307);
  }

  // --- SCENARIO B: HTML Files (Cache & Serve) ---

  // 1. Check Cache
  const cachedEntry = cache.get(upstreamUrl);
  const isCacheValid = cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION;

  if (isCacheValid) {
    return new Response(cachedEntry.content, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'X-Cache': 'HIT', // Useful for debugging
        'Cache-Control': 'public, max-age=300' // Tell browser to cache for 5 mins
      }
    });
  }

  // 2. Fetch from Source if not cached
  try {
    const response = await fetch(upstreamUrl);

    if (!response.ok) {
      return new Response(`Upstream Error: ${response.statusText}`, { status: response.status });
    }

    const content = await response.text();

    // 3. Store in Cache
    cache.set(upstreamUrl, {
      content,
      timestamp: Date.now()
    });

    // 4. Return Content
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch (error) {
    return new Response('Internal Server Error', { status: 500 });
  }
};
