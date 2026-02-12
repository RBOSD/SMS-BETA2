/**
 * Vite 建置設定
 * 將前端 JS 打包為單一 bundle，維持原有功能、版面、樣式不變
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: false, // 純 JS 打包，靜態檔由 Express 提供
  build: {
    outDir: 'public/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'public/js/entry.js'),
      output: {
        entryFileNames: 'app.js',
        format: 'iife',
        // 確保所有 side-effect 模組正確執行
        inlineDynamicImports: true,
      },
    },
    minify: 'esbuild', // 使用內建 esbuild，無需額外安裝 terser
    sourcemap: true, // 生產環境可除錯
  },
  // 開發時可搭配 npm run dev:client 預覽
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/views': { target: 'http://localhost:3000', changeOrigin: true },
      '/css': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
