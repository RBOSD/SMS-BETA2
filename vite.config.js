/**
 * Vite 建置設定 - 主流專業架構
 * 單一入口打包、維持原有功能、版面、樣式、字體、字形不變
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'public/index.html'),
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    minify: 'esbuild',
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/views': { target: 'http://localhost:3000', changeOrigin: true },
      '/css': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
