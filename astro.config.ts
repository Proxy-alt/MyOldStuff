import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';
import { defineConfig, fontProviders } from 'astro/config';
import startFastifyServer from './src/server.ts';
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [
    {
      name: 'fastify-startup',
      hooks: {
        'astro:server:setup': async () => {
          await startFastifyServer();
          console.log('🚀 Fastify server attached');
        }
      }
    },
    AstroPWA({
      strategies: 'injectManifest',
      srcDir: 'src/scripts',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg, avif, webp}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 // 5 Megabytes
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    }),
    react()
  ],
  experimental: {
    svgo: true,
    failOnPrerenderConflict: true,
    clientPrerender: true,
    fonts: [
      {
        provider: fontProviders.googleicons(),
        name: 'Material Symbols Rounded',
        cssVariable: '--symbols-rounded'
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
        provider: fontProviders.google(),
        name: 'Inter-Tight',
        cssVariable: '--font-inter-tight',
        weights: ['400', '500'],
        styles: ['normal']
      }
    ]
  }
});
