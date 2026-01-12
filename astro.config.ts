import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';
import startFastifyServer from './src/server.ts';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  vite: {
    plugins: [tailwindcss()]
  },
  hooks: {
    'astro:server:setup': async () => {
      await startFastifyServer();
    }
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
