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

// 主應用程式連線池（Supabase 使用 Supavisor/PgBouncer，Session Mode 連線數受限）
// Supabase 免費方案：直接連線 60，Pooler 200，但 Session Mode 的 pool_size 通常較小
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? sslConfig : false,
    max: 2, // Supabase Session Mode 建議使用較小的連線池（2-3 個）
    idleTimeoutMillis: 5000, // 快速釋放未使用的連線（5 秒）
    connectionTimeoutMillis: 2000, // 快速超時，避免等待
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
