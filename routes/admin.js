const { pool } = require('../config/pool');
const { isAdminUser } = require('../db/helpers');
const { requireAuth, requireAdmin } = require('../middleware/auth');
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
            let where = ["action='LOGIN'"];
            let params = [];
            let idx = 1;
            if (q) {
                where.push(`(
                    COALESCE(username, '') LIKE $${idx} OR 
                    COALESCE(ip_address, '') LIKE $${idx} OR 
                    COALESCE(details, '') LIKE $${idx} OR
                    COALESCE(CAST(login_time AS TEXT), '') LIKE $${idx} OR
                    COALESCE(CAST(created_at AS TEXT), '') LIKE $${idx}
                )`);
                params.push(`%${q}%`);
                idx++;
            }
            const whereClause = where.join(' AND ');
            const countQuery = `SELECT COUNT(*) FROM logs WHERE ${whereClause}`;
            const dataQuery = `SELECT * FROM logs WHERE ${whereClause} ORDER BY login_time DESC LIMIT $${idx} OFFSET $${idx + 1}`;
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
            let where = ["action!='LOGIN'"];
            let params = [];
            let idx = 1;
            if (q) {
                where.push(`(
                    COALESCE(username, '') LIKE $${idx} OR 
                    COALESCE(action, '') LIKE $${idx} OR 
                    COALESCE(details, '') LIKE $${idx} OR
                    COALESCE(ip_address, '') LIKE $${idx} OR
                    COALESCE(CAST(created_at AS TEXT), '') LIKE $${idx}
                )`);
                params.push(`%${q}%`);
                idx++;
            }
            const whereClause = where.join(' AND ');
            const countQuery = `SELECT COUNT(*) FROM logs WHERE ${whereClause}`;
            const dataQuery = `SELECT * FROM logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
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
};
