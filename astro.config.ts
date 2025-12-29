import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'middleware'
  }),
  vite: {
    plugins: [tailwindcss()]
  },
  experimental: {
    svgo: true
  }
});
