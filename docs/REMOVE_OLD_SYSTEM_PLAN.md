# 移除舊系統程式碼 - 具體步驟與檢查清單

> ✅ **已完成實作**（依此計畫執行）

## 一、前置了解

### 必須保留（React 依賴）
| 路徑 | 原因 |
|------|------|
| `public/css/` | `src/index.css` 以 `@import` 引用 base、header、layout、components、views |
| `public/` 資料夾 | Vite `publicDir` 設定，建置時會複製到輸出 |

### 可安全刪除（舊版專用）
| 路徑 | 說明 |
|------|------|
| `public/index.html` | 舊版主頁（多 script 載入） |
| `public/login.html` | 舊版登入頁（React 有 LoginPage） |
| `public/js/` | 舊版 JS 模組（core, auth, navigation, search-view, import-view, users-view, plans-view, calendar-view, modals, scripts, main） |
| `public/views/` | 舊版視圖 HTML |
| `public/scripts.js` | 舊版共用腳本 |
| `public/dist/` | 舊版建置輸出（與 Vite 的 dist 不同） |

---

## 二、執行步驟

### 步驟 1：備份（建議）
```bash
# 建立備份分支
git checkout -b backup-before-remove-old-system
git add .
git commit -m "備份：移除舊系統前"
git checkout main
```

### 步驟 2：刪除舊版檔案
依序刪除以下檔案/資料夾：

```
public/index.html
public/login.html
public/scripts.js
public/js/          （整個資料夾）
public/views/       （整個資料夾）
public/dist/        （整個資料夾，若存在）
```

### 步驟 3：更新 server.js
移除 catch-all 中對舊路徑的排除（已無需 /js、/views）：

```javascript
// 修改前
if (req.path.startsWith('/api') || req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/views') || req.path.startsWith('/app')) return next();

// 修改後（React 建置檔已打包，僅需排除 /api、/app）
if (req.path.startsWith('/api') || req.path.startsWith('/app')) return next();
```

### 步驟 4：簡化 middleware/protect.js
`protectViewTemplates` 原用於保護舊版 `/views/*.html`，移除舊系統後可刪除：

- 移除 `protectViewTemplates` 的定義與匯出
- 在 `server.js` 中移除 `app.use(protectViewTemplates);`

### 步驟 5：更新 src/utils/parseItemNumber.js
將註解 `與 public/scripts.js 保持一致` 改為 `與原編號解析邏輯一致`（或類似說明）。

### 步驟 6：驗證建置
```bash
npm run build
```
確認無錯誤。

### 步驟 7：驗證執行
```bash
npm start
```
開啟 http://localhost:3000，檢查：
- 登入
- 開立事項檢索
- 檢查行程檢索
- 資料管理（批次匯入、建檔等）
- 後台管理（帳號、登入紀錄、操作歷程）

### 步驟 8：Vercel 部署（若有使用）
推送後確認 Vercel 建置成功，並在正式環境再驗證一次。

---

## 三、檢查清單

### 刪除前
- [x] 已建立備份分支或備份
- [x] 確認目前使用 React 版（非 public 舊版）
- [x] 已執行 `npm run build` 且成功

### 刪除後
- [x] `public/css/` 仍存在
- [x] `public/` 資料夾仍存在
- [x] `npm run build` 成功
- [x] `npm start` 可正常啟動
- [x] 登入功能正常
- [x] 開立事項檢索正常
- [x] 檢查行程檢索正常
- [x] 資料管理各分頁正常
- [x] 後台管理各分頁正常
- [x] 無瀏覽器 console 錯誤

### 選用優化（可稍後進行）
- [ ] 將 `public/css/` 移至 `src/assets/css/` 並更新 `index.css` 引用
- [ ] 更新 `vite.config.js` 的 `publicDir`（若不再需要複製 public）

---

## 四、刪除後 public/ 結構

```
public/
└── css/
    ├── base.css
    ├── header.css
    ├── layout.css
    ├── components.css
    └── views.css
```

（Vercel 建置時 `publicDir` 為 false，`public/app/` 為 React 建置輸出，不受影響。）
