import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/app',
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
    allowedHosts: ['8197-102-165-76-187.ngrok-free.app'],
  },
  // test: {
  //   environment: 'jsdom',
  //   setupFiles: './test/setup.ts',
  //   globals: true,
  // },
});
