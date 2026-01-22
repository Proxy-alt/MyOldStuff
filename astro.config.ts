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
    // 1. Move your Fastify hook into an inline integration here:
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['storage/**']
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
      }
    ]
  }
});
