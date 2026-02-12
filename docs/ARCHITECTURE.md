# SMS 系統架構說明

## 主流專業架構改版（已實施）

本次改版採用業界常見的專業架構，**所有功能、顏色、版面、字體、字形均維持不變**。

### 主要變更

#### 1. 單一打包入口（ES Modules）
- **入口**：`public/js/entry.js` 作為單一模組入口
- **載入方式**：由多個 `<script>` 標籤改為單一 `<script type="module" src="./js/entry.js">`
- **依賴順序**：core → utils → auth → navigation → 各視圖 → modals → scripts → main

#### 2. Vite 建置
- **建置指令**：`npm run build`
- **輸出目錄**：`dist/`
- **開發預覽**：`npm run dev:client`（Vite 開發伺服器，port 5173）
- **生產部署**：先執行 `npm run build`，再啟動 `npm run start`

#### 3. 靜態檔案服務
- **優先順序**：若有 `dist/` 資料夾，Express 會優先從 `dist/` 提供靜態檔案
- **Fallback**：若無 `dist/` 或檔案不存在，則從 `public/` 提供

#### 4. DOMContentLoaded 相容
- `main.js` 已調整為支援 ES 模組延遲載入
- 在 `document.readyState === 'loading'` 時使用 `DOMContentLoaded`，否則立即執行

### 專案結構

```
SMS-BETA/
├── public/                 # 前端原始檔
│   ├── index.html          # 主頁（單一 script 入口）
│   ├── login.html
│   ├── css/                # 樣式（不變）
│   ├── js/                 # JavaScript 模組
│   │   ├── entry.js        # 打包入口
│   │   ├── core.js
│   │   ├── utils.js
│   │   ├── auth.js
│   │   └── ...
│   ├── views/              # 動態載入的視圖 HTML
│   └── scripts.js          # 遺留邏輯（由 entry 匯入）
├── dist/                   # 建置輸出（npm run build 後產生）
├── routes/                 # 後端 API 路由
├── middleware/             # 中介層
├── db/                     # 資料庫
├── utils/                  # 共用工具
└── vite.config.js          # Vite 設定
```

### 開發流程

**方式一：直接使用 Express（無需 build）**
```bash
npm run dev
```
瀏覽器會載入 `public/index.html`，透過 ES modules 載入 `entry.js` 及其依賴。

**方式二：Vite 開發伺服器（熱更新）**
```bash
# 終端機 1：後端 API
npm run dev

# 終端機 2：前端開發（Vite 會 proxy /api 到 3000）
npm run dev:client
```
存取 http://localhost:5173

**方式三：生產部署**
```bash
npm run build
npm run start
```

### 與一般網站的異同

| 面向 | 說明 |
|------|------|
| **前端** | 單一 entry、ES modules、Vite 打包（主流專業作法） |
| **後端** | Express + 模組化 routes、middleware、db（與常見 Node 專案一致） |
| **視圖** | 仍以 fetch 動態載入 HTML 片段（與 SPA 稍有不同，但結構清楚） |
| **樣式** | 維持原有 CSS 結構與變數，無任何變更 |
