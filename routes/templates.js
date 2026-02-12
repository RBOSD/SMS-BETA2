const { pool } = require('../config/pool');
const { requireAuth, requireAdminOrManager } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { logAction } = require('../utils/log');
const { handleApiError } = require('../utils/handleApiError');

module.exports = function registerTemplatesRoutes(app) {
    app.get('/api/templates/plans-import-xlsx', requireAuth, async (req, res) => {
        try {
            const r = await pool.query('SELECT filename, mime, data FROM app_files WHERE key = $1', ['plans_import_xlsx']);
            if (!r.rows || r.rows.length === 0) {
                return res.status(404).json({ error: 'Template not set' });
            }
            const row = r.rows[0];
            const filename = row.filename || '檢查計畫匯入範例.xlsx';
            const mime = row.mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            res.setHeader('Content-Type', mime);
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
            res.send(row.data);
        } catch (e) {
            handleApiError(e, req, res, 'Get plans import template error');
        }
    });

    app.post('/api/templates/plans-import-xlsx', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        try {
            const filename = String(req.body.filename || '檢查計畫匯入範例.xlsx');
            const dataBase64 = String(req.body.dataBase64 || '');
            if (!dataBase64) return res.status(400).json({ error: '缺少檔案內容' });
            const buf = Buffer.from(dataBase64, 'base64');
            if (!buf || buf.length === 0) return res.status(400).json({ error: '檔案內容無效' });
            const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            await pool.query(
                `INSERT INTO app_files (key, filename, mime, data, updated_at)
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                 ON CONFLICT (key) DO UPDATE SET filename = EXCLUDED.filename, mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
                ['plans_import_xlsx', filename, mime, buf]
            );
            logAction(req.session.user.username, 'UPLOAD_TEMPLATE', `更新檢查計畫匯入範例檔：${filename}`, req);
            res.json({ success: true });
        } catch (e) {
            handleApiError(e, req, res, 'Upload plans import template error');
        }
    });

    app.get('/api/templates/users-import-csv', requireAuth, async (req, res) => {
        try {
            const r = await pool.query('SELECT filename, mime, data FROM app_files WHERE key = $1', ['users_import_csv']);
            if (!r.rows || r.rows.length === 0) {
                return res.status(404).json({ error: 'Template not set' });
            }
            const row = r.rows[0];
            const filename = row.filename || '帳號匯入範例.csv';
            const mime = row.mime || 'text/csv; charset=utf-8';
            res.setHeader('Content-Type', mime);
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
            res.send(row.data);
        } catch (e) {
            handleApiError(e, req, res, 'Get users import csv template error');
        }
    });

    app.post('/api/templates/users-import-csv', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        try {
            const filename = String(req.body.filename || '帳號匯入範例.csv');
            const dataBase64 = String(req.body.dataBase64 || '');
            if (!dataBase64) return res.status(400).json({ error: '缺少檔案內容' });
            const buf = Buffer.from(dataBase64, 'base64');
            if (!buf || buf.length === 0) return res.status(400).json({ error: '檔案內容無效' });
            const mime = 'text/csv; charset=utf-8';
            await pool.query(
                `INSERT INTO app_files (key, filename, mime, data, updated_at)
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                 ON CONFLICT (key) DO UPDATE SET filename = EXCLUDED.filename, mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
                ['users_import_csv', filename, mime, buf]
            );
            logAction(req.session.user.username, 'UPLOAD_TEMPLATE', `更新帳號匯入範例檔：${filename}`, req);
            res.json({ success: true });
        } catch (e) {
            handleApiError(e, req, res, 'Upload users import csv template error');
        }
    });
};
