/**
 * 前端應用程式入口（Vite 打包用）
 * 依序載入各模組，維持與原本多檔載入相同的執行順序
 * 注意：不改變任何功能、顏色、版面、字體、字形
 */

// 1. 核心與工具（需最先載入）
import './core.js';
import './utils.js';

// 2. 認證與導航
import './auth.js';
import './navigation.js';

// 3. 各視圖模組
import './dashboard.js';
import './search-view.js';
import './import-view.js';
import './plans-view.js';
import './users-view.js';
import './calendar-view.js';

// 4. 共用元件（Modal、Drawer、協作編修等）
import './modals.js';

// 5. 遺留邏輯（checkAuth、表格渲染、匯入、批次等）
import '../scripts.js';

// 6. 頁面初始化（DOMContentLoaded）
import './main.js';
