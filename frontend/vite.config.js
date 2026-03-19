import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/app/',
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:4000',
      '/sessions': 'http://localhost:4000',
      '/v1': 'http://localhost:4000',
      '/templates': 'http://localhost:4000',
      '/webhooks': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
});
