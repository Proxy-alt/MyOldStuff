// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
    output: 'server', // Enable SSR
    adapter: node({
        mode: 'middleware', // Crucial for Express integration
    }),
});