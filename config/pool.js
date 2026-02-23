// [Added] Force Node.js to prefer IPv4 resolution to solve ENETUNREACH issues on some platforms (like Render + Supabase)
require('dns').setDefaultResultOrder('ipv4first');

const { Pool } = require('pg');

// SSL 設定：
// - 預設允許自簽憑證（適用於 Render、Heroku、Vercel、Supabase 等雲端平台）
// - 可透過 DB_SSL_REJECT_UNAUTHORIZED=true 強制要求有效憑證
// - 可透過 DB_SSL_REJECT_UNAUTHORIZED=false 明確允許自簽憑證
const sslConfig = (() => {
    if (process.env.DB_SSL_REJECT_UNAUTHORIZED !== undefined) {
        return { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' };
    }
    return { rejectUnauthorized: false };
})();

// 主應用程式連線池
// Vercel serverless：必須使用 Supabase Transaction Mode (port 6543) 連線字串
// Supabase Dashboard → Connect → Transaction mode
const isVercel = !!process.env.VERCEL;
const rawUrl = process.env.DATABASE_URL;
// Vercel：可選用 DATABASE_POOLER_URL（Transaction mode），若未設則用 DATABASE_URL
const connectionString = (isVercel && process.env.DATABASE_POOLER_URL)
    ? process.env.DATABASE_POOLER_URL
    : rawUrl;
// Transaction mode (port 6543) 不支援 prepared statements，附加 pgbouncer=true
const finalUrl = connectionString && connectionString.includes(':6543')
    ? (connectionString.includes('?') ? `${connectionString}&pgbouncer=true` : `${connectionString}?pgbouncer=true`)
    : connectionString;

const pool = new Pool({
    connectionString: finalUrl,
    ssl: connectionString ? sslConfig : false,
    max: isVercel ? 1 : 2, // Vercel serverless 建議 1，避免連線累積
    idleTimeoutMillis: isVercel ? 10000 : 5000,
    connectionTimeoutMillis: isVercel ? 25000 : 2000, // Vercel cold start 需較長逾時（25 秒）
    allowExitOnIdle: false,
});

// 資料庫連線錯誤處理（使用 console 避免 circular dependency with logError）
pool.on('error', (err) => {
    if (err.message && err.message.includes('MaxClientsInSessionMode')) {
        console.warn('Supabase 連線池已滿，請等待連線釋放或考慮使用 Transaction Mode (port 6543)');
    } else if (err.message && err.message.includes('Connection terminated')) {
        console.warn('資料庫連線終止（可能是暫時的）:', err.message);
    } else {
        console.error('資料庫連線錯誤:', err?.message || err);
    }
});

module.exports = { pool };
