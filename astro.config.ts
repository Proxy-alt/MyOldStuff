import fastify from '@matthewp/astro-fastify';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: fastify({
    entry: new URL('./src/server.ts', import.meta.url)
  }),
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [
    AstroPWA({
      strategies: 'injectManifest',
      srcDir: 'src/scripts',
      filename: 'sw.ts',

      // ⭐ THIS is the correct place for your glob settings
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['storage/**']
      },

      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  experimental: {
    svgo: true
  }
});
