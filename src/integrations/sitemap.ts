import type { AstroIntegration } from 'astro';
import { execSync } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration & Types ---

interface SitemapOptions {
  ignore?: string[];
  site?: string;
  debug?: boolean;
}

interface Asset {
  url: string;
}

interface PageData {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: number;
  images: Asset[];
  videos: Asset[];
}

interface CacheEntry {
  mtimeMs: number;
  images: Asset[];
  videos: Asset[];
}

const CACHE_DIR = '.sitemap-cache';
const CACHE_FILE = 'manifest.json';
// Optimized Regex for performance
const REF_REGEX = /\b(?:src|href|poster)\s*=\s*['"]([^'"]+)['"]|url\(['"]?([^'"]+?)['"]?\)/gi;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov']);

// --- Helpers ---

function formatTitle(str: string): string {
  if (!str || str === '/') return 'PeteZah Content';
  const base = str
    .split('/')
    .pop()!
    .replace(/\.[^/.]+$/, '');
  const result = base.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
  return result.replace(/\b\w/g, (c) => c.toUpperCase()).trim() || 'PeteZah Content';
}

function computePriority(commitCount: number, maxCommits: number): number {
  if (maxCommits === 0) return 0.5;
  const calculated = Math.log10(commitCount + 1) / Math.log10(maxCommits + 1);
  return parseFloat(calculated.toFixed(2)) || 0.5;
}

function computeChangefreq(lastmod: string | Date | undefined): string {
  if (!lastmod) return 'daily';
  const last = new Date(lastmod);
  const days = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 7) return 'daily';
  if (days <= 30) return 'weekly';
  if (days <= 180) return 'monthly';
  return 'yearly';
}

// --- Output Generators (XML, JSON, TXT) ---

function generateXml(domain: string, pages: PageData[]) {
  const cleanDomain = domain.replace(/\/$/, '');

  const urls = pages
    .map((page) => {
      const fullUrl = `${cleanDomain}${page.loc}`;

      // Asset Sitemaps (Google Extension)
      const imageTags = page.images
        .map(
          (img) => `
    <image:image>
      <image:loc>${img.url.startsWith('http') ? img.url : cleanDomain + img.url}</image:loc>
      <image:title>${formatTitle(img.url).replace(/[<>&"']/g, '')}</image:title>
    </image:image>`
        )
        .join('');

      const videoTags = page.videos
        .map((vid) => {
          const vidUrl = vid.url.startsWith('http') ? vid.url : cleanDomain + vid.url;
          const thumbUrl = page.images[0]?.url
            ? page.images[0].url.startsWith('http')
              ? page.images[0].url
              : cleanDomain + page.images[0].url
            : `${cleanDomain}/storage/images/logo.png`;

          return `
    <video:video>
      <video:thumbnail_loc>${thumbUrl}</video:thumbnail_loc>
      <video:title>${formatTitle(vid.url).replace(/[<>&"']/g, '')}</video:title>
      <video:description>Watch content on ${cleanDomain}</video:description>
      <video:content_loc>${vidUrl}</video:content_loc>
    </video:video>`;
        })
        .join('');

      return `
  <url>
    <loc>${fullUrl}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>${imageTags}${videoTags}
  </url>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls}
</urlset>`;
}

function generateJson(domain: string, pages: PageData[]) {
  const baseUrl = domain.replace(/\/$/, '');
  return JSON.stringify(
    {
      multipleIndexes: false,
      timestamp: new Date().toISOString(),
      routes: pages.map((u) => ({
        ...u,
        loc: `${baseUrl}${u.loc}`,
        type: 'page'
      }))
    },
    null,
    2
  );
}

function generateTxt(domain: string, pages: PageData[]) {
  const baseUrl = domain.replace(/\/$/, '');
  return pages.map((p) => `${baseUrl}${p.loc}`).join('\n');
}

// --- Git & File System Logic ---

function getGitMetadata(rootDir: string) {
  const fileDates = new Map<string, string>();
  const dirCommitCounts = new Map<string, number>();
  let maxCommits = 0;
  let latestSiteUpdate = new Date().toISOString();

  // OFFLINE CASE: If .git doesn't exist, skip entirely
  if (!existsSync(path.join(rootDir, '.git'))) {
    return { fileDates, dirCommitCounts, maxCommits, latestSiteUpdate, isOffline: true };
  }

  try {
    // Get latest global update
    const latest = execSync('git log -1 --format=%cI', { cwd: rootDir, encoding: 'utf8' }).trim();
    if (latest) latestSiteUpdate = latest;

    // Get bulk history
    // NOTE: --name-only is more efficient than full diffs
    const output = execSync('git log --pretty=format:"%cI" --name-only', {
      cwd: rootDir,
      maxBuffer: 100 * 1024 * 1024, // Increased buffer for large repos
      encoding: 'utf8'
    });

    const lines = output.split('\n');
    let currentDate = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        currentDate = trimmed;
      } else {
        // Normalize path separators
        const p = trimmed.replace(/\\/g, '/');
        // Only set date if not already set (because we read log newest -> oldest)
        if (!fileDates.has(p)) fileDates.set(p, currentDate);

        // Count commits per directory for priority calculation
        const dir = path.dirname(p);
        const count = (dirCommitCounts.get(dir) || 0) + 1;
        dirCommitCounts.set(dir, count);
        if (count > maxCommits) maxCommits = count;
      }
    }
  } catch (err) {
    // OFFLINE CASE: Git command failed (e.g. CI without git installed)
    // We silently fallback to defaults
  }
  return { fileDates, dirCommitCounts, maxCommits, latestSiteUpdate, isOffline: false };
}

async function scanHtmlWithCache(filePath: string, cache: Map<string, CacheEntry>): Promise<{ images: Asset[]; videos: Asset[] }> {
  try {
    const stats = await fs.stat(filePath);

    if (cache.has(filePath)) {
      const entry = cache.get(filePath)!;
      // Fast equality check using mtime
      if (Math.abs(entry.mtimeMs - stats.mtimeMs) < 100) {
        return { images: entry.images, videos: entry.videos };
      }
    }

    const content = await fs.readFile(filePath, 'utf8');
    const images = new Set<string>();
    const videos = new Set<string>();
    let match;

    while ((match = REF_REGEX.exec(content)) !== null) {
      const ref = match[1] || match[2];
      if (!ref || ref.startsWith('data:') || ref.startsWith('#')) continue;

      const ext = path.extname(ref).toLowerCase();
      // Normalize absolute paths vs relative paths
      const cleanRef = ref.startsWith('http') ? ref : '/' + ref.replace(/^(\.\/|\/)/, '');

      if (IMAGE_EXTS.has(ext)) images.add(cleanRef);
      else if (VIDEO_EXTS.has(ext)) videos.add(cleanRef);
    }

    const result = {
      images: Array.from(images).map((url) => ({ url })),
      videos: Array.from(videos).map((url) => ({ url }))
    };

    cache.set(filePath, { mtimeMs: stats.mtimeMs, ...result });
    return result;
  } catch (e) {
    return { images: [], videos: [] }; // Fail safe for missing files
  }
}

// --- Main Integration ---

export default function sitemapPlus(options: SitemapOptions = {}): AstroIntegration {
  let site: string;
  let outDirUrl: URL;
  let cacheMap = new Map<string, CacheEntry>();

  return {
    name: 'astro-sitemap-plus',
    hooks: {
      'astro:config:done': ({ config }) => {
        if (!config.site && !options.site) {
          throw new Error('[Sitemap Plus] "site" is required in astro.config.mjs');
        }
        site = config.site || options.site!;
        outDirUrl = config.outDir;
      },

      'astro:build:done': async ({ dir, routes, pages }) => {
        const startTime = Date.now();
        const projDir = process.cwd();
        const buildOutDir = fileURLToPath(dir || outDirUrl);

        // Load Cache
        const cacheDirPath = path.resolve(projDir, CACHE_DIR);
        const cacheFilePath = path.join(cacheDirPath, CACHE_FILE);
        if (existsSync(cacheFilePath)) {
          try {
            cacheMap = new Map(JSON.parse(await fs.readFile(cacheFilePath, 'utf8')));
          } catch (e) {}
        }

        // 1. Get Metadata (Offline Safe)
        const gitData = getGitMetadata(projDir);
        if (gitData.isOffline && options.debug) console.log('[Sitemap Plus] Git offline/unavailable. Using current date.');

        // 2. Identify Valid Routes
        // We filter for 'page' types that have a pathname (excludes dynamic SSR routes without params)
        const validRoutes = routes.filter((r) => r.type === 'page' && r.pathname);

        // 3. Process Routes Concurrently
        const entries = await Promise.all(
          validRoutes.map(async (route) => {
            if (!route.pathname) return null;

            // Normalize Location
            let loc = route.pathname;
            if (!loc.startsWith('/')) loc = '/' + loc;
            if (loc.endsWith('/')) loc = loc.slice(0, -1); // No trailing slash for sitemap locs usually
            if (loc === '') loc = '/';

            // Ignore Check
            if (options.ignore?.includes(loc)) return null;

            // Get Source Metadata
            const componentPath = route.component; // e.g. 'src/pages/index.astro'
            const gitKey = componentPath.replace(/\\/g, '/');
            const dirKey = path.dirname(gitKey);

            const lastmod = gitData.fileDates.get(gitKey) || gitData.latestSiteUpdate;
            const commitCount = gitData.dirCommitCounts.get(dirKey) || 0;

            // Asset Extraction (Only if static file exists)
            let assets = { images: [], videos: [] };

            // route.distURL is populated for SSG pages. For SSR, it is undefined.
            // If SSR, we skip asset scanning to avoid building complex rendering logic.
            if (route.distURL) {
              const distPath = fileURLToPath(route.distURL);
              assets = await scanHtmlWithCache(distPath, cacheMap);
            }

            return {
              loc,
              lastmod,
              changefreq: computeChangefreq(lastmod),
              priority: computePriority(commitCount, gitData.maxCommits),
              images: assets.images,
              videos: assets.videos
            } as PageData;
          })
        );

        // Filter nulls
        const cleanEntries = entries.filter((e): e is PageData => e !== null);

        // 4. Write Output
        await fs.writeFile(path.join(buildOutDir, 'sitemap.xml'), generateXml(site, cleanEntries));
        await fs.writeFile(path.join(buildOutDir, 'sitemap.json'), generateJson(site, cleanEntries));
        await fs.writeFile(path.join(buildOutDir, 'sitemap.txt'), generateTxt(site, cleanEntries));

        // Save Cache
        if (!existsSync(cacheDirPath)) await fs.mkdir(cacheDirPath, { recursive: true });
        await fs.writeFile(cacheFilePath, JSON.stringify(Array.from(cacheMap.entries())));

        console.log(`[Sitemap Plus] Generated sitemaps for ${cleanEntries.length} pages in ${Date.now() - startTime}ms`);
      }
    }
  };
}
