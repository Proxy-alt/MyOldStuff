// src/integrations/obfuscator-middleware.ts
import { defineMiddleware } from 'astro/middleware';
import { parse } from 'node-html-parser';
import fs from 'node:fs';
import path from 'node:path';

interface ConfigData {
  map: [string, string][];
  options: {
    pairs: { targets: string[]; cssVariable: string; stripAriaLabel?: boolean }[];
    defaultStripAriaLabel?: boolean;
    allowlist?: string[];
    blocklist?: string[];
    dev?: boolean;
  };
}

let loadedConfig: ConfigData | null = null;
let cipherMap: Map<string, string> | null = null;

function loadConfig() {
  if (loadedConfig) return { config: loadedConfig, map: cipherMap };

  try {
    const configPath = path.resolve(process.cwd(), '.astro/obfuscator-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      loadedConfig = JSON.parse(raw);
      cipherMap = new Map(loadedConfig?.map);
    } else {
      console.warn('[Obfuscator Middleware] Config not found.');
    }
  } catch (e) {
    console.error('[Obfuscator Middleware] Failed to load config', e);
  }
  return { config: loadedConfig, map: cipherMap };
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // 1. Content-Type Check
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/html')) {
    return response;
  }

  // 2. Load Config
  const { config, map } = loadConfig();
  if (!config || !map) return response;

  // 3. Host Header Filtering
  // We check the Host header to decide if we should run logic for this specific request
  const host = context.request.headers.get('host') || context.request.headers.get('x-forwarded-host') || 'localhost';

  // Clean port if present (e.g. localhost:4321 -> localhost)
  const hostname = host.split(':')[0];

  // Blocklist Check
  if (config.options.blocklist?.includes(hostname)) {
    return response; // Skip obfuscation
  }

  // Allowlist Check (if defined)
  if (config.options.allowlist && config.options.allowlist.length > 0) {
    if (!config.options.allowlist.includes(hostname)) {
      return response; // Skip obfuscation
    }
  }

  // 4. HTML Transformation
  const html = await response.text();
  const root = parse(html);

  config.options.pairs.forEach((pair) => {
    pair.targets.forEach((selector) => {
      const elements = root.querySelectorAll(selector);
      elements.forEach((el) => {
        const original = el.textContent; // Using textContent to avoid read-only errors
        if (!original || !original.trim()) return;

        const encrypted = original
          .split('')
          .map((c) => map.get(c) || c)
          .join('');

        el.textContent = encrypted;

        const shouldStrip = pair.stripAriaLabel ?? config.options.defaultStripAriaLabel ?? false;

        if (shouldStrip) {
          el.removeAttribute('aria-label');
        } else {
          el.setAttribute('aria-label', original);
        }

        const existingStyle = el.getAttribute('style') || '';
        if (!existingStyle.includes(pair.cssVariable)) {
          el.setAttribute('style', `${existingStyle} font-family: var(${pair.cssVariable}) !important; user-select: none;`);
        }
      });
    });
  });

  return new Response(root.toString(), {
    status: response.status,
    headers: response.headers
  });
});
