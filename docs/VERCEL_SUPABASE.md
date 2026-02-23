# Vercel + Supabase 部署設定

## 連線逾時問題

若出現 `Error: timeout exceeded when trying to connect`，通常是 **DATABASE_URL 使用了錯誤的連線模式**。

## 正確設定

### 1. 使用 Transaction Mode 連線字串

Vercel 為 serverless 環境，**必須**使用 Supabase 的 **Transaction mode**（port 6543），不可使用 Direct 或 Session mode。

**取得連線字串：**
1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇專案 → **Connect**（或 Project Settings → Database）
3. 選擇 **Transaction mode**（不是 Direct 或 Session mode）
4. 複製連線字串，格式類似：
   ```
   postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
   或
   ```
   postgres://postgres:[password]@db.[project-ref].supabase.co:6543/postgres
   ```
5. 確認 port 為 **6543**（不是 5432）

### 2. Vercel 環境變數

在 Vercel 專案 → **Settings** → **Environment Variables** 設定：

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | Transaction mode 連線字串（port 6543） |
| `SESSION_SECRET` | 至少 32 字元的隨機字串 |
| `GEMINI_API_KEY` | （選用）AI 審查功能 |

**或** 若已有 `DATABASE_URL` 為 Direct/Session 模式，可額外設定：

| 變數 | 說明 |
|------|------|
| `DATABASE_POOLER_URL` | Transaction mode 連線字串（port 6543） |

系統會優先使用 `DATABASE_POOLER_URL`（僅在 Vercel 環境）。

### 3. 驗證

- 連線字串必須包含 `:6543/`（Transaction mode）
- 程式會自動附加 `?pgbouncer=true` 以關閉 prepared statements
- 連線逾時已設為 25 秒，以因應 Vercel cold start

## 常見錯誤

| 錯誤 | 原因 |
|------|------|
| timeout exceeded when trying to connect | 使用 Direct (5432) 或 Session mode，應改用 Transaction (6543) |
| prepared statement does not exist | 未附加 pgbouncer=true（程式已自動處理） |
| Connection refused | 防火牆或 Supabase 專案已暫停 |
