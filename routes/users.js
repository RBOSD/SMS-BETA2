const bcrypt = require('bcryptjs');
const { pool } = require('../config/pool');
const { isAdminUser } = require('../db/helpers');
const { requireAuth, requireAdmin, requireAdminOrManager } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { logAction, logError } = require('../utils/log');
const { validatePassword } = require('../utils/validation');
const { handleApiError } = require('../utils/handleApiError');

module.exports = function registerUsersRoutes(app) {
    app.get('/api/groups', requireAuth, requireAdminOrManager, async (req, res) => {
        try {
            const r = await pool.query("SELECT id, name, is_admin_group, COALESCE(allow_all_edit, false) AS allow_all_edit FROM groups ORDER BY is_admin_group DESC, name ASC, id ASC");
            res.json({ data: r.rows || [] });
        } catch (e) {
            handleApiError(e, req, res, 'Get groups error');
        }
    });

    app.get('/api/users/lookup', requireAuth, requireAdminOrManager, async (req, res) => {
        try {
            const q = String(req.query.q || '').trim();
            let limit = parseInt(req.query.limit || '500', 10);
            if (!Number.isFinite(limit) || limit <= 0) limit = 500;
            if (limit > 5000) limit = 5000;

            const where = [];
            const params = [];
            let idx = 1;
            if (q) {
                where.push(`(u.username ILIKE $${idx} OR u.name ILIKE $${idx})`);
                params.push(`%${q}%`);
                idx++;
            }
            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

            const r = await pool.query(
                `SELECT u.id, u.username, u.name, u.role,
                        COALESCE(BOOL_OR(g.is_admin_group = true), false) AS is_admin
                 FROM users u
                 LEFT JOIN user_groups ug ON ug.user_id = u.id
                 LEFT JOIN groups g ON g.id = ug.group_id
                 ${whereSql}
                 GROUP BY u.id
                 ORDER BY COALESCE(BOOL_OR(g.is_admin_group = true), false) DESC, u.role ASC, u.username ASC
                 LIMIT $${idx}`,
                [...params, limit]
            );
            const data = (r.rows || []).map(u => ({
                id: u.id,
                username: u.username,
                name: u.name,
                role: u.role,
                isAdmin: u.is_admin === true
            }));
            res.json({ data });
        } catch (e) {
            handleApiError(e, req, res, 'User lookup error');
        }
    });

    app.post('/api/groups', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        const name = String(req.body?.name || '').trim();
        const allowAllEdit = req.body?.allow_all_edit === true || req.body?.allowAllEdit === true;
        if (!name) return res.status(400).json({ error: '群組名稱為必填' });
        try {
            const r = await pool.query("INSERT INTO groups (name, allow_all_edit) VALUES ($1, $2) RETURNING id, name, allow_all_edit", [name, allowAllEdit]);
            logAction(req.session.user.username, 'CREATE_GROUP', `新增群組：${name}`, req).catch(() => {});
            res.json({ success: true, group: r.rows[0] });
        } catch (e) {
            handleApiError(e, req, res, 'Create group error');
        }
    });

    app.put('/api/groups/:id', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const name = String(req.body?.name || '').trim();
        const allowAllEdit = req.body?.allow_all_edit === true || req.body?.allowAllEdit === true;
        if (!id) return res.status(400).json({ error: 'Invalid id' });
        if (!name) return res.status(400).json({ error: '群組名稱為必填' });
        try {
            await pool.query("UPDATE groups SET name = $1, allow_all_edit = $2 WHERE id = $3", [name, allowAllEdit, id]);
            logAction(req.session.user.username, 'UPDATE_GROUP', `更新群組：ID ${id} → ${name}`, req).catch(() => {});
            res.json({ success: true });
        } catch (e) {
            handleApiError(e, req, res, 'Update group error');
        }
    });

    app.delete('/api/groups/:id', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ error: 'Invalid id' });
        try {
            const gRes = await pool.query("SELECT id, name, is_admin_group FROM groups WHERE id = $1", [id]);
            if (gRes.rows.length === 0) return res.status(404).json({ error: '群組不存在' });
            const g = gRes.rows[0];
            if (g.is_admin_group === true) return res.status(400).json({ error: '無法刪除系統管理群組' });
            const issueRef = await pool.query(
                "SELECT 1 FROM issues WHERE owner_group_id = $1 OR $1 = ANY(COALESCE(owner_group_ids, ARRAY[]::INTEGER[])) LIMIT 1",
                [id]
            );
            if (issueRef.rows.length > 0) return res.status(400).json({ error: '此群組已被開立事項使用，無法刪除' });
            const planRef = await pool.query(
                "SELECT 1 FROM inspection_plan_schedule WHERE owner_group_id = $1 OR $1 = ANY(COALESCE(owner_group_ids, ARRAY[]::INTEGER[])) LIMIT 1",
                [id]
            );
            if (planRef.rows.length > 0) return res.status(400).json({ error: '此群組已被檢查計畫使用，無法刪除' });
            await pool.query("DELETE FROM groups WHERE id = $1", [id]);
            logAction(req.session.user.username, 'DELETE_GROUP', `刪除群組：${g.name} (ID ${id})`, req).catch(() => {});
            res.json({ success: true });
        } catch (e) {
            handleApiError(e, req, res, 'Delete group error');
        }
    });

    app.post('/api/admin/users/:id/reset-password', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        const id = parseInt(req.params.id, 10);
        if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id' });
        const defaultPassword = 'Aa123456';
        try {
            const uRes = await pool.query("SELECT id, username, name FROM users WHERE id = $1", [id]);
            if (uRes.rows.length === 0) return res.status(404).json({ error: '找不到該使用者' });
            const hash = bcrypt.hashSync(defaultPassword, 10);
            await pool.query("UPDATE users SET password = $1, must_change_password = $2 WHERE id = $3", [hash, true, id]);
            logAction(req.session.user.username, 'RESET_PASSWORD', `管理員重置密碼為初始密碼：${uRes.rows[0].username}`, req).catch(() => {});
            res.json({ success: true });
        } catch (e) {
            handleApiError(e, req, res, 'Reset password error');
        }
    });

    app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
        const { page=1, pageSize=20, q, sortField='id', sortDir='asc' } = req.query;
        const limit = parseInt(pageSize);
        const offset = (page-1)*limit;
        let where = ["1=1"], params = [], idx = 1;
        if(q) { where.push(`(u.username LIKE $${idx} OR u.name LIKE $${idx})`); params.push(`%${q}%`); idx++; }
        const safeSortFields = ['id', 'username', 'name', 'role', 'created_at'];
        const safeField = safeSortFields.includes(sortField) ? sortField : 'id';
        const order = `u.${safeField} ${sortDir==='desc'?'DESC':'ASC'}`;
        try {
            const cRes = await pool.query(`SELECT count(*) FROM users u WHERE ${where.join(" AND ")}`, params);
            const total = parseInt(cRes.rows[0].count);
            const dRes = await pool.query(
                `SELECT u.id, u.username, u.name, u.role, u.created_at, u.is_disabled,
                        COALESCE(array_agg(ug.group_id) FILTER (WHERE ug.group_id IS NOT NULL), '{}') AS group_ids,
                        COALESCE(BOOL_OR(g.is_admin_group = true), false) AS is_admin
                 FROM users u
                 LEFT JOIN user_groups ug ON ug.user_id = u.id
                 LEFT JOIN groups g ON g.id = ug.group_id
                 WHERE ${where.join(" AND ")}
                 GROUP BY u.id
                 ORDER BY ${order}
                 LIMIT $${idx} OFFSET $${idx+1}`,
                [...params, limit, offset]
            );
            const users = (dRes.rows || []).map(u => ({
                id: u.id,
                username: u.username,
                name: u.name,
                role: u.role,
                isAdmin: u.is_admin === true,
                isDisabled: u.is_disabled === true,
                created_at: u.created_at,
                groupIds: Array.isArray(u.group_ids) ? u.group_ids.map(x => parseInt(x, 10)).filter(n => Number.isFinite(n)) : []
            }));
            res.json({data: users, total, page: parseInt(page), pages: Math.ceil(total/limit)});
        } catch (e) { 
            handleApiError(e, req, res, 'Get users error');
        }
    });

    app.post('/api/users', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        const { username, password, name, role, groupIds } = req.body;
        const safeRoleRaw = String(role || '').toLowerCase();
        const safeRole = safeRoleRaw === 'admin' ? 'manager' : (['manager', 'viewer'].includes(safeRoleRaw) ? safeRoleRaw : 'viewer');
        const gids = Array.isArray(groupIds)
            ? groupIds.map(x => parseInt(x, 10)).filter(n => Number.isFinite(n))
            : null;
        try {
            if (!username) return res.status(400).json({error: 'Username required'});
            // 密碼選填：未填則使用預設密碼 Aa123456，使用者首次登入後須自行更改
            const effectivePassword = (password && String(password).trim()) ? password : 'Aa123456';
            const passwordValidation = validatePassword(effectivePassword);
            if (!passwordValidation.valid) {
                return res.status(400).json({ error: passwordValidation.message });
            }
            const hash = bcrypt.hashSync(effectivePassword, 10);
            const ins = await pool.query(
                "INSERT INTO users (username, password, name, role, must_change_password) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                [username, hash, name, safeRole, true]
            );
            const newId = ins.rows[0]?.id;
            if (newId && gids) {
                const gRows = await pool.query("SELECT id FROM groups WHERE id = ANY($1)", [gids]);
                const allowedIds = new Set((gRows.rows || []).map(r => parseInt(r.id, 10)));
                for (const gid of gids) {
                    if (!allowedIds.has(gid)) continue;
                    await pool.query(
                        "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                        [newId, gid]
                    );
                }
            }
            logAction(req.session.user.username, 'CREATE_USER', `新增使用者：${name} (${username})，權限：${safeRole}`, req);
            res.json({success:true});
        } catch (e) { 
            handleApiError(e, req, res, 'Create user error');
        }
    });

    app.put('/api/users/:id', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        const { name, username, password, role, groupIds } = req.body;
        const id = parseInt(req.params.id, 10);
        const safeRoleRaw = String(role || '').toLowerCase();
        const safeRole = safeRoleRaw === 'admin' ? 'manager' : (['manager', 'viewer'].includes(safeRoleRaw) ? safeRoleRaw : 'viewer');
        const gids = Array.isArray(groupIds)
            ? groupIds.map(x => parseInt(x, 10)).filter(n => Number.isFinite(n))
            : null;
        try {
            const userRes = await pool.query("SELECT username, name FROM users WHERE id=$1", [id]);
            const targetUser = userRes.rows[0];
            const targetUsername = targetUser ? targetUser.username : `ID:${id}`;
            const targetName = targetUser ? targetUser.name : '未知';
            
            const newUsername = (typeof username === 'string' && username.trim()) ? username.trim() : null;
            if (newUsername) {
                const dupRes = await pool.query("SELECT id FROM users WHERE username = $1 AND id != $2", [newUsername, id]);
                if (dupRes.rows.length > 0) return res.status(400).json({ error: '此帳號已被其他使用者使用' });
            }
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                if (password) {
                    const passwordValidation = validatePassword(password);
                    if (!passwordValidation.valid) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: passwordValidation.message });
                    }
                    const hash = bcrypt.hashSync(password, 10);
                    if (newUsername) {
                        await client.query("UPDATE users SET username=$1, name=$2, role=$3, password=$4, must_change_password=$5 WHERE id=$6", [newUsername, name, safeRole, hash, true, id]);
                    } else {
                        await client.query("UPDATE users SET name=$1, role=$2, password=$3, must_change_password=$4 WHERE id=$5", [name, safeRole, hash, true, id]);
                    }
                    logAction(req.session.user.username, 'UPDATE_USER', `修改使用者：${targetName} (${targetUsername})，已更新姓名、權限和密碼`, req);
                } else {
                    if (newUsername) {
                        await client.query("UPDATE users SET username=$1, name=$2, role=$3 WHERE id=$4", [newUsername, name, safeRole, id]);
                    } else {
                        await client.query("UPDATE users SET name=$1, role=$2 WHERE id=$3", [name, safeRole, id]);
                    }
                    logAction(req.session.user.username, 'UPDATE_USER', `修改使用者：${targetName} (${targetUsername})，已更新姓名和權限`, req);
                }

                if (gids !== null) {
                    await client.query("DELETE FROM user_groups WHERE user_id = $1", [id]);
                    if (gids.length > 0) {
                        const gRows = await client.query("SELECT id FROM groups WHERE id = ANY($1)", [gids]);
                        const allowedIds = new Set((gRows.rows || []).map(r => parseInt(r.id, 10)));
                        for (const gid of gids) {
                            if (!allowedIds.has(gid)) continue;
                            await client.query(
                                "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                                [id, gid]
                            );
                        }
                    }
                }
                await client.query('COMMIT');
            } catch (e) {
                try { await client.query('ROLLBACK'); } catch (_) {}
                throw e;
            } finally {
                client.release();
            }
            res.json({success:true});
        } catch (e) { 
            handleApiError(e, req, res, 'Update user error');
        }
    });

    app.patch('/api/users/:id/disable', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        const id = parseInt(req.params.id, 10);
        if (id === req.session.user.id) return res.status(400).json({ error: '無法停用自己的帳號' });
        if (!id || !Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id' });
        try {
            const uRes = await pool.query("SELECT username, name, is_disabled FROM users WHERE id=$1", [id]);
            if (uRes.rows.length === 0) return res.status(404).json({ error: '找不到該使用者' });
            const target = uRes.rows[0];
            const newDisabled = !(target.is_disabled === true);
            await pool.query("UPDATE users SET is_disabled = $1 WHERE id = $2", [newDisabled, id]);
            logAction(req.session.user.username, newDisabled ? 'DISABLE_USER' : 'ENABLE_USER',
                `${newDisabled ? '停用' : '啟用'}使用者：${target.name} (${target.username})`, req);
            res.json({ success: true, isDisabled: newDisabled });
        } catch (e) {
            handleApiError(e, req, res, 'Toggle user disable error');
        }
    });

    app.delete('/api/users/:id', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        if(parseInt(req.params.id) === req.session.user.id) return res.status(400).json({error:'Cannot self delete'});
        try {
            const userRes = await pool.query("SELECT username, name FROM users WHERE id=$1", [req.params.id]);
            const targetUser = userRes.rows[0];
            const targetUsername = targetUser ? targetUser.username : `ID:${req.params.id}`;
            const targetName = targetUser ? targetUser.name : '未知';
            
            await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);
            logAction(req.session.user.username, 'DELETE_USER', `刪除使用者：${targetName} (${targetUsername})`, req);
            res.json({success:true});
        } catch (e) { 
            handleApiError(e, req, res, 'Delete user error');
        }
    });

    app.post('/api/users/import', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        const { data } = req.body;
        if (!data || !Array.isArray(data)) return res.status(400).json({error: '無效的資料格式'});
        
        const results = { success: 0, failed: 0, errors: [] };
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const { name, username, role, password } = row;
            
            if (!name || !username || !role) {
                results.failed++;
                results.errors.push(`第 ${i + 2} 行：姓名、帳號和權限為必填`);
                continue;
            }
            
            const validRoles = ['manager', 'viewer', 'admin'];
            const roleLower = String(role || '').toLowerCase();
            if (!validRoles.includes(roleLower)) {
                results.failed++;
                results.errors.push(`第 ${i + 2} 行（${name}）：無效的權限值 "${role}"，應為：${validRoles.join(', ')}`);
                continue;
            }
            const safeRole = roleLower === 'admin' ? 'manager' : roleLower;
            
            try {
                const checkRes = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
                const exists = checkRes.rows.length > 0;
                
                if (exists) {
                    if (password) {
                        const passwordValidation = validatePassword(password);
                        if (!passwordValidation.valid) {
                            results.failed++;
                            results.errors.push(`第 ${i + 2} 行（${name}）：${passwordValidation.message}`);
                            continue;
                        }
                        const hash = bcrypt.hashSync(password, 10);
                        await pool.query(
                            "UPDATE users SET name=$1, role=$2, password=$3, must_change_password=$4 WHERE username=$5",
                            [name, safeRole, hash, true, username]
                        );
                    } else {
                        await pool.query(
                            "UPDATE users SET name=$1, role=$2 WHERE username=$3",
                            [name, safeRole, username]
                        );
                    }
                    results.success++;
                } else {
                    let hash;
                    if (password) {
                        const passwordValidation = validatePassword(password);
                        if (!passwordValidation.valid) {
                            results.failed++;
                            results.errors.push(`第 ${i + 2} 行（${name}）：${passwordValidation.message}`);
                            continue;
                        }
                        hash = bcrypt.hashSync(password, 10);
                    } else {
                        hash = bcrypt.hashSync('Aa123456', 10);
                    }
                    
                    await pool.query(
                        "INSERT INTO users (name, username, role, password, must_change_password) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                        [name, username, safeRole, hash, true]
                    );
                    results.success++;
                }
            } catch (e) {
                results.failed++;
                results.errors.push(`第 ${i + 2} 行（${name}）：${e.message}`);
                logError(e, `Import user error - row ${i + 2}`, req).catch(() => {});
            }
        }
        
        if (results.success > 0) {
            logAction(req.session.user.username, 'IMPORT_USERS', `匯入帳號：成功 ${results.success} 筆，失敗 ${results.failed} 筆`, req);
        }
        
        res.json({
            success: true,
            successCount: results.success,
            failed: results.failed,
            errors: results.errors
        });
    });
};
