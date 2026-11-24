import { defineConfig } from 'vite'

// mupdf uses top-level await, so the build targets modern WebViews only.
// pdfjs-dist, pdf-lib and mupdf are resolved from the desktop app's node_modules (../../).
export default defineConfig({
  base: './',
  build: { target: 'esnext', outDir: 'dist', emptyOutDir: true },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  server: { fs: { allow: ['../..'] } }
})
