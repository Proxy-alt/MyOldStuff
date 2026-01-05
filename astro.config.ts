import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import fastify from '@matthewp/astro-fastify';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  output: 'server',
  adapter: fastify({
    // Point this to the file we just created
    entry: new URL('./src/server.ts', import.meta.url)
  }),
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [
    AstroPWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  experimental: {
    svgo: true
  }
});
