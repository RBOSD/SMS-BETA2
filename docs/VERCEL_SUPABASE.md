# Vercel + Supabase 部署設定

## ⚠️ 自動登出 / 計畫讀取失敗問題

**現象**：登入後會自動跳回登入畫面，或在計劃管理讀取時出錯後跳出。

**原因**：Vercel 未設定 Redis 時使用 MemoryStore。

- 每個 serverless 請求可能打到不同 instance
- Session 僅存在單一 instance 記憶體中
- 切換 instance 時 session 遺失 → 401 → 被導向登入頁

**解決方式**：安裝 **Upstash Redis** 並設定 `REDIS_URL`，讓 session 持久化，所有 instance 共用同一 session。

---

## Vercel Session 環境變數設定位置

**路徑：** [vercel.com](https://vercel.com) → 選擇專案 → **Settings** → **Environment Variables**

| 變數名稱 | 用途 | 取得方式 |
|----------|------|----------|
| `SESSION_SECRET` | Session 簽章密鑰（必填） | 本機執行 `openssl rand -base64 32` 產生 |
| `REDIS_URL` 或 `KV_URL` | Session 持久化（Redis 協定） | Upstash Console 取得 |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Session 持久化（REST API，**建議**） | Vercel Integrations 安裝後自動注入 |
| `DATABASE_URL` | 資料庫連線（業務資料用） | Supabase Dashboard → Connect → Transaction mode |

**產生 SESSION_SECRET：**
```bash
openssl rand -base64 32
```
將輸出結果貼到 Vercel 的 `SESSION_SECRET` 欄位，長度至少 32 字元。

---

## 連線逾時問題

若出現 `Error: timeout exceeded when trying to connect`，程式已做以下處理：

1. **Vercel 且未設定 Redis**：自動改用 MemoryStore（記憶體 session）
   - ⚠️ 每個 serverless instance 有獨立記憶體，session 不共用
   - 請求打到不同 instance 時 session 遺失 → 401 → 被導向登入頁
   - **強烈建議**安裝 Upstash Redis 並設定 `REDIS_URL` 以持久化 session

2. **Vercel 且已設定 Redis**：使用 Redis 作為 session store，不依賴 Supabase 連線

3. **PostgreSQL 連線**：逾時已提高至 60 秒，以因應 cold start

若仍出現逾時，可嘗試以下解法。

---

## 解法 A：使用 Redis 作為 Session Store（建議）

**解決**：① Supabase 連線逾時 ② 自動登出 / 計畫讀取失敗

使用 **Upstash Redis** 儲存 session，讓所有 serverless instance 共用同一 session。

### 步驟

1. [vercel.com](https://vercel.com) → 選擇專案 → **Integrations**（或 **Marketplace**）
2. 搜尋 **Upstash Redis** → 點擊 **Add Integration** → 選擇專案
3. 安裝後會自動在 **Settings → Environment Variables** 注入 `UPSTASH_REDIS_REST_URL` 與 `UPSTASH_REDIS_REST_TOKEN`
4. 確認路徑：**Settings** → **Environment Variables**，應可看到上述兩個變數
5. 若未出現，可至 [Upstash Console](https://console.upstash.com/) 建立 Redis 資料庫，複製連線字串手動新增
6. 重新部署

程式會自動偵測：當 `VERCEL=1` 且具備 Redis 憑證時，使用 Upstash Redis 作為 session store。支援 `UPSTASH_REDIS_REST_URL`+`UPSTASH_REDIS_REST_TOKEN`（REST API）或 `REDIS_URL`/`KV_URL`（Redis 協定）。

---

## 解法 B：修正 Supabase 連線字串

若堅持使用 PostgreSQL 儲存 session，`DATABASE_URL` 必須使用 **port 6543**（Transaction mode）。

### 快速檢查

1. Vercel → Settings → Environment Variables
2. 查看 `DATABASE_URL` 的值
3. **必須包含 `:6543`**（例如 `...@xxx.supabase.com:6543/postgres`）
4. 若為 `:5432`，請改為 Transaction mode 連線字串

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
- 連線逾時已設為 60 秒，以因應 Vercel cold start

## Supabase 專案暫停（Free 方案）

Free 方案專案 **7 天無活動會自動暫停**。恢復時需要較長冷啟動時間，可能導致連線逾時。

**處理方式：**
1. 登入 Supabase Dashboard，確認專案狀態（若顯示 Paused 請點擊 Restore）
2. 恢復後等待 1–2 分鐘再重試
3. 可設定定期 ping（如 cron）保持專案活躍

## 常見錯誤

| 錯誤 | 原因 |
|------|------|
| 登入後自動跳回登入畫面 / 計畫讀取失敗後跳出 | 未設定 Redis，session 不共用 → 請安裝 Upstash Redis 並設定 `REDIS_URL` |
| timeout exceeded when trying to connect | ① 使用 Direct (5432) 應改用 Transaction (6543) ② Supabase 專案暫停中 ③ Vercel 函數逾時 |
| prepared statement does not exist | 未附加 pgbouncer=true（程式已自動處理） |
| Connection refused | 防火牆或 Supabase 專案已暫停 |
