# SMS 開立事項查詢與 AI 審查系統

鐵道局開立事項管理系統，支援開立事項檢索、檢查行程規劃、資料管理、後台管理，並整合 Gemini AI 審查輔助。

## 技術架構

- **前端**：React 18 + Vite 5
- **後端**：Node.js + Express
- **資料庫**：PostgreSQL
- **AI**：Google Gemini API（選用）

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

複製 `.env.example` 為 `.env`，並填入：

- `DATABASE_URL`：PostgreSQL 連線字串（必填）
- `SESSION_SECRET`：Session 密鑰，至少 32 字元（必填）
- `GEMINI_API_KEY`：Gemini API 金鑰（選用，用於 AI 審查）

### 3. 開發模式

需同時啟動後端與前端：

```bash
# 終端機 1 - 後端
npm run dev

# 終端機 2 - 前端
npm run dev:client
```

開啟 http://localhost:5173

### 4. 生產建置

```bash
npm run build
npm start
```

開啟 http://localhost:3000

## 功能模組

| 路徑 | 說明 |
|------|------|
| `/` | 開立事項檢索 |
| `/calendar` | 檢查行程檢索 |
| `/import/batch` | 批次匯入（Word 解析） |
| `/import/create` | 事項新增 |
| `/import/year-edit` | 事項修正 |
| `/import/schedule` | 行程規劃 |
| `/import/manage` | 計畫管理 |
| `/users/*` | 後台管理（帳號、群組、紀錄、系統維護） |

## 專案結構

```
├── src/
│   ├── api/           # API 封裝
│   ├── components/   # 共用元件
│   ├── context/      # React Context（Auth、Toast）
│   ├── utils/        # 工具函數、常數
│   └── views/        # 頁面元件
├── public/           # 靜態資源（CSS 等）
├── server.js         # Express 後端
└── vite.config.js    # Vite 設定
```

## 部署說明

詳見 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 授權

ISC
