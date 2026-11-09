// Single self-contained HTML file (JS + CSS inlined) for viewing inside the Claude app side panel.
// PDFs are not bundled in this variant; excerpts and page numbers remain visible in-app.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  publicDir: false,
  define: { 'import.meta.env.VITE_SINGLEFILE': JSON.stringify('1') },
  build: { outDir: 'dist-single', chunkSizeWarningLimit: 3000 },
});
