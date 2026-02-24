#!/usr/bin/env node
/**
 * 移除舊系統建置產物
 * 執行：node scripts/clean-old-system.js
 * 或：npm run clean (若已加入 package.json scripts)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dirsToRemove = ['dist', 'public/dist', 'public/app'];
const removed = [];

for (const dir of dirsToRemove) {
  const fullPath = path.join(root, dir);
  if (fs.existsSync(fullPath)) {
    try {
      fs.rmSync(fullPath, { recursive: true });
      removed.push(dir);
      console.log('已刪除:', dir);
    } catch (e) {
      console.error('刪除失敗', dir, e.message);
    }
  }
}

if (removed.length === 0) {
  console.log('無需刪除的舊建置目錄');
} else {
  console.log('完成。請執行 npm run build 重新建置。');
}
