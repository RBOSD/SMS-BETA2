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

### 2.1 已移除（2025-02-23）

- **`public/css/views.css`**：移除 `td[data-label="管理功能"]` 舊標籤相容樣式
- **`public/css/layout.css`**：移除舊版收合註解
- **`README.md`**：更新 `public/` 描述，移除「舊版 HTML（備援）」說明

### 2.2 建置產物清理

- **`dist/`**、**`public/dist/`**、**`public/app/`**：可執行 `npm run clean` 刪除舊建置
- 執行 `npm run build` 可重新產生乾淨的 React 建置

### 2.3 資料庫遷移邏輯（保留）

- **`db/init.js`**：Legacy admin 遷移、`inspection_plans` 表遷移
- **說明**：為升級既有環境所需，新安裝不受影響；若所有部署皆已完成遷移，可評估移除

---

## 三、待處理項目

### 3.1 TODO 標記

| 位置 | 內容 |
|------|------|
| ~~`src/components/layout/AppHeader.jsx`~~ | ~~個人設定功能尚未實作~~ — **已實作**：點擊「個人設定」可開啟修改密碼視窗 |

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
