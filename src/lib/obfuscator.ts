import type { AstroIntegration } from 'astro';
import { parse } from 'node-html-parser';
import fs from 'node:fs/promises';
import path from 'node:path';
import opentype from 'opentype.js';

/** Character set to obfuscate */
const CHARS: string = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?!';

/** Directory for caching obfuscated fonts */
const CACHE_DIR: string = '.astro/obfuscated-fonts';

/**
 * Cipher class for character encryption/decryption.
 * Implements a simple substitution cipher using shuffled character mappings.
 */
class ObfuscationCipher {
  encryptMap: Map<string, string>;
  decryptMap: Map<string, string>;

  /**
   * Initialize the cipher with shuffled character mappings.
   */
  constructor() {
    this.encryptMap = new Map<string, string>();
    this.decryptMap = new Map<string, string>();

    const charArray: string[] = CHARS.split('');
    const shuffled: string[] = [...charArray].sort(() => 0.5 - Math.random());

    charArray.forEach((char, index) => {
      this.encryptMap.set(char, shuffled[index]);
      this.decryptMap.set(shuffled[index], char);
    });
  }

  /**
   * Get the encrypted equivalent of a character.
   * @param {string} char - Character to encrypt
   * @returns {string} Encrypted character or original if not in character set
   */
  getEncrypted(char: string): string {
    return this.encryptMap.get(char) || char;
  }
}

/** Singleton cipher instance */
const cipher: ObfuscationCipher = new ObfuscationCipher();

/**
 * Create a font provider wrapper that obfuscates font characters.
 * @param {any} originalProvider - The original font provider
 * @returns {{name: string, resolveFont: Function}} Wrapped provider with obfuscation
 */
export function obfuscate(originalProvider: any): any {
  return {
    name: `obfuscated-${originalProvider.name}`,
    /**
     * Resolve and obfuscate fonts.
     * @param {any} config - Font configuration
     * @returns {Promise<any>} Promise resolving to obfuscated font configuration
     */
    resolveFont: async (config: any): Promise<any> => {
      const result = await originalProvider.resolveFont(config);

      if (!result || !result.fonts) return result;

      await fs.mkdir(CACHE_DIR, { recursive: true });

      const newFonts = await Promise.all(
        result.fonts.map(async (font: any) => {
          const newSrcs = await Promise.all(
            font.src.map(async (src: any) => {
              let buffer: ArrayBuffer;
              let filename: string = `obfuscated-${Math.random().toString(36).slice(2)}.otf`;

              if (typeof src.path === 'string' && src.path.startsWith('http')) {
                const response = await fetch(src.path);
                buffer = await response.arrayBuffer();
              } else if (typeof src.path === 'string') {
                const bufferData = await fs.readFile(path.resolve(src.path));
                buffer = bufferData.buffer.slice(bufferData.byteOffset, bufferData.byteOffset + bufferData.byteLength);
                filename = `obfuscated-${path.basename(src.path)}`;
              } else {
                return src;
              }

              try {
                const fontObj = opentype.parse(buffer);

                for (let i = 0; i < fontObj.glyphs.length; i++) {
                  const glyph = fontObj.glyphs.get(i);
                  if (glyph.unicode === undefined || glyph.unicode === null) continue;
                  const char: string = String.fromCharCode(glyph.unicode);

                  if (cipher.encryptMap.has(char)) {
                    const encryptedChar: string = cipher.encryptMap.get(char)!;
                    glyph.unicode = encryptedChar.charCodeAt(0);
                    glyph.unicodes = [encryptedChar.charCodeAt(0)];
                  }
                }

                const outPath: string = path.join(CACHE_DIR, filename);
                const newBuffer: ArrayBuffer = fontObj.toArrayBuffer();
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

/**
 * Integration options for font obfuscation.
 */
interface IntegrationOptions {
  /**
   * Configuration for specific HTML elements to obfuscate.
   */
  pairs: {
    /** CSS selectors for elements to target */
    targets: string[];
    /** CSS variable name containing the obfuscated font family */
    cssVariable: string;
    /**
     * If true, do NOT add the aria-label with the original text.
     * Overrides the global defaultStripAriaLabel setting.
     */
    stripAriaLabel?: boolean;
  }[];

  /**
   * Global default for stripping aria-labels.
   * Default is false (aria-labels are preserved for accessibility).
   */
  defaultStripAriaLabel?: boolean;

  /** Allowlist of hostnames where obfuscation is active */
  allowlist?: string[];

  /** Blocklist of hostnames where obfuscation is disabled */
  blocklist?: string[];

  /** Enable obfuscation in development mode */
  dev?: boolean;
}

/**
 * Create an Astro integration for font obfuscation.
 * Transforms HTML to replace text with obfuscated characters using custom fonts.
 * @param {IntegrationOptions} options - Integration configuration options
 * @returns {AstroIntegration} Astro integration object
 */
export function fontObfuscatorIntegration(options: IntegrationOptions): AstroIntegration {
  return {
    name: 'astro-font-obfuscator-transformer',
    hooks: {
      'astro:config:setup': ({ config, updateConfig, command }) => {
        let isActive: boolean = true;
        const siteUrl: URL | null = config.site ? new URL(config.site) : null;
        const hostname: string = siteUrl?.hostname || 'localhost';

        // Disable in dev mode if not explicitly enabled
        if (command === 'dev' && !options.dev) isActive = false;

        // Check allowlist
        if (options.allowlist && options.allowlist.length > 0) {
          if (!options.allowlist.includes(hostname)) isActive = false;
        }

        // Check blocklist
        if (options.blocklist && options.blocklist.includes(hostname)) isActive = false;

        if (!isActive) return;

        updateConfig({
          vite: {
            plugins: [
              {
                name: 'vite-html-obfuscator',
                transformIndexHtml: {
                  order: 'post',
                  /**
                   * Transform HTML by replacing text with obfuscated characters.
                   * @param {string} html - Original HTML
                   * @returns {string} Transformed HTML with obfuscated text
                   */
                  handler(html: string): string {
                    const root = parse(html);

                    options.pairs.forEach((pair) => {
                      // Determine aria-label stripping preference
                      // Priority: Pair Setting > Global Default > False (keep labels by default)
                      const shouldStrip: boolean = pair.stripAriaLabel ?? options.defaultStripAriaLabel ?? false;

                      pair.targets.forEach((selector) => {
                        const elements = root.querySelectorAll(selector);
                        elements.forEach((el) => {
                          if (!el.innerText.trim()) return;

                          const original: string = el.innerText;
                          const encrypted: string = original
                            .split('')
                            .map((c) => cipher.getEncrypted(c))
                            .join('');

                          (el as any).innerText = encrypted;

                          // Handle accessibility and anti-scraping
                          if (shouldStrip) {
                            // Remove aria-label if it exists to prevent content disclosure
                            el.removeAttribute('aria-label');
                          } else {
                            // Preserve aria-label for screen readers
                            el.setAttribute('aria-label', original);
                          }

                          // Apply obfuscation styling
                          const existingStyle: string = el.getAttribute('style') || '';
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
