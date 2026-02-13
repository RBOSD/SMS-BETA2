# Vercel + Supabase 部署說明

## 資料庫連線逾時問題

若在 Vercel 上出現 `timeout exceeded when trying to connect`，請依下列步驟檢查：

### 1. 使用正確的 Supabase 連線字串

**重要**：Vercel serverless 建議使用 **Transaction Mode (port 6543)** 連線字串。

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 左側 **Project Settings** → **Database**
4. 在 **Connection string** 區塊，選擇 **Transaction** 模式（非 Session）
5. 複製連線字串，格式類似：
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```

### 2. 在 Vercel 設定環境變數

1. Vercel 專案 → **Settings** → **Environment Variables**
2. 新增 `DATABASE_URL`，貼上上述連線字串
3. 若使用 Session 模式（port 5432），請確認密碼正確且專案允許外部連線

### 3. 其他必要環境變數

- `SESSION_SECRET`：至少 32 字元隨機字串（生產環境必填）
- `GEMINI_API_KEY`：（選填）若使用 AI 審查功能

### 4. 重新部署

修改環境變數後，請至 **Deployments** 手動觸發 **Redeploy**。

---

## React 版介面

本專案在 Vercel 上會建置 React 版至 `public/app/`。若 Build Logs 顯示 `npm run build:vercel` 成功，即會使用 React 版介面。
