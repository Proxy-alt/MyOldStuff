import type { APIRoute } from 'astro';
import { experimental_AstroContainer } from 'astro/container';
import Analytics from '../../components/Analytics.astro';

const container = await experimental_AstroContainer.create();
const cache = new Map<string, { content: string; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 5; // 5 Minutes

// --- Configuration ---
const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/PeteZah-Games/Games-lib/';
const RAW_BASE_PETEZAH = 'https://raw.githubusercontent.com/PeteZah-Games/Games-lib/master/';

const GN_BASE = 'https://cdn.jsdelivr.net/gh/gn-math/html@main/';
const RAW_BASE_GN = 'https://raw.githubusercontent.com/gn-math/html/main/';

const REDIRECT_CODE = import.meta.env.DEV ? 307 : 308;

export const GET: APIRoute = async ({ params, redirect, request }) => {
  let path = params.path;

  if (!path) {
    return new Response('Path is required', { status: 400 });
  }

  // 1. Force Trailing Slash for Folders
  // If we don't do this, removing the <base> tag breaks relative links (e.g., ./Build/game.wasm)
  // because the browser will resolve them against the parent directory instead of the game directory.
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(path);
  if (!hasExtension) {
    const currentUrl = new URL(request.url);
    if (!currentUrl.pathname.endsWith('/')) {
      return redirect(currentUrl.pathname + '/' + currentUrl.search, REDIRECT_CODE);
    }
    // Internal logic: treat folder as index.html
    path = path.replace(/\/+$/, '');
    path = `${path}/index.html`;
  }

  // 2. Construct URLs
  // Use encodeURI to handle spaces in filenames (e.g., "Super star car.wasm")
  let upstreamUrl;
  let rawGitHubUrl;

  if (path.startsWith('gn/')) {
    const stripped = path.replace(/^gn\//, '');
    upstreamUrl = `${GN_BASE}${encodeURI(stripped)}`;
    rawGitHubUrl = `${RAW_BASE_GN}${encodeURI(stripped)}`;
  } else {
    upstreamUrl = `${JSDELIVR_BASE}${encodeURI(path)}`;
    rawGitHubUrl = `${RAW_BASE_PETEZAH}${encodeURI(path)}`;
  }

  const isHtml = path.endsWith('.html');

  // 3. Serve Cached HTML
  if (isHtml) {
    const cachedEntry = cache.get(upstreamUrl);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
      return new Response(cachedEntry.content, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }
  }

  // 4. Fetch/Check Upstream
  // For HTML, we need the body. For assets, we use HEAD to save bandwidth while checking for 403s.
  const fetchMethod = isHtml ? 'GET' : 'HEAD';
  let response = await fetch(upstreamUrl, { method: fetchMethod });

  // 5. Error Handling & Smart Redirect
  if (!response.ok) {
    const status = response.status;
    let isSizeExceeded = false;

    // Only try to read text if we did a GET (HEAD has no body) and it's a 404/403
    if (fetchMethod === 'GET') {
      try {
        const text = await response.clone().text();
        isSizeExceeded = text.includes('Package size exceeded');
      } catch (e) {}
    }

    // REDIRECT CONDITION:
    // 1. Status 403 (Forbidden) -> standard for jsDelivr blocked files
    // 2. "Package size exceeded" text found
    if (status === 403 || isSizeExceeded) {
      return redirect(rawGitHubUrl, REDIRECT_CODE);
    }

    // Handle Folder Logic (jsDelivr 404s on folders)
    if (status === 404 && isHtml) {
      // Double check: maybe jsDelivr returned 404 because it's a folder limit issue?
      // In the HTML case, we usually want to just fail if index.html is missing,
      // but if it's a size limit on index.html (rare), fallback to raw.
      if (isSizeExceeded) return redirect(rawGitHubUrl, REDIRECT_CODE);

      return new Response(`Upstream Error: ${response.statusText}`, { status: response.status });
    }

    // Generic Error
    if (status !== 200) {
      // If HEAD failed with 404/405, we might want to try GET just to be sure,
      // but usually 403 is distinct.
      // If it's an asset and we got 404, it just doesn't exist.
      return new Response(null, { status: response.status, statusText: response.statusText });
    }
  }

  // 6. Success Handling

  // Non-HTML: Redirect to jsDelivr
  // We verified it exists and isn't 403. Redirect client to CDN to save our bandwidth.
  if (!isHtml) {
    return redirect(upstreamUrl, REDIRECT_CODE);
  }

  // HTML: Inject Analytics (NO BASE TAG)
  let content = await response.text();

  const analyticsHead = await container.renderToString(Analytics, { props: { location: 'head' } });
  const analyticsBody = await container.renderToString(Analytics, { props: { location: 'body' } });

  // Note: We REMOVED the <base> tag injection.
  // Relative links will now resolve against the current page URL (the proxy).
  // This ensures subsequent requests (like .wasm files) hit this route again,
  // allowing us to catch the 403 errors.

  content = content.replace(/<head([^>]*)>/i, `<head$1>${analyticsHead}`);
  content = content.replace(/<body([^>]*)>/i, `<body$1>${analyticsBody}`);

  // Cache it
  cache.set(upstreamUrl, {
    content,
    timestamp: Date.now()
  });

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'X-Cache': 'MISS',
      'Cache-Control': 'public, max-age=300'
    }
  });
};
