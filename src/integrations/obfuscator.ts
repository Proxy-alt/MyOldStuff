import type { AstroIntegration } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import opentype from 'opentype.js';
import * as wawoff2 from 'wawoff2';

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?!';
const CACHE_DIR = '.astro/obfuscated-fonts';
const CONFIG_FILE = path.join(CACHE_DIR, '../obfuscator-config.json');

// --- SHARED TYPES ---
export interface IntegrationOptions {
  pairs: {
    targets: string[];
    cssVariable: string;
    originalCssVariable?: string; // <--- Add this line
    stripAriaLabel?: boolean;
  }[];
  defaultStripAriaLabel?: boolean;
  allowlist?: string[];
  blocklist?: string[];
  dev?: boolean;
}

// --- CIPHER LOGIC ---
class ObfuscationCipher {
  encryptMap = new Map<string, string>();
  decryptMap = new Map<string, string>();

  async init(options: IntegrationOptions) {
    // Try to load existing config/map to keep builds stable
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
      const data = JSON.parse(raw);

      // Load Map
      this.encryptMap = new Map(data.map);
      this.encryptMap.forEach((v, k) => this.decryptMap.set(v, k));
      console.log('[Obfuscator] Loaded persistent cipher map.');
    } catch (e) {
      // Create new random map
      console.log('[Obfuscator] Creating new cipher map.');
      const charArray = CHARS.split('');
      const shuffled = [...charArray].sort(() => 0.5 - Math.random());
      charArray.forEach((char, index) => {
        this.encryptMap.set(char, shuffled[index]);
        this.decryptMap.set(shuffled[index], char);
      });
    }

    // ALWAYS Save current config + map to disk for Middleware
    const exportData = {
      map: Array.from(this.encryptMap.entries()),
      options: options // Save the user config (pairs, allowlist)
    };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(exportData));
  }

  getEncrypted(char: string) {
    return this.encryptMap.get(char) || char;
  }
}

const cipher = new ObfuscationCipher();

// --- HELPER ---
function toArrayBuffer(buffer: Buffer | Uint8Array | ArrayBuffer): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (ArrayBuffer.isView(buffer)) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  return new Uint8Array(buffer).buffer;
}

// --- PROVIDER WRAPPER ---
export function obfuscate(originalProvider: any) {
  return {
    name: `obfuscated-${originalProvider.name}`,

    async init(context: any) {
      // We don't have options here, so we init cipher lazily or rely on integration setup
      if (originalProvider.init) {
        await originalProvider.init(context);
      }
    },

    resolveFont: async (config: any) => {
      // Coerce weights
      if (config.weights && Array.isArray(config.weights)) {
        config.weights = config.weights.map((w: any) => String(w));
      }

      console.log(`[Font Obfuscator] Requesting '${config.familyName}' from ${originalProvider.name}...`);

      const result = await originalProvider.resolveFont(config);

      if (!result || !result.fonts || !Array.isArray(result.fonts)) {
        console.warn(`[Font Obfuscator] ⚠️ Internal provider returned no valid font data.`);
        return { fonts: [] };
      }

      // Ensure cache exists
      await fs.mkdir(CACHE_DIR, { recursive: true });

      const newFonts = await Promise.all(
        result.fonts.map(async (font: any) => {
          const newSrcs = await Promise.all(
            font.src.map(async (src: any) => {
              let rawBuffer: Buffer | ArrayBuffer | Uint8Array;

              const srcUrl = typeof src === 'string' ? src : src.url || src.path;
              if (!srcUrl) return src;

              const isRemote = srcUrl.startsWith('http');

              try {
                if (isRemote) {
                  const response = await fetch(srcUrl);
                  if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                  rawBuffer = await response.arrayBuffer();
                } else {
                  const localPath = srcUrl.startsWith('file:') ? new URL(srcUrl).pathname : srcUrl;
                  rawBuffer = await fs.readFile(path.resolve(localPath));
                }

                // Decompress WOFF2
                const header = new Uint8Array(rawBuffer instanceof ArrayBuffer ? rawBuffer : rawBuffer.buffer).slice(0, 4);
                const isWoff2 = srcUrl.endsWith('.woff2') || (header[0] === 0x77 && header[1] === 0x4f && header[2] === 0x66 && header[3] === 0x32);

                if (isWoff2) {
                  rawBuffer = await wawoff2.decompress(new Uint8Array(toArrayBuffer(rawBuffer)));
                }

                const cleanBuffer = toArrayBuffer(rawBuffer);
                const fontObj = opentype.parse(cleanBuffer);

                if (fontObj.tables) {
                  if (fontObj.tables.gsub) delete fontObj.tables.gsub;
                  if (fontObj.tables.gpos) delete fontObj.tables.gpos;
                }

                // Obfuscate using singleton cipher
                for (let i = 0; i < fontObj.glyphs.length; i++) {
                  const glyph = fontObj.glyphs.get(i);
                  if (glyph.unicode) {
                    const char = String.fromCharCode(glyph.unicode);
                    if (cipher.encryptMap.has(char)) {
                      const encryptedChar = cipher.encryptMap.get(char)!;
                      glyph.unicode = encryptedChar.charCodeAt(0);
                      glyph.unicodes = [encryptedChar.charCodeAt(0)];
                    }
                  }
                }

                // Compress back to WOFF2 Data URI
                const otfBuffer = fontObj.toArrayBuffer();
                const woff2Buffer = await wawoff2.compress(new Uint8Array(otfBuffer));
                const base64 = Buffer.from(woff2Buffer).toString('base64');
                const dataUri = `data:font/woff2;base64,${base64}`;

                if (typeof src === 'string') {
                  return { path: dataUri, format: 'woff2' };
                }
                return { ...src, path: dataUri, url: dataUri, format: 'woff2' };
              } catch (e) {
                console.error(`[Font Obfuscator] Error processing ${srcUrl}:`, e);
                return src;
              }
            })
          );

          return {
            ...font,
            src: newSrcs,
            optimizedFallbacks: false
          };
        })
      );

      return { fonts: newFonts };
    }
  };
}

// --- INTEGRATION ---
export function fontObfuscatorIntegration(options: IntegrationOptions): AstroIntegration {
  return {
    name: 'astro-font-obfuscator-transformer',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, command, addMiddleware }) => {
        // Initialize cipher and save config for middleware
        await cipher.init(options);

        // Add Middleware for SSR
        addMiddleware({
          entrypoint: path.resolve(process.cwd(), 'src/integrations/obfuscator-middleware.ts'),
          order: 'post'
        });
      }
    }
  };
}
