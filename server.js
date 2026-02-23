// [Modularized] 使用 config/pool 作為單一連線池
const { pool } = require('./config/pool');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();

app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

// Session store：Vercel 環境絕不使用 connect-pg-simple（避免 Supabase 連線逾時）
// 僅在本機環境才載入並使用 pg session store
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true' || !!process.env.VERCEL;
const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
let sessionStore;

if (isVercel) {
    // Vercel：只用 Redis 或 MemoryStore，絕不連線 PostgreSQL 做 session
    if (redisUrl) {
        try {
            const { createClient } = require('redis');
            const { RedisStore } = require('connect-redis');
            const redisClient = createClient({ url: redisUrl });
            redisClient.connect().catch((e) => console.warn('Redis connect:', e?.message));
            sessionStore = new RedisStore({ client: redisClient });
        } catch (e) {
            console.warn('Redis session store init failed:', e?.message);
        }
    }
    if (!sessionStore) {
        sessionStore = undefined; // express-session 預設使用 MemoryStore
        console.warn('[Vercel] 未設定 REDIS_URL，session 使用記憶體儲存。建議安裝 Upstash Redis 以持久化 session。');
    }
} else {
    // 本機：使用 PostgreSQL session store（延遲載入，避免 Vercel 載入此模組）
    try {
        const pgSession = require('connect-pg-simple')(session);
        sessionStore = new pgSession({
            pool,
            tableName: 'session',
            createTableIfMissing: false,
            pruneSessionInterval: false
        });
    } catch (storeError) {
        console.warn('Session store initialization warning:', storeError?.message || storeError);
        sessionStore = undefined;
    }
}

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    store: sessionStore,
    secret: (() => {
        const secret = process.env.SESSION_SECRET;
        const defaultSecret = 'sms-secret-key-pg-final-v3';
        const devSecret = 'sms-secret-key-pg-final-v3-dev-only';
        
        // 生產環境必須設定 SESSION_SECRET
        if (process.env.NODE_ENV === 'production') {
            if (!secret || secret === defaultSecret || secret === devSecret) {
                console.error('===========================================');
                console.error('錯誤: 生產環境必須設定 SESSION_SECRET 環境變數！');
                console.error('請在 .env 檔案中設定一個隨機且複雜的 SESSION_SECRET');
                console.error('可以使用命令產生: openssl rand -base64 32');
                console.error('===========================================');
                throw new Error('SESSION_SECRET environment variable is required in production');
            }
            // 驗證生產環境的 SESSION_SECRET 長度（至少 32 字元）
            if (secret.length < 32) {
                console.error('警告: 生產環境的 SESSION_SECRET 長度建議至少 32 字元');
            }
        } else {
            // 開發環境警告
            if (!secret || secret === defaultSecret || secret === devSecret) {
                console.warn('警告: SESSION_SECRET 環境變數未設定或使用預設值！');
                console.warn('請在 .env 檔案中設定一個隨機且複雜的 SESSION_SECRET');
                console.warn('可以使用命令產生: openssl rand -base64 32');
            }
        }
        return secret || devSecret;
    })(),
    resave: false,
    saveUninitialized: false,
    proxy: true, 
    cookie: { 
        maxAge: 30 * 24 * 60 * 60 * 1000, 
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    } 
}));

// [Modularized] 使用 middleware 與 db helpers
const { protectHtmlPages } = require('./middleware/protect');
const { requireAuth, requireAdmin, requireAdminOrManager } = require('./middleware/auth');
const { csrfProtection, getCsrfToken, verifyCsrf } = require('./middleware/csrf');
const { loginLimiter, apiLimiter, geminiLimiter } = require('./middleware/rateLimit');
const { isAdminUser, getUserGroupIds, getUserDataGroupIds, getPrimaryGroupId, canEditByOwnership } = require('./db/helpers');
const { logAction, logError, writeToLogFile, cleanupOldLogs } = require('./utils/log');
const { handleApiError } = require('./utils/handleApiError');
const { validatePassword } = require('./utils/validation');

// 應用路由保護（在靜態檔案服務之前）
app.use(protectHtmlPages);

// 靜態檔案服務：僅使用新架構（dist 或 Vercel 的 public/app），不 fallback 至 public
const distPath = process.env.VERCEL
    ? path.join(__dirname, 'public', 'app')
    : path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
}

// 為所有 API 路由提供 CSRF token
app.use('/api/', getCsrfToken);

// 對所有 API 路由套用速率限制（除了已經有特定限制的路由）
// 注意：這個中間件必須放在 session 之後
app.use('/api/', (req, res, next) => {
    // 登入路由使用 loginLimiter，不需要再次限制
    if (req.path === '/auth/login') {
        return next();
    }
    // Gemini API 使用 geminiLimiter
    if (req.path === '/gemini') {
        return next();
    }
    // 其他 API 使用通用限制
    return apiLimiter(req, res, next);
});

// --- Database Initialization (使用 db/init.js) ---
const { initDB } = require('./db/init');

// 啟動時執行一次日誌清理，然後每天執行一次
cleanupOldLogs();
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000); // 每 24 小時執行一次

// [Modularized] 註冊所有路由（auth, misc, issues, users, admin, options, plans, schedule, templates）
require('./routes')(app, { csrfProtection });

// Vercel 上 express.static 被忽略，需手動提供 /app/* 靜態檔（React 建置輸出在 public/app/）
const appStaticPath = path.join(__dirname, 'public', 'app');
if (fs.existsSync(appStaticPath)) {
    app.get('/app/*', (req, res) => {
        const rel = req.path.replace(/^\/app\/?/, '') || 'index.html';
        const filePath = path.join(appStaticPath, rel);
        const realPath = path.resolve(filePath);
        const realApp = path.resolve(appStaticPath);
        if (realPath.startsWith(realApp) && fs.existsSync(realPath) && fs.statSync(realPath).isFile()) {
            return res.sendFile(realPath);
        }
        res.status(404).end();
    });
}
// SPA：非 API、非靜態檔的 GET 請求回傳 React index.html（不 fallback 至舊版）
const reactIndexPath = path.join(distPath, 'index.html');
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/app')) return next();
    if (fs.existsSync(reactIndexPath)) {
        return res.sendFile(reactIndexPath);
    }
    res.status(500).send('React 建置檔未找到，請先執行：npm run build');
});



// 1. 初始化資料庫 (維持異步執行)
initDB().catch(err => {
    console.error('Database initialization failed during startup:', err);
});

// 2. 判斷環境：只有在「非」生產環境（本機）才執行監聽
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`【本機模式】伺服器運行於: http://localhost:${PORT}`);
    });
}

// 3. 【最重要的修正】導出 app 給 Vercel 使用 (這行必須在最外面，不能在 function 裡面)
module.exports = app;

