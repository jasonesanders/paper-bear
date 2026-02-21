import { defineConfig } from 'astro/config';
import db from '@astrojs/db';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://theweekahead.ca',
  base: '/',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [db()],
  server: {
    host: '0.0.0.0', // Bind to all interfaces for Docker
    port: 4321
  }
});