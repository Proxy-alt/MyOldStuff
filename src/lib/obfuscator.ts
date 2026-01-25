import type { AstroIntegration } from 'astro';
import { parse } from 'node-html-parser';
import fs from 'node:fs/promises';
import path from 'node:path';
import opentype from 'opentype.js';

// --- 1. SHARED CIPHER (Singleton) ---
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?!';
const CACHE_DIR = '.astro/obfuscated-fonts';

class ObfuscationCipher {
  encryptMap = new Map<string, string>();
  decryptMap = new Map<string, string>();

  constructor() {
    const charArray = CHARS.split('');
    const shuffled = [...charArray].sort(() => 0.5 - Math.random());

    charArray.forEach((char, index) => {
      this.encryptMap.set(char, shuffled[index]);
      this.decryptMap.set(shuffled[index], char);
    });
  }

  getEncrypted(char: string) {
    return this.encryptMap.get(char) || char;
  }
}

const cipher = new ObfuscationCipher();

// --- 2. THE PROVIDER WRAPPER ---
export function obfuscate(originalProvider: any) {
  return {
    name: `obfuscated-${originalProvider.name}`,
    resolveFont: async (config: any) => {
      const result = await originalProvider.resolveFont(config);

      if (!result || !result.fonts) return result;

      await fs.mkdir(CACHE_DIR, { recursive: true });

      const newFonts = await Promise.all(
        result.fonts.map(async (font: any) => {
          const newSrcs = await Promise.all(
            font.src.map(async (src: any) => {
              let buffer: ArrayBuffer;
              let filename = `obfuscated-${Math.random().toString(36).slice(2)}.otf`;

              if (typeof src.path === 'string' && src.path.startsWith('http')) {
                const response = await fetch(src.path);
                buffer = await response.arrayBuffer();
              } else if (typeof src.path === 'string') {
                buffer = await fs.readFile(path.resolve(src.path));
                filename = `obfuscated-${path.basename(src.path)}`;
              } else {
                return src;
              }

              try {
                const fontObj = opentype.parse(buffer);

                for (let i = 0; i < fontObj.glyphs.length; i++) {
                  const glyph = fontObj.glyphs.get(i);
                  const char = String.fromCharCode(glyph.unicode);

                  if (cipher.encryptMap.has(char)) {
                    const encryptedChar = cipher.encryptMap.get(char)!;
                    glyph.unicode = encryptedChar.charCodeAt(0);
                    glyph.unicodes = [encryptedChar.charCodeAt(0)];
                  }
                }

                const outPath = path.join(CACHE_DIR, filename);
                const newBuffer = fontObj.toArrayBuffer();
                await fs.writeFile(outPath, Buffer.from(newBuffer));

                return {
                  ...src,
                  path: outPath,
                  format: 'opentype'
                };
              } catch (e) {
                console.error(`[Font Obfuscator] Failed to process font: ${e}`);
                return src;
              }
            })
          );

          return { ...font, src: newSrcs };
        })
      );

      return { ...result, fonts: newFonts };
    }
  };
}

// --- 3. THE INTEGRATION (HTML Transformer) ---
interface IntegrationOptions {
  /** Configuration for specific tags */
  pairs: {
    targets: string[];
    cssVariable: string;
    /** * If true, do NOT add the aria-label with the original text.
     * Overrides the global defaultStripAriaLabel setting.
     */
    stripAriaLabel?: boolean;
  }[];

  /** Global default for stripping aria-labels. Default is false (aria-labels are added). */
  defaultStripAriaLabel?: boolean;

  allowlist?: string[];
  blocklist?: string[];
  dev?: boolean;
}

export function fontObfuscatorIntegration(options: IntegrationOptions): AstroIntegration {
  return {
    name: 'astro-font-obfuscator-transformer',
    hooks: {
      'astro:config:setup': ({ config, updateConfig, command }) => {
        let isActive = true;
        const siteUrl = config.site ? new URL(config.site) : null;
        const hostname = siteUrl?.hostname || 'localhost';

        if (command === 'dev' && !options.dev) isActive = false;

        if (options.allowlist && options.allowlist.length > 0) {
          if (!options.allowlist.includes(hostname)) isActive = false;
        }

        if (options.blocklist && options.blocklist.includes(hostname)) isActive = false;

        if (!isActive) return;

        updateConfig({
          vite: {
            plugins: [
              {
                name: 'vite-html-obfuscator',
                transformIndexHtml: {
                  order: 'post',
                  handler(html) {
                    const root = parse(html);

                    options.pairs.forEach((pair) => {
                      // Determine if we strip the label for this specific pair
                      // Hierarchy: Pair Setting > Global Default > False (Default behavior: Keep Label)
                      const shouldStrip = pair.stripAriaLabel ?? options.defaultStripAriaLabel ?? false;

                      pair.targets.forEach((selector) => {
                        const elements = root.querySelectorAll(selector);
                        elements.forEach((el) => {
                          if (!el.innerText.trim()) return;

                          const original = el.innerText;
                          const encrypted = original
                            .split('')
                            .map((c) => cipher.getEncrypted(c))
                            .join('');

                          el.innerText = encrypted;

                          // Accessibility / Scraping Logic
                          if (shouldStrip) {
                            // Remove it if it exists to ensure clean DOM
                            el.removeAttribute('aria-label');
                          } else {
                            // Add it for screen readers
                            el.setAttribute('aria-label', original);
                          }

                          const existingStyle = el.getAttribute('style') || '';
                          el.setAttribute('style', `${existingStyle} font-family: var(${pair.cssVariable}) !important; user-select: none;`);
                        });
                      });
                    });

                    return root.toString();
                  }
                }
              }
            ]
          }
        });
      }
    }
  };
}
