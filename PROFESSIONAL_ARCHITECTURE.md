# SMS 開立事項系統 — 專業架構說明

> 版本：1.0  
> 日期：2025-02-12  
> 重要：**所有功能、顏色、版面、字體、字形與原本完全相同**

---

## 一、架構改善總覽

| 項目 | 改善前 | 改善後 |
|------|--------|--------|
| 前端 JS | 13 個獨立 script 檔依序載入 | 單一打包 bundle (`/dist/app.js`) |
| 建置工具 | 無 | Vite 5 |
| 模組化 | 多檔手動控制載入順序 | Entry 統一管理依賴順序 |
| 環境變數 | 無範例 | `.env.example` |
| 版本控制 | 無 .gitignore | 標準 .gitignore |

---

## 二、專案結構

```
SMS-BETA/
├── vite.config.js          # Vite 建置設定
├── .env.example            # 環境變數範例
├── .gitignore              # 版本控制忽略檔
├── package.json            # 含 build、build:watch 指令
├── server.js               # Express 後端入口
├── config/                 # 後端設定
├── db/                     # 資料庫
├── middleware/             # 中介層
├── routes/                 # API 路由
├── utils/                  # 共用工具
└── public/
    ├── index.html          # 主頁（載入 /dist/app.js）
    ├── login.html
    ├── dist/               # 建置輸出（npm run build 產生）
    │   └── app.js          # 打包後的前端 JS
    ├── css/                # 樣式（未變）
    ├── js/
    │   ├── entry.js        # 前端入口（Vite 打包用）
    │   ├── core.js
    │   ├── utils.js
    │   └── ...
    ├── scripts.js          # 遺留邏輯
    └── views/              # HTML 視圖片段
```

---

## 三、開發與部署指令

| 指令 | 說明 |
|------|------|
| `npm run build` | 打包前端 JS 至 `public/dist/app.js` |
| `npm run build:watch` | 監聽原始檔變更並自動重新打包 |
| `npm run dev` | 先執行 build，再啟動開發伺服器 |
| `npm start` | 啟動生產伺服器（部署前需先 `npm run build`） |

---

## 四、Vercel 部署

1. 在 Vercel 專案設定中，將 **Build Command** 設為 `npm run build`
2. 或確保 `package.json` 有 `"build": "vite build"`，Vercel 會自動執行
3. 部署後 `public/dist/app.js` 會由 Express 靜態服務提供

---

## 五、Entry 載入順序

```
entry.js
  ├── core.js
  ├── utils.js
  ├── auth.js
  ├── navigation.js
  ├── dashboard.js
  ├── search-view.js
  ├── import-view.js
  ├── plans-view.js
  ├── users-view.js
  ├── calendar-view.js
  ├── modals.js
  ├── scripts.js
  └── main.js
```

---

## 六、不變項目（承諾）

- 所有 API 行為
- 登入、登出、權限檢查
- 開立事項檢索、篩選、分頁、排序
- 資料管理、Word 匯入、批次建檔
- 檢查計畫、排程、月曆
- 後台管理、使用者、群組、日誌
- 所有 CSS 顏色、版面、字體、字形
- 所有按鈕、圖示、Modal、Drawer

---

## 七、回滾方式

若需恢復為多檔載入方式：

1. 修改 `public/index.html`，將  
   `<script src="/dist/app.js"></script>`  
   改回原先的 13 個 `<script src="/js/...">` 標籤
2. 移除 `package.json` 中的 `build`、`build:watch` 指令
3. 移除 `vite.config.js`、`public/js/entry.js`

---

文件結束。
