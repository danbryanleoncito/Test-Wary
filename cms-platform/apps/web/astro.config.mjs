import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server', // Enable SSR mode

  adapter: node({
    mode: 'standalone'
  }),

  integrations: [
    react()
  ],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['@repo/shared', '@repo/ui']
    }
  },

  server: {
    port: 4321,
    host: true
  }
});