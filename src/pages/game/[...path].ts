import type { APIRoute } from 'astro';
import { experimental_AstroContainer } from 'astro/container';
import Analytics from '../../components/Analytics.astro';

const container = await experimental_AstroContainer.create();
const cache = new Map<string, { content: string; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 5; // 5 Minutes

// --- Configuration ---

interface SourceMapping {
  prefix: string; // The URL prefix to match (e.g., 'gn/')
  cdnBase: string; // The jsDelivr base URL
  rawBase: string; // The Raw GitHub base URL
}

/**
 * Configure your sources here.
 * Order matters: The first matching prefix is used.
 * The empty prefix ('') acts as a catch-all/default and should be last.
 */
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
    prefix: '', // Default (Catch-all for PeteZah-Games)
    cdnBase: 'https://cdn.jsdelivr.net/gh/PeteZah-Games/Games-lib/',
    rawBase: 'https://raw.githubusercontent.com/PeteZah-Games/Games-lib/main/'
  }
];

const REDIRECT_CODE = import.meta.env.DEV ? 307 : 308;

export const GET: APIRoute = async ({ params, redirect, request }) => {
  let path = params.path;

  if (!path) {
    return new Response('Path is required', { status: 400 });
  }

  // 1. Force Trailing Slash for Folders
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

  // 2. Resolve Source from Mappings
  const matchedSource = SOURCE_MAPPINGS.find((source) => path.startsWith(source.prefix));

  if (!matchedSource) {
    return new Response('Invalid path source', { status: 404 });
  }

  // Remove the prefix from the path to get the relative file path
  // e.g., 'gn/folder/game.html' becomes 'folder/game.html'
  const relativePath = path.slice(matchedSource.prefix.length);

  // 3. Construct URLs
  const upstreamUrl = `${matchedSource.cdnBase}${encodeURI(relativePath)}`;
  const rawGitHubUrl = `${matchedSource.rawBase}${encodeURI(relativePath)}`;

  const isHtml = path.endsWith('.html');

  // 4. Serve Cached HTML
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

  // 5. Fetch/Check Upstream
  const fetchMethod = isHtml ? 'GET' : 'HEAD';
  let response = await fetch(upstreamUrl, { method: fetchMethod });

  // 6. Error Handling & Smart Redirect
  if (!response.ok) {
    const status = response.status;
    let isSizeExceeded = false;

    if (fetchMethod === 'GET') {
      try {
        const text = await response.clone().text();
        isSizeExceeded = text.includes('Package size exceeded');
      } catch (e) {}
    }

    // Redirect to Raw GitHub if blocked or too large
    if (status === 403 || isSizeExceeded) {
      return redirect(rawGitHubUrl, REDIRECT_CODE);
    }

    // Handle Folder Logic (jsDelivr 404s on folders)
    if (status === 404 && isHtml) {
      if (isSizeExceeded) return redirect(rawGitHubUrl, REDIRECT_CODE);
      return new Response(`Upstream Error: ${response.statusText}`, { status: response.status });
    }

    // Generic Error
    if (status !== 200) {
      return new Response(null, { status: response.status, statusText: response.statusText });
    }
  }

  // 7. Success Handling

  // Non-HTML: Redirect to jsDelivr
  if (!isHtml) {
    return redirect(upstreamUrl, REDIRECT_CODE);
  }

  // HTML: Inject Analytics
  let content = await response.text();

  const analyticsHead = await container.renderToString(Analytics, { props: { location: 'head' } });
  const analyticsBody = await container.renderToString(Analytics, { props: { location: 'body' } });

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
