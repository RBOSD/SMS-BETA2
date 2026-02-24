# SMS-BETA 程式碼檢查報告

> 檢查日期：2025-02-23

## 一、已修正項目

| 項目 | 說明 |
|------|------|
| **AppHeader 未使用 import** | 移除 `useNavigate`（未使用） |
| **PreviewModal XSS 風險** | 加入 `escapeHtml()` 過濾 `content`，避免未過濾 HTML 注入 |
| **rateLimit 過時設定** | 移除 `legacyHeaders: false`（express-rate-limit v7 已不支援） |

---

## 二、舊系統遺留

### 2.1 資料庫遷移邏輯（保留）

- **`db/init.js:259-271`**：Legacy admin 遷移（將舊 `role='admin'` 使用者對應至 admin 群組）
- **`db/init.js:171`**：`inspection_plans` 表遷移至 `inspection_plan_schedule`
- **建議**：若所有部署皆已完成遷移，可評估移除；否則建議保留

### 2.2 CSS 相容性

- **`public/css/views.css:780`**：`/* 相容舊的標籤 */`，`td[data-label="管理功能"]` 樣式
- **說明**：目前 `src/` 中無使用 `data-label="管理功能"`，可能為舊版 HTML 備援
- **建議**：若確認不再使用可移除；否則保留以相容舊資料

### 2.3 專案結構說明

- **`README.md:73`**：註明 `public/` 含「舊版 HTML（備援）」
- **現況**：`public/` 下未發現 `.html` 檔案，可能已移除或改由 React 取代
- **建議**：更新 README 描述以符合現況

---

## 三、待處理項目

### 3.1 TODO 標記

| 位置 | 內容 |
|------|------|
| `src/components/layout/AppHeader.jsx:52` | `/* TODO: 個人設定 */` — 個人設定功能尚未實作 |

### 3.2 未使用元件

- **`src/components/common/PreviewModal.jsx`**：目前未被任何頁面 import
- **說明**：已加入 XSS 防護，可作為共用元件保留供日後使用

---

## 四、建置輸出與 .gitignore

- **`dist/`**、**`public/app/`**、**`public/dist/`** 已列入 `.gitignore`
- **建議**：若版本庫中仍有 `dist/` 或 `dist/dist/`，可執行 `git rm -r --cached dist/` 後再 commit，避免提交建置產物

---

## 五、安全與效能建議

### 5.1 生產環境 Console

- **後端**：`server.js`、`db/init.js`、`config/pool.js`、`routes/*` 等處有 `console.log/error/warn`
- **建議**：生產環境改用日誌庫（如 winston、pino），或透過環境變數控制是否輸出

### 5.2 預設管理員密碼

- **`db/init.js:224-234`**：首次初始化時建立預設 admin，密碼輸出至 console
- **建議**：生產環境強制使用 `DEFAULT_ADMIN_PASSWORD` 環境變數，避免輸出隨機密碼

### 5.3 Session Secret

- **`server.js`**：已檢查生產環境必須設定 `SESSION_SECRET`
- **現況**：開發環境仍有預設值，生產環境會強制要求

---

## 六、總結

| 類別 | 狀態 |
|------|------|
| 未使用 import | ✅ 已修正 |
| XSS 風險 | ✅ 已修正（PreviewModal） |
| 過時 API | ✅ 已修正（legacyHeaders） |
| 舊系統遷移邏輯 | ⏸️ 保留（待確認是否仍需） |
| TODO 功能 | ⏸️ 待實作（個人設定） |
| 建置輸出 | ⏸️ 建議確認 .gitignore 生效 |
