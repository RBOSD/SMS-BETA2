/**
 * Vite 建置設定 - React 前端
 * 維持原有功能、顏色、版面、字體、字形不變
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';

export default defineConfig({
  plugins: [react(), commonjs()],
  root: '.',
  publicDir: process.env.VERCEL ? false : 'public',
  base: process.env.VERCEL ? '/app/' : '/',
  optimizeDeps: {
    include: ['xlsx', 'mammoth', 'chart.js', 'chartjs-plugin-datalabels', 'react-chartjs-2'],
  },
  build: {
    outDir: process.env.VERCEL ? 'public/app' : 'dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: 'index.html',
      output: {
        format: 'es',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    minify: 'esbuild',
    sourcemap: true,
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
