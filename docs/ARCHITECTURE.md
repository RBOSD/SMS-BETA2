# SMS 系統架構說明

## 架構概覽

**React 單一前端架構**，所有功能、顏色、版面、字體、字形均維持不變。

### 前端

- **技術**：React + Vite
- **入口**：`index.html`（專案根目錄）→ `src/main.jsx`
- **路由**：React Router（/login、/、/search、/calendar、/import/*、/users/*）

### 靜態檔案服務

- **僅使用新架構**：若有 `dist/`（或 Vercel 的 `public/app/`），Express 從該處提供
- **無 fallback**：若建置檔不存在，回傳錯誤，不退回舊版

### 專案結構

```
SMS-BETA/
├── index.html              # React 入口
├── src/                    # React 原始碼
│   ├── main.jsx
│   ├── App.jsx
│   ├── views/              # 頁面元件
│   ├── components/         # 共用元件
│   └── context/            # 狀態管理
├── public/
│   └── css/                # 樣式（React 引用）
├── dist/                   # 本機建置輸出（npm run build）
├── public/app/             # Vercel 建置輸出（npm run build:vercel）
├── routes/                 # 後端 API 路由
├── middleware/             # 中介層
├── db/                     # 資料庫
└── vite.config.js         # Vite 設定
```

### 開發流程

**開發模式**
```bash
npm run dev          # 後端
npm run dev:client   # 前端（Vite，port 5173）
```

**生產部署**
```bash
npm run build        # 本機：產生 dist/
npm run build:vercel # Vercel：產生 public/app/
npm start
```

### 與一般網站的異同

| 面向 | 說明 |
|------|------|
| **前端** | React SPA，Vite 打包 |
| **後端** | Express + 模組化 routes、middleware、db |
| **視圖** | React 元件與路由 |
| **樣式** | 沿用 public/css/ 結構與變數 |
