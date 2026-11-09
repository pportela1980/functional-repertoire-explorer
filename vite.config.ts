import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site under /<repo-name>/; set BASE_PATH there (see .github/workflows/pages.yml)
  base: process.env.BASE_PATH || '/',
  build: { chunkSizeWarningLimit: 1200 },
  server: { host: '127.0.0.1', port: 5287, strictPort: true, open: true },
  preview: { host: '127.0.0.1', port: 5288, strictPort: true, open: true },
});
