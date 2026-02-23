/**
 * Vite 建置設定 - React 前端
 * 維持原有功能、顏色、版面、字體、字形不變
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: process.env.VERCEL ? false : 'public',
  base: process.env.VERCEL ? '/app/' : '/',
  optimizeDeps: {
    include: ['xlsx', 'mammoth', 'react-chartjs-2'],
    exclude: ['chart.js', 'chartjs-plugin-datalabels'],
  },
  build: {
    outDir: process.env.VERCEL ? 'public/app' : 'dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: 'index.html',
      output: {
        format: 'es',
        inlineDynamicImports: true,
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    minify: 'esbuild',
    sourcemap: false,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: false,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/auth': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
