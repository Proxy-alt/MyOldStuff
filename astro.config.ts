import db from '@astrojs/db';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';
import { defineConfig, fontProviders } from 'astro/config';
import { fontObfuscatorIntegration as fontObfuscator, obfuscate } from './src/integrations/obfuscator';
import sitemapPlus from './src/integrations/sitemap';
import startFastifyServer from './src/server.ts';

import partytown from '@astrojs/partytown';

export default defineConfig({
  output: 'server',
  site: process.env.SITE_URL || 'http://localhost:3000',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport'
  },
  adapter: node({
    mode: 'standalone'
  }),
  session: {
    driver: 'memory',
    options: {
      ttl: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/bare': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          ws: true
        },
        '/wisp': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          ws: true
        },
        '/api/wisp-premium': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          ws: true
        }
      }
    }
  },
  integrations: [
    {
      name: 'fastify-startup',
      hooks: {
        'astro:server:setup': async () => {
          await startFastifyServer();
        }
      }
    },
    db(),
    sitemapPlus({
      debug: true
    }),
    AstroPWA({
      strategies: 'injectManifest',
      srcDir: 'src/scripts',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg, avif, webp}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 // 5 Megabytes
      },
      workbox: {
        globIgnores: ['scram/**']
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    }),
    react(),
    fontObfuscator({
      dev: true,
      //blocklist: ['localhost', process.env.SITE_URL?.replace(/^https?:\/\//, '') || ''],
      defaultStripAriaLabel: true,
      pairs: [
        {
          targets: ['.obfuscate', '.obfuscated-text', '[data-obfuscate]'],
          cssVariable: '--font-inter-obfuscated',
          originalCssVariable: '--font-inter',
          stripAriaLabel: true
        },
        {
          targets: ['.obfuscate-poppins', '.obfuscated-text-poppins', '[data-obfuscate-poppins]', '.game-name'],
          cssVariable: '--font-poppins-obfuscated',
          originalCssVariable: '--font-poppins',
          stripAriaLabel: true
        }
      ]
    }),
    partytown({
      config: {
        forward: ['adsbygoogle.push', 'dataLayer.push', 'gtag', 'atOptions', 'aclib.runAutoTag']
      }
    })
  ],
  experimental: {
    svgo: true,
    failOnPrerenderConflict: true,
    clientPrerender: true,
    staticImportMetaEnv: true,
    preserveScriptOrder: true,
    csp: {
      directives: [
        "default-src: 'self'",
        "base-uri: 'none'",
        'upgrade-insecure-requests',
        "font-src: 'self'",
        "worker-src: 'self'",
        "img-src: 'self' data: https://raw.githubusercontent.com https://cdn.jsdelivr.net/gh/gn-math/covers@main/",
        "connect-src: 'self' wss://localhost:3000 ws://localhost:3000 https://discord.com https://discord.gg https://api.github.com https://raw.githubusercontent.com https://cdn.jsdelivr.net https://www.googletagmanager.com"
      ],
      scriptDirective: {
        resources: ["'self'", 'https://www.googletagmanager.com']
      },
      styleDirective: {
        resources: ["'self'", "'https://cdn.jsdelivr.net/gh/gn-math/covers@main/'"]
      }
    },
    fonts: [
      {
        provider: fontProviders.googleicons(),
        name: 'Material Symbols Rounded',
        cssVariable: '--symbols-rounded',
        options: {
          experimental: {
            glyphs: ['arrow_forward_ios', 'chevron_left', 'home', 'sports_esports', 'apps', 'globe_book', 'account_circle', 'settings']
          }
        }
      },
      {
        provider: fontProviders.google(),
        name: 'Poppins',
        cssVariable: '--font-poppins',
        weights: ['400', '500', '600', '700'],
        styles: ['normal']
      },
      {
        provider: fontProviders.google(),
        name: 'DM Sans',
        cssVariable: '--font-dm-sans',
        weights: ['200', '400'],
        styles: ['normal']
      },
      {
        provider: fontProviders.google(),
        name: 'Inter',
        cssVariable: '--font-inter',
        weights: ['400', '500'],
        styles: ['normal']
      },
      {
        provider: obfuscate(fontProviders.google()),
        name: 'Inter',
        cssVariable: '--font-inter-obfuscated',
        weights: [400, 500],
        styles: ['normal']
      },
      {
        provider: obfuscate(fontProviders.google()),
        name: 'Poppins',
        cssVariable: '--font-poppins-obfuscated',
        weights: [400, 500, 600, 700],
        styles: ['normal']
      },
      {
        provider: fontProviders.google(),
        name: 'Inter Tight',
        cssVariable: '--font-inter-tight',
        weights: ['400', '500'],
        styles: ['normal']
      },
      {
        provider: fontProviders.google(),
        name: 'Roboto',
        cssVariable: '--font-roboto',
        weights: ['400', '500', '600', '700']
      }
    ]
  }
});
