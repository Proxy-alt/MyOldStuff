import type { AstroIntegration } from 'astro';
import { execSync } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration & Types ---

interface SitemapOptions {
  ignore?: string[];
  site?: string;
  debug?: boolean; // Enable to see path logs
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
const REF_REGEX = /(?:src|href|poster)\s*=\s*['"]([^'"]+)['"]|url\(['"]?([^'"]+?)['"]?\)/gi;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov']);

// --- Helpers ---

function formatTitle(str: string) {
  if (!str || str === '/') return 'PeteZah Content';
  let base = str
    .split('/')
    .pop()!
    .replace(/\.[^/.]+$/, '');
  let result = base.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
  return (
    result
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim() || 'PeteZah Content'
  );
}

function computePriority(commitCount: number, maxCommits: number) {
  const calculated = Math.log10(commitCount + 1) / Math.log10(maxCommits + 1);
  return Number(calculated.toFixed(2)) || 0.5;
}

function computeChangefreq(lastmod: string | Date | undefined) {
  if (!lastmod) return 'daily';
  const last = new Date(lastmod);
  const days = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 7) return 'daily';
  if (days <= 30) return 'weekly';
  if (days <= 180) return 'monthly';
  return 'yearly';
}

// --- Output Generators ---

function generateXml(domain: string, data: { entries: PageData[] }) {
  const pagesArray = data.entries || [];
  const cleanDomain = domain.endsWith('/') ? domain.slice(0, -1) : domain;

  const urls = pagesArray
    .map((page) => {
      const fullUrl = `${cleanDomain}${page.loc.startsWith('/') ? '' : '/'}${page.loc}`;
      const lastmod = page.lastmod || new Date().toISOString();

      const imageTags = (page.images || [])
        .map((img) => {
          const imgLoc = img.url.startsWith('http') ? img.url : `${cleanDomain}${img.url.startsWith('/') ? '' : '/'}${img.url}`;
          return `
    <image:image>
      <image:loc>${imgLoc}</image:loc>
      <image:title>${formatTitle(img.url).replace(/[<>&"']/g, '')}</image:title>
    </image:image>`;
        })
        .join('');

      const videoTags = (page.videos || [])
        .map((vid) => {
          const videoLoc = vid.url.startsWith('http') ? vid.url : `${cleanDomain}${vid.url.startsWith('/') ? '' : '/'}${vid.url}`;
          const thumb = page.images?.[0]?.url
            ? page.images[0].url.startsWith('http')
              ? page.images[0].url
              : cleanDomain + (page.images[0].url.startsWith('/') ? '' : '/') + page.images[0].url
            : `${cleanDomain}/storage/images/logo.png`;

          return `
    <video:video>
      <video:thumbnail_loc>${thumb}</video:thumbnail_loc>
      <video:title>${formatTitle(vid.url).replace(/[<>&"']/g, '')}</video:title>
      <video:description>Watch content on ${cleanDomain}</video:description>
      <video:content_loc>${videoLoc}</video:content_loc>
    </video:video>`;
        })
        .join('');

      return `
  <url>
    <loc>${fullUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${computeChangefreq(lastmod)}</changefreq>
    <priority>${page.priority || '0.5'}</priority>${imageTags}${videoTags}
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

function generateJson(domain: string, data: { entries: PageData[] }) {
  const pagesArray = data.entries || [];
  const baseUrl = domain.toString().replace(/\/$/, '');

  return JSON.stringify(
    {
      multipleIndexes: false,
      timestamp: new Date().toISOString(),
      routes: pagesArray.map((u) => ({
        loc: `${baseUrl}${u.loc.startsWith('/') ? '' : '/'}${u.loc}`,
        lastmod: u.lastmod,
        changefreq: computeChangefreq(u.lastmod),
        priority: u.priority || 0.5,
        type: 'page',
        images: (u.images || []).map((img) => ({
          ...img,
          title: formatTitle(img.url),
          url: img.url.startsWith('http') ? img.url : `${baseUrl}${img.url.startsWith('/') ? '' : '/'}${img.url}`
        })),
        videos: (u.videos || []).map((vid) => ({
          ...vid,
          title: formatTitle(vid.url),
          url: vid.url.startsWith('http') ? vid.url : `${baseUrl}${vid.url.startsWith('/') ? '' : '/'}${vid.url}`
        }))
      }))
    },
    null,
    2
  );
}

function generateTxt(domain: string, data: { entries: PageData[] }) {
  const pagesArray = data.entries || [];
  const baseUrl = domain.toString().replace(/\/$/, '');
  return pagesArray.map((p) => `${baseUrl}${p.loc.startsWith('/') ? '' : '/'}${p.loc}`).join('\n');
}

// --- Core Logic ---

async function scanHtmlWithCache(filePath: string, cache: Map<string, CacheEntry>): Promise<{ images: Asset[]; videos: Asset[] }> {
  const stats = await fs.stat(filePath);

  if (cache.has(filePath)) {
    const entry = cache.get(filePath)!;
    if (Math.abs(entry.mtimeMs - stats.mtimeMs) < 100) {
      return { images: entry.images, videos: entry.videos };
    }
  }

  const images = new Set<string>();
  const videos = new Set<string>();

  try {
    const content = await fs.readFile(filePath, 'utf8');
    let match;
    while ((match = REF_REGEX.exec(content)) !== null) {
      const ref = match[1] || match[2];
      if (!ref || ref.startsWith('http') || ref.startsWith('//') || ref.startsWith('data:') || ref.startsWith('#')) continue;
      const ext = path.extname(ref).toLowerCase();
      const cleanRef = ref.replace(/^(\.\/|\/)/, '');
      if (IMAGE_EXTS.has(ext)) images.add(cleanRef);
      else if (VIDEO_EXTS.has(ext)) videos.add(cleanRef);
    }
  } catch (e) {
    /* ignore */
  }

  const result = {
    images: Array.from(images).map((url) => ({ url })),
    videos: Array.from(videos).map((url) => ({ url }))
  };

  cache.set(filePath, { mtimeMs: stats.mtimeMs, ...result });
  return result;
}

function getGitMetadata(rootDir: string) {
  const fileDates = new Map<string, string>();
  const dirCommitCounts = new Map<string, number>();
  let maxCommits = 0;
  let latestSiteUpdate = new Date().toISOString();

  try {
    latestSiteUpdate = execSync('git log -1 --format=%cI', { cwd: rootDir, encoding: 'utf8' }).trim();
    const output = execSync('git log --pretty=format:"%cI" --name-only', {
      cwd: rootDir,
      maxBuffer: 50 * 1024 * 1024,
      encoding: 'utf8'
    });

    const lines = output.split('\n');
    let currentDate = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) currentDate = trimmed;
      else {
        const p = trimmed.replace(/\\/g, '/');
        if (!fileDates.has(p)) fileDates.set(p, currentDate);
        const dir = path.dirname(p);
        const count = (dirCommitCounts.get(dir) || 0) + 1;
        dirCommitCounts.set(dir, count);
        if (count > maxCommits) maxCommits = count;
      }
    }
  } catch (err) {
    /* ignore */
  }
  return { fileDates, dirCommitCounts, maxCommits, latestSiteUpdate };
}

// --- Recursive File Walker ---
async function getHtmlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(fullPath);
      }
    }
  }
  await walk(dir);
  return files;
}

// --- Integration ---

export default function sitemapPlus(options: SitemapOptions = {}): AstroIntegration {
  let site: string;
  let outDirUrl: URL;
  let cacheMap = new Map<string, CacheEntry>();

  return {
    name: 'astro-sitemap-plus',
    hooks: {
      'astro:config:done': ({ config }) => {
        if (!config.site && !options.site) {
          throw new Error('[Sitemap Plus] "site" is required.');
        }
        site = config.site || options.site!;
        outDirUrl = config.outDir;
      },

      'astro:build:done': async ({ dir }) => {
        const startTime = Date.now();
        const projDir = process.cwd();

        // Resolve output directory
        const buildOutDir = fileURLToPath(dir || outDirUrl);
        if (options.debug) console.log(`[Sitemap Plus] Scanning output dir: ${buildOutDir}`);

        // Setup Cache
        const cacheDirPath = path.resolve(projDir, CACHE_DIR);
        const cacheFilePath = path.join(cacheDirPath, CACHE_FILE);
        if (existsSync(cacheFilePath)) {
          try {
            cacheMap = new Map(JSON.parse(await fs.readFile(cacheFilePath, 'utf8')));
          } catch (e) {}
        }

        // 1. Get Git Metadata
        const { fileDates, dirCommitCounts, maxCommits, latestSiteUpdate } = getGitMetadata(projDir);

        // 2. Scan Directory for HTML Files (Crawler Method)
        let htmlFiles: string[] = [];
        try {
          htmlFiles = await getHtmlFiles(buildOutDir);
        } catch (e) {
          console.error(`[Sitemap Plus] Error reading directory ${buildOutDir}`, e);
          return;
        }

        if (htmlFiles.length === 0) {
          console.warn(`[Sitemap Plus] Warning: No HTML files found in ${buildOutDir}`);
          return;
        }

        const entries: PageData[] = [];

        for (const filePath of htmlFiles) {
          // Calculate URL from file path
          // e.g. /dist/foo/index.html -> /foo/
          // e.g. /dist/bar.html -> /bar
          const relPath = path.relative(buildOutDir, filePath);
          let loc = '/' + relPath.replace(/\\/g, '/'); // Normalize slashes

          if (loc.endsWith('/index.html')) {
            loc = loc.slice(0, -10); // remove index.html
            if (loc === '') loc = '/'; // root
          } else if (loc.endsWith('.html')) {
            loc = loc.slice(0, -5); // remove .html
          }

          // 3. Try to Map to Source for Git Stats
          // We guess the source file location based on the output URL
          const cleanLoc = loc.replace(/^\/|\/$/g, '') || 'index';
          const candidates = [
            `src/pages/${cleanLoc}.astro`,
            `src/pages/${cleanLoc}.md`,
            `src/pages/${cleanLoc}.mdx`,
            `src/pages/${cleanLoc}/index.astro`,
            `src/pages/${cleanLoc}/index.md`
          ];

          // Find which candidate actually exists
          let srcPath = `src/pages/${cleanLoc}`; // fallback
          for (const c of candidates) {
            if (existsSync(path.join(projDir, c))) {
              srcPath = c;
              break;
            }
          }

          const gitKey = srcPath.replace(/\\/g, '/');
          const dirKey = path.dirname(gitKey);

          const lastmod = fileDates.get(gitKey) || latestSiteUpdate;
          const commitCount = dirCommitCounts.get(dirKey) || 0;

          // 4. Extract Assets
          const assets = await scanHtmlWithCache(filePath, cacheMap);

          entries.push({
            loc,
            lastmod,
            changefreq: computeChangefreq(lastmod),
            priority: computePriority(commitCount, maxCommits),
            images: assets.images,
            videos: assets.videos
          });
        }

        // 5. Write Files
        const xml = generateXml(site, { entries });
        const json = generateJson(site, { entries });
        const txt = generateTxt(site, { entries });

        await fs.writeFile(path.join(buildOutDir, 'sitemap.xml'), xml);
        await fs.writeFile(path.join(buildOutDir, 'sitemap.json'), json);
        await fs.writeFile(path.join(buildOutDir, 'sitemap.txt'), txt);

        // Save Cache
        if (!existsSync(cacheDirPath)) await fs.mkdir(cacheDirPath, { recursive: true });
        await fs.writeFile(cacheFilePath, JSON.stringify(Array.from(cacheMap.entries())));

        console.log(`[Sitemap Plus] Generated sitemaps for ${entries.length} pages in ${Date.now() - startTime}ms`);
      }
    }
  };
}
