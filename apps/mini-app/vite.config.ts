import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/app',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/channels': 'http://localhost:3000',
      '/subscription-lists': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
    allowedHosts: ['evolved-willing-bulldog.ngrok-free.app'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './test/setup.ts',
  },
});
