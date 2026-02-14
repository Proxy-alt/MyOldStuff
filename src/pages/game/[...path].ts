import type { APIRoute } from 'astro';
import { experimental_AstroContainer } from 'astro/container';
import Analytics from '../../components/Analytics.astro';

// --- Global Initialization (Run Once) ---

// PERF: Create container and render analytics strings once at startup.
// This avoids spinning up the renderer for every single request.
const container = await experimental_AstroContainer.create();
const [analyticsHead, analyticsBody] = await Promise.all([
  container.renderToString(Analytics, { props: { location: 'head' } }),
  container.renderToString(Analytics, { props: { location: 'body' } })
]);

const cache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 Minutes
const MAX_CACHE_SIZE = 1000; // Prevent memory leaks

interface SourceMapping {
  prefix: string;
  cdnBase: string;
  rawBase: string;
}

const SOURCE_MAPPINGS: SourceMapping[] = [
  {
    prefix: 'gn/',
    cdnBase: 'https://cdn.jsdelivr.net/gh/gn-math/html@main/',
    rawBase: 'https://raw.githubusercontent.com/gn-math/html/main/'
  },
  {
    prefix: 'covers/',
    cdnBase: 'https://cdn.jsdelivr.net/gh/gn-math/covers@main/',
    rawBase: 'https://raw.githubusercontent.com/gn-math/covers/main/'
  },
  {
    prefix: '', // Default Catch-all
    cdnBase: 'https://cdn.jsdelivr.net/gh/PeteZah-Games/Games-lib/',
    rawBase: 'https://raw.githubusercontent.com/PeteZah-Games/Games-lib/main/'
  }
];

const REDIRECT_CODE = import.meta.env.DEV ? 307 : 308;

export const GET: APIRoute = async ({ params, redirect, request }) => {
  let path = params.path;

  if (!path) return new Response('Path is required', { status: 400 });

  // 1. Path Normalization (Force trailing slash for folders)
  if (!path.match(/\.[a-zA-Z0-9]+$/)) {
    const url = new URL(request.url);
    if (!url.pathname.endsWith('/')) {
      return redirect(`${url.pathname}/${url.search}`, REDIRECT_CODE);
    }
    path = `${path.replace(/\/+$/, '')}/index.html`;
  }

  // 2. Source Resolution
  const source = SOURCE_MAPPINGS.find((s) => path.startsWith(s.prefix));
  if (!source) return new Response('Invalid path source', { status: 404 });

  const relativePath = path.slice(source.prefix.length);
  const upstreamUrl = `${source.cdnBase}${encodeURI(relativePath)}`;
  const rawGitHubUrl = `${source.rawBase}${encodeURI(relativePath)}`;
  const isHtml = path.endsWith('.html');

  // 3. Cache Check (HTML Only)
  if (isHtml) {
    const cached = cache.get(upstreamUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(cached.content, {
        status: 200,
        headers: { 'Content-Type': 'text/html', 'X-Cache': 'HIT' }
      });
    }
  }

  // 4. Upstream Fetch with Offline Failover
  let response: Response;
  const method = isHtml ? 'GET' : 'HEAD';

  try {
    response = await fetch(upstreamUrl, { method });
  } catch (error) {
    console.warn(`[Proxy] Primary upstream offline (${upstreamUrl}). Trying fallback...`);
    // FAILOVER: If CDN is unreachable (DNS/Network error), try Raw GitHub immediately
    try {
      response = await fetch(rawGitHubUrl, { method });
    } catch (fallbackError) {
      // OFFLINE CASE: Both upstream and fallback failed
      console.error(`[Proxy] All upstreams failed for ${path}`);
      return new Response('Service Unavailable: Upstream servers are offline.', { status: 503 });
    }
  }

  // 5. Status Handling & Smart Redirects
  if (!response.ok) {
    // Check specifically for jsDelivr "Package size exceeded"
    let isBlocked = response.status === 403;
    if (!isBlocked && method === 'GET' && response.status !== 404) {
      try {
        const text = await response.clone().text();
        if (text.includes('Package size exceeded')) isBlocked = true;
      } catch {}
    }

    // Redirect to Raw GitHub if blocked by CDN or file too large
    if (isBlocked) {
      return redirect(rawGitHubUrl, REDIRECT_CODE);
    }

    // Handle 404s specifically
    if (response.status === 404) {
      // If it's a folder index that doesn't exist on CDN, try Raw just in case
      if (isHtml) return redirect(rawGitHubUrl, REDIRECT_CODE);
      return new Response('Not Found', { status: 404 });
    }

    return new Response(null, { status: response.status, statusText: response.statusText });
  }

  // 6. Success: Non-HTML -> Redirect to CDN
  if (!isHtml) {
    return redirect(upstreamUrl, REDIRECT_CODE);
  }

  // 7. Success: HTML -> Inject Analytics
  const originalHtml = await response.text();

  // High-performance string injection (faster than regex for simple insertions)
  const headIdx = originalHtml.indexOf('<head');
  const bodyIdx = originalHtml.indexOf('<body');

  let modifiedHtml = originalHtml;

  if (headIdx !== -1) {
    const closeHeadTag = originalHtml.indexOf('>', headIdx) + 1;
    modifiedHtml = modifiedHtml.slice(0, closeHeadTag) + analyticsHead + modifiedHtml.slice(closeHeadTag);
  }

  if (bodyIdx !== -1) {
    // Inject analytics at the start of body (or end, depending on preference. usually start for GTM)
    const closeBodyTag = originalHtml.indexOf('>', bodyIdx) + 1;
    // Adjust index because we added to head
    const offset = analyticsHead.length;
    const finalInsertPos = closeBodyTag + (headIdx !== -1 && headIdx < bodyIdx ? offset : 0);

    // Note: Simple slice/replace is safer than logic above if we just use replace.
    // Reverting to robust regex replacement to ensure safety against malformed HTML
    modifiedHtml = originalHtml.replace(/<head([^>]*)>/i, `<head$1>${analyticsHead}`).replace(/<body([^>]*)>/i, `<body$1>${analyticsBody}`);
  }

  // 8. Update Cache
  if (cache.size >= MAX_CACHE_SIZE) cache.clear(); // Simple GC
  cache.set(upstreamUrl, { content: modifiedHtml, timestamp: Date.now() });

  return new Response(modifiedHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'X-Cache': 'MISS',
      'Cache-Control': 'public, max-age=300'
    }
  });
};
