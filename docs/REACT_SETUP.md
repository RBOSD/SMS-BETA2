# React 前端遷移 - Phase 1 完成說明

## 已完成項目

1. **套件安裝**
   - react, react-dom, react-router-dom
   - @vitejs/plugin-react

2. **專案結構**
   - `src/main.jsx` - 入口
   - `src/App.jsx` - 主應用與路由
   - `src/context/AuthContext.jsx` - 認證狀態
   - `src/components/layout/` - Layout、AppHeader、AppSidebar
   - `src/views/` - LoginPage、SearchView、PlaceholderView

3. **樣式整合**
   - 沿用 `public/css/` 所有樣式（base, header, layout, components, views）
   - 登入頁樣式與原 login.html 一致

4. **Vite 設定**
   - React 插件
   - API 代理：`/api`、`/auth` → localhost:3000
   - 建置輸出：`dist/`

5. **後端調整**
   - SPA fallback：dist 存在時，非 API 請求回傳 index.html
   - 未登入導向：dist 存在時導向 `/login`（React 路由）

## 啟動方式

### 開發模式（需同時執行）

1. 終端機 1 - 後端：
   ```bash
   npm run dev
   ```
   （或 `node server.js`）

2. 終端機 2 - 前端：
   ```bash
   npm run dev:client
   ```

3. 開啟瀏覽器：http://localhost:5173

### 首次使用請先執行

```bash
npm install
```

### 建置生產版本

```bash
npm run build
npm start
```

開啟 http://localhost:3000

## 路由對應

| 路徑 | 說明 |
|------|------|
| /login | 登入頁 |
| / | 開立事項檢索 |
| /search | 同上 |
| /calendar | 檢查行程檢索（Phase 2） |
| /import | 資料管理（Phase 2） |
| /users | 後台管理（Phase 2） |

## Phase 2 完成（SearchView 完整遷移）

- ✅ 搜尋、篩選、列表、分頁、排序
- ✅ Dashboard 圖表（Chart.js）
- ✅ DetailDrawer、PreviewModal、ConfirmModal、Toast
- ✅ 批次刪除

## Phase 3 完成（審查、刪除、首次登入）

- ✅ Drawer 審查模式（編輯、多輪次、儲存）
- ✅ AI 智能分析（Gemini API）
- ✅ Drawer 刪除功能
- ✅ 首次登入密碼更新流程（ChangePasswordModal）

## 後續 Phase 4

- 遷移 CalendarView、ImportView、UsersView
