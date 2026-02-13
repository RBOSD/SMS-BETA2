# SMS 系統部署說明

## 環境需求

- Node.js >= 18.0.0
- PostgreSQL 資料庫
- （選用）Gemini API 金鑰

## 部署步驟

### 1. 取得程式碼

```bash
git clone <repository-url>
cd SMS-BETA
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 設定環境變數

建立 `.env` 檔案：

```env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
SESSION_SECRET=<至少 32 字元的隨機字串>
NODE_ENV=production
```

產生 SESSION_SECRET：

```bash
openssl rand -base64 32
```

若使用 AI 審查功能：

```env
GEMINI_API_KEY=your-gemini-api-key
```

### 4. 建置前端

```bash
npm run build
```

建置完成後，靜態檔案會輸出至 `dist/` 目錄。

### 5. 啟動服務

```bash
npm start
```

或使用 PM2：

```bash
pm2 start server.js --name sms-system
```

### 6. 反向代理（Nginx 範例）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Vercel 部署

若使用 Vercel，請參考 `vercel.json` 設定。需注意：

- 後端 API 需部署至支援 Node.js 的環境
- 資料庫連線需可從 Vercel 存取
- 環境變數在 Vercel 專案設定中填入

## 常見問題

### 建置失敗：xlsx 無法解析

執行 `npm install` 確保所有依賴已安裝。

### 登入後導向失敗

確認 `SESSION_SECRET` 已正確設定，且生產環境使用 HTTPS。

### 資料庫連線逾時

檢查 `DATABASE_URL` 格式，以及防火牆是否允許連線至資料庫主機。
