const bcrypt = require('bcryptjs');
const { pool } = require('../config/pool');
const { isAdminUser } = require('../db/helpers');
const { requireAuth, requireAdmin, requireAdminOrManager } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { loginLimiter } = require('../middleware/rateLimit');
const { logAction, logError } = require('../utils/log');
const { validatePassword } = require('../utils/validation');
const { handleApiError } = require('../utils/handleApiError');

module.exports = function registerAuthRoutes(app) {
    app.post('/api/auth/login', loginLimiter, async (req, res) => {
        const { username, password } = req.body;
        try {
            const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
            const user = result.rows[0];
            
            if (!user || !user.password) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            if (user.is_disabled === true) {
                return res.status(401).json({ error: '此帳號已停用，請聯繫管理員' });
            }

            if (bcrypt.compareSync(password, user.password)) {
                const isAdmin = await isAdminUser(user.id, pool);
                req.session.user = { id: user.id, username: user.username, role: user.role, name: user.name, isAdmin };
                req.session.save((err) => {
                    if(err) {
                        console.error("Session save error:", err);
                        return res.status(500).json({error: 'Session error'});
                    }
                    logAction(user.username, 'LOGIN', 'User logged in', req).catch(()=>{});
                    const mustChangePassword = user.must_change_password === true || user.must_change_password === null;
                    res.json({ 
                        success: true, 
                        user: req.session.user,
                        mustChangePassword: mustChangePassword
                    });
                });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        } catch (e) {
            console.error("Login Error:", e);
            logError(e, 'Login error', req).catch(() => {});
            const msg = e?.message || String(e);
            const isTimeout = msg.includes('timeout') || msg.includes('ETIMEDOUT');
            const isConn = msg.includes('connect') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND');
            const errMsg = isTimeout || isConn
                ? '資料庫連線逾時或失敗，請確認 Supabase 專案未暫停且 DATABASE_URL 使用 port 6543。詳見 docs/VERCEL_SUPABASE.md'
                : 'System error';
            res.status(500).json({ error: errMsg });
        }
    });

    app.post('/api/auth/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) return res.status(500).json({ error: 'Logout failed' });
            res.clearCookie('connect.sid'); 
            res.json({ success: true });
        });
    });

    app.get('/api/auth/me', async (req, res) => {
        if (req.session && req.session.user) {
            try {
                const result = await pool.query(
                    `SELECT u.id, u.username, u.name, u.role, u.is_disabled,
                            COALESCE(array_agg(ug.group_id) FILTER (WHERE ug.group_id IS NOT NULL), '{}') AS group_ids,
                            COALESCE(BOOL_OR(g.is_admin_group = true), false) AS is_admin
                     FROM users u
                     LEFT JOIN user_groups ug ON ug.user_id = u.id
                     LEFT JOIN groups g ON g.id = ug.group_id
                     WHERE u.id = $1
                     GROUP BY u.id`,
                    [req.session.user.id]
                );
                const latestUser = result.rows[0];

                if (!latestUser) {
                    req.session.destroy();
                    return res.json({ isLogin: false });
                }
                if (latestUser.is_disabled === true) {
                    req.session.destroy();
                    return res.json({ isLogin: false });
                }
                const isAdmin = latestUser.is_admin === true;
                req.session.user = { id: latestUser.id, username: latestUser.username, role: latestUser.role, name: latestUser.name, isAdmin };
                res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
                const groupIds = Array.isArray(latestUser.group_ids)
                    ? latestUser.group_ids.map(x => parseInt(x, 10)).filter(n => Number.isFinite(n))
                    : [];
                let aiEnabled = true;
                try {
                    const setRes = await pool.query("SELECT value FROM system_settings WHERE key = 'ai_enabled'");
                    const val = setRes.rows[0]?.value;
                    aiEnabled = val === 'true' || val === '1';
                } catch (_) {}
                res.json({ isLogin: true, id: latestUser.id, username: latestUser.username, name: latestUser.name, role: latestUser.role, isAdmin, groupIds, aiEnabled });
            } catch (e) {
                console.error("Auth check db error:", e);
                res.json({ isLogin: false });
            }
        } else {
            res.json({ isLogin: false });
        }
    });

    app.put('/api/auth/profile', requireAuth, verifyCsrf, async (req, res) => {
        const { name, password } = req.body;
        const id = req.session.user.id;
        try {
            if (password) {
                const passwordValidation = validatePassword(password);
                if (!passwordValidation.valid) {
                    return res.status(400).json({ error: passwordValidation.message });
                }
                const hash = bcrypt.hashSync(password, 10);
                await pool.query("UPDATE users SET name = $1, password = $2, must_change_password = $3 WHERE id = $4", [name, hash, false, id]);
                logAction(req.session.user.username, 'UPDATE_PROFILE', `更新個人資料：已更新姓名為「${name}」並變更密碼`, req);
            } else {
                await pool.query("UPDATE users SET name = $1 WHERE id = $2", [name, id]);
                logAction(req.session.user.username, 'UPDATE_PROFILE', `更新個人資料：已更新姓名為「${name}」`, req);
            }
            res.json({ success: true });
        } catch (e) { 
            logError(e, 'Update profile error', req).catch(() => {});
            res.status(500).json({ error: e.message }); 
        }
    });

    app.post('/api/auth/change-password', requireAuth, verifyCsrf, async (req, res) => {
        const { password } = req.body;
        const id = req.session.user.id;
        try {
            if (!password) {
                return res.status(400).json({ error: '密碼為必填項目' });
            }
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                return res.status(400).json({ error: passwordValidation.message });
            }
            const hash = bcrypt.hashSync(password, 10);
            await pool.query("UPDATE users SET password = $1, must_change_password = $2 WHERE id = $3", [hash, false, id]);
            logAction(req.session.user.username, 'CHANGE_PASSWORD', 'User changed password (first login)', req).catch(()=>{});
            res.json({ success: true });
        } catch (e) {
            handleApiError(e, req, res, 'Change password error');
        }
    });
};
