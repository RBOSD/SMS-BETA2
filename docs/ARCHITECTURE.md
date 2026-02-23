# SMS 系統架構說明

## 架構概覽

**所有功能、顏色、版面、字體、字形均維持不變**。

### 前端載入方式

- **載入方式**：多個 `<script>` 標籤依序載入
- **載入順序**：core → utils → auth → navigation → 各視圖 → modals → scripts → main

### 靜態檔案服務

- **僅使用新架構**：若有 `dist/`（或 Vercel 的 `public/app/`），Express 從該處提供
- **無 fallback**：若建置檔不存在，回傳錯誤，不退回舊版 `public/`

### 專案結構

```
SMS-BETA/
├── public/                 # 前端原始檔
│   ├── index.html          # 主頁
│   ├── login.html
│   ├── css/                # 樣式
│   ├── js/                 # JavaScript 模組
│   │   ├── core.js, utils.js, auth.js, ...
│   │   └── main.js
│   ├── views/              # 動態載入的視圖 HTML
│   └── scripts.js
├── dist/                   # 建置輸出（npm run build 後產生，可選）
├── routes/                 # 後端 API 路由
├── middleware/             # 中介層
├── db/                     # 資料庫
├── utils/                  # 共用工具
└── vite.config.js          # Vite 設定
```

### 開發流程

**直接使用 Express（推薦，無需 build）**
```bash
npm run dev
```
瀏覽器會載入 `public/index.html` 及各個 JS 檔案。

**生產部署（可選 build）**
```bash
npm run build   # 可選，產生 dist/
npm run start
```

### 與一般網站的異同

| 面向 | 說明 |
|------|------|
| **前端** | 多檔 script 載入、模組化 JS 檔案 |
| **後端** | Express + 模組化 routes、middleware、db |
| **視圖** | 以 fetch 動態載入 HTML 片段 |
| **樣式** | 維持原有 CSS 結構與變數 |
