const { pool } = require('../config/pool');
const { isAdminUser, getPrimaryGroupId } = require('../db/helpers');
const { requireAuth, requireAdmin, requireAdminOrManager } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { logAction } = require('../utils/log');
const { handleApiError } = require('../utils/handleApiError');

module.exports = function registerAdminRoutes(app) {
    app.get('/api/admin/logs', requireAuth, async (req, res) => {
        const isAdmin = await isAdminUser(req.session.user.id, pool);
        if(!isAdmin) return res.status(403).json({error:'Denied'});
        try {
            const { page = 1, pageSize = 50, q } = req.query;
            const limit = parseInt(pageSize);
            const offset = (parseInt(page) - 1) * limit;
            let where = ["l.action='LOGIN'"];
            let params = [];
            let idx = 1;
            if (q) {
                where.push(`(
                    COALESCE(l.username, '') LIKE $${idx} OR 
                    COALESCE(u.name, '') LIKE $${idx} OR 
                    COALESCE(l.ip_address, '') LIKE $${idx} OR 
                    COALESCE(l.details, '') LIKE $${idx} OR
                    COALESCE(CAST(l.login_time AS TEXT), '') LIKE $${idx} OR
                    COALESCE(CAST(l.created_at AS TEXT), '') LIKE $${idx}
                )`);
                params.push(`%${q}%`);
                idx++;
            }
            const whereClause = where.join(' AND ');
            const fromJoin = `logs l LEFT JOIN users u ON l.username = u.username`;
            const countQuery = `SELECT COUNT(*) FROM ${fromJoin} WHERE ${whereClause}`;
            const dataQuery = `SELECT l.*, u.name AS user_name FROM ${fromJoin} WHERE ${whereClause} ORDER BY l.login_time DESC LIMIT $${idx} OFFSET $${idx + 1}`;
            const countResult = await pool.query(countQuery, params);
            const total = parseInt(countResult.rows[0].count);
            const pages = Math.ceil(total / limit);
            params.push(limit, offset);
            const { rows } = await pool.query(dataQuery, params);
            res.json({data:rows, total, page:parseInt(page), pages});
        } catch (e) { 
            handleApiError(e, req, res, 'Get admin logs error');
        }
    });

    app.get('/api/admin/action_logs', requireAuth, requireAdmin, async (req, res) => {
        try {
            const { page = 1, pageSize = 50, q } = req.query;
            const limit = parseInt(pageSize);
            const offset = (parseInt(page) - 1) * limit;
            let where = ["l.action!='LOGIN'"];
            let params = [];
            let idx = 1;
            if (q) {
                where.push(`(
                    COALESCE(l.username, '') LIKE $${idx} OR 
                    COALESCE(u.name, '') LIKE $${idx} OR 
                    COALESCE(l.action, '') LIKE $${idx} OR 
                    COALESCE(l.details, '') LIKE $${idx} OR
                    COALESCE(l.ip_address, '') LIKE $${idx} OR
                    COALESCE(CAST(l.created_at AS TEXT), '') LIKE $${idx}
                )`);
                params.push(`%${q}%`);
                idx++;
            }
            const whereClause = where.join(' AND ');
            const fromJoin = `logs l LEFT JOIN users u ON l.username = u.username`;
            const countQuery = `SELECT COUNT(*) FROM ${fromJoin} WHERE ${whereClause}`;
            const dataQuery = `SELECT l.*, u.name AS user_name FROM ${fromJoin} WHERE ${whereClause} ORDER BY l.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
            const countResult = await pool.query(countQuery, params);
            const total = parseInt(countResult.rows[0].count);
            const pages = Math.ceil(total / limit);
            params.push(limit, offset);
            const { rows } = await pool.query(dataQuery, params);
            res.json({data:rows, total, page:parseInt(page), pages});
        } catch (e) { 
            handleApiError(e, req, res, 'Get admin logs error');
        }
    });

    app.delete('/api/admin/logs', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        await pool.query("DELETE FROM logs WHERE action='LOGIN'");
        res.json({success:true});
    });

    app.delete('/api/admin/action_logs', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        await pool.query("DELETE FROM logs WHERE action!='LOGIN'");
        res.json({success:true});
    });

    app.post('/api/admin/logs/cleanup', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        try {
            const { days } = req.body;
            if (!days || days < 1) {
                return res.status(400).json({error:'請提供有效的保留天數（至少1天）'});
            }
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
            const result = await pool.query(
                "DELETE FROM logs WHERE action='LOGIN' AND login_time < $1",
                [cutoffDate]
            );
            logAction(req.session.user.username, 'CLEANUP_LOGS', `清除 ${days} 天前的登入紀錄，刪除 ${result.rowCount} 筆`, req);
            res.json({success:true, deleted: result.rowCount});
        } catch (e) {
            handleApiError(e, req, res, 'Cleanup logs error');
        }
    });

    app.post('/api/admin/action_logs/cleanup', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
        try {
            const { days } = req.body;
            if (!days || days < 1) {
                return res.status(400).json({error:'請提供有效的保留天數（至少1天）'});
            }
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
            const result = await pool.query(
                "DELETE FROM logs WHERE action!='LOGIN' AND created_at < $1",
                [cutoffDate]
            );
            logAction(req.session.user.username, 'CLEANUP_ACTION_LOGS', `清除 ${days} 天前的操作紀錄，刪除 ${result.rowCount} 筆`, req);
            res.json({success:true, deleted: result.rowCount});
        } catch (e) {
            handleApiError(e, req, res, 'Cleanup logs error');
        }
    });

    app.post('/api/admin/system-import', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        let { issues, plans, users, importUsers } = req.body;
        if (Array.isArray(req.body) && !issues && !plans && !users) {
            issues = req.body;
        }
        const results = { plans: { success: 0, failed: 0, skipped: 0 }, issues: { success: 0, failed: 0, skipped: 0 }, users: { success: 0, failed: 0 } };
        let client = null;
        try {
            client = await pool.connect();
            const ownerGroupId = await getPrimaryGroupId(req.session.user.id, client);
            if (!ownerGroupId) return res.status(400).json({ error: '請先將帳號加入至少一個資料群組' });
            const ownerUserId = req.session.user.id;

            if (plans && Array.isArray(plans) && plans.length > 0) {
                const seen = new Set();
                for (const row of plans) {
                    const name = String(row.plan_name || row.name || row.planName || '').trim();
                    let year = String(row.year || '').replace(/\D/g, '').slice(-3).padStart(3, '0');
                    const railway = String(row.railway || '').toUpperCase() || 'T';
                    const inspection_type = String(row.inspection_type || row.inspectionType || '1');
                    const business = row.business ? String(row.business).toUpperCase() : null;
                    const planned_count = row.planned_count != null ? parseInt(row.planned_count, 10) : null;
                    const start_date = (row.start_date || '').trim() || null;
                    const end_date = (row.end_date || '').trim() || null;
                    const plan_type = (row.plan_type || '').trim() || null;
                    const location = (row.location || '').trim() || null;
                    const inspector = (row.inspector || '').trim() || null;
                    if (!name || !/^\d{3}$/.test(year)) { results.plans.skipped++; continue; }
                    const key = `${name}|||${year}`;
                    if (seen.has(key)) { results.plans.skipped++; continue; }
                    seen.add(key);
                    try {
                        const ex = await client.query("SELECT 1 FROM inspection_plan_schedule WHERE plan_name = $1 AND year = $2 LIMIT 1", [name, year]);
                        if (ex.rows.length > 0) { results.plans.skipped++; continue; }
                        await client.query(
                            `INSERT INTO inspection_plan_schedule (start_date, end_date, plan_name, year, railway, inspection_type, business, inspection_seq, plan_number, planned_count, plan_type, location, inspector, owner_group_id, owner_group_ids, owner_user_id, edit_mode)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, '00', '(手動)', $8, $9, $10, $11, $12, $13, $14, $15, 'GROUP')`,
                            [start_date, end_date, name, year, railway, inspection_type, business, planned_count, plan_type, location, inspector, ownerGroupId, [ownerGroupId], ownerUserId]
                        );
                        results.plans.success++;
                    } catch (e) {
                        results.plans.failed++;
                    }
                }
            }

            if (issues && Array.isArray(issues) && issues.length > 0) {
                const issueCols = ['number', 'year', 'unit', 'content', 'status', 'item_kind_code', 'division_name', 'inspection_category_name', 'plan_name', 'issue_date', 'handling', 'review', 'reply_date_r1', 'response_date_r1', 'owner_group_id', 'owner_group_ids', 'owner_user_id', 'edit_mode'];
                for (let r = 2; r <= 30; r++) {
                    issueCols.push(`handling${r}`, `review${r}`, `reply_date_r${r}`, `response_date_r${r}`);
                }
                for (const row of issues) {
                    const number = (row.number || '').trim();
                    if (!number) { results.issues.skipped++; continue; }
                    const get = (obj, ...keys) => {
                        for (const k of keys) {
                            const v = obj[k];
                            if (v !== undefined && v !== null && v !== '') return v;
                        }
                        return null;
                    };
                    const vals = [
                        number,
                        get(row, 'year') || null,
                        get(row, 'unit') || null,
                        get(row, 'content') || '',
                        get(row, 'status') || '持續列管',
                        get(row, 'item_kind_code', 'itemKindCode') || null,
                        get(row, 'division_name', 'divisionName') || null,
                        get(row, 'inspection_category_name', 'inspectionCategoryName') || null,
                        get(row, 'plan_name', 'planName') || null,
                        get(row, 'issue_date', 'issueDate') || null,
                        get(row, 'handling') || '',
                        get(row, 'review') || '',
                        get(row, 'reply_date_r1', 'replyDate') || '',
                        get(row, 'response_date_r1', 'responseDate') || '',
                        ownerGroupId,
                        [ownerGroupId],
                        ownerUserId,
                        'GROUP'
                    ];
                    for (let rn = 2; rn <= 30; rn++) {
                        vals.push(get(row, `handling${rn}`) || '', get(row, `review${rn}`) || '', get(row, `reply_date_r${rn}`) || '', get(row, `response_date_r${rn}`) || '');
                    }
                    try {
                        const ex = await client.query("SELECT 1 FROM issues WHERE TRIM(number) = $1 LIMIT 1", [number]);
                        if (ex.rows.length > 0) { results.issues.skipped++; continue; }
                        const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
                        await client.query(
                            `INSERT INTO issues (${issueCols.join(', ')}) VALUES (${ph})`,
                            vals
                        );
                        results.issues.success++;
                    } catch (e) {
                        results.issues.failed++;
                    }
                }
            }

            const isAdmin = await isAdminUser(req.session.user.id, client);
            if (importUsers === true && isAdmin && users && Array.isArray(users) && users.length > 0) {
                const bcrypt = require('bcryptjs');
                const validRoles = ['manager', 'viewer'];
                for (const row of users) {
                    const name = String(row.name || '').trim();
                    const username = String(row.username || '').trim();
                    const role = String(row.role || 'viewer').toLowerCase();
                    const safeRole = role === 'admin' ? 'manager' : (validRoles.includes(role) ? role : 'viewer');
                    if (!name || !username) { results.users.failed++; continue; }
                    try {
                        const ex = await client.query("SELECT id FROM users WHERE username = $1", [username]);
                        const pwd = row.password ? bcrypt.hashSync(row.password, 10) : bcrypt.hashSync('Aa123456', 10);
                        if (ex.rows.length > 0) {
                            await client.query("UPDATE users SET name=$1, role=$2, password=$3, must_change_password=$4 WHERE username=$5", [name, safeRole, pwd, true, username]);
                        } else {
                            await client.query("INSERT INTO users (name, username, role, password, must_change_password) VALUES ($1, $2, $3, $4, $5)", [name, username, safeRole, pwd, true]);
                        }
                        results.users.success++;
                    } catch (e) {
                        results.users.failed++;
                    }
                }
            }

            logAction(req.session.user.username, 'SYSTEM_IMPORT', `系統匯入：計畫 ${results.plans.success}，事項 ${results.issues.success}${importUsers ? `，帳號 ${results.users.success}` : ''}`, req);
            res.json({ success: true, results });
        } catch (e) {
            handleApiError(e, req, res, 'System import error');
        } finally {
            if (client) try { client.release(); } catch (_) {}
        }
    });
};
