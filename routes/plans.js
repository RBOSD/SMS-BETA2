const { pool } = require('../config/pool');
const { requireAuth, requireAdminOrManager } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { isAdminUser, getUserDataGroupIds, getPrimaryGroupId, canEditByOwnership } = require('../db/helpers');
const { logAction } = require('../utils/log');
const { handleApiError } = require('../utils/handleApiError');

module.exports = function registerPlansRoutes(app) {
    app.get('/api/plans', requireAuth, requireAdminOrManager, async (req, res) => {
        const { page=1, pageSize=20, q, year, sortField='id', sortDir='desc' } = req.query;
        const limit = parseInt(pageSize);
        const offset = (page-1)*limit;
        let where = ["1=1"], params = [], idx = 1;
        if(q) { where.push(`s.plan_name LIKE $${idx}`); params.push(`%${q}%`); idx++; }
        if(year) { where.push(`s.year = $${idx}`); params.push(year); idx++; }
        const safeSortFields = ['id', 'name', 'year', 'created_at', 'updated_at'];
        const safeField = safeSortFields.includes(sortField) ? sortField : 'id';
        const safeSortDir = sortDir === 'asc' ? 'ASC' : 'DESC';
        const orderCol = safeField === 'id' ? 'g.min_id' : safeField === 'name' ? 'g.name' : `g.${safeField}`;
        const order = `${orderCol} ${safeSortDir}`;
        try {
            const countQuery = `
                SELECT count(*) FROM (
                    SELECT plan_name, year FROM inspection_plan_schedule s WHERE ${where.join(" AND ")}
                    GROUP BY plan_name, year
                ) g`;
            const cRes = await pool.query(countQuery, params);
            const total = parseInt(cRes.rows[0].count);

            const dataQuery = `
                WITH g AS (
                    SELECT plan_name AS name, year, MIN(id) AS min_id,
                        MIN(created_at) AS created_at, MAX(updated_at) AS updated_at
                    FROM inspection_plan_schedule s WHERE ${where.join(" AND ")}
                    GROUP BY plan_name, year
                ),
                header AS (
                    SELECT plan_name, year, planned_count, business, railway, inspection_type
                    FROM inspection_plan_schedule WHERE inspection_seq = '00'
                ),
                schedule_counts AS (
                    SELECT plan_name, year, COUNT(*) AS cnt FROM inspection_plan_schedule WHERE (plan_number IS NULL OR plan_number <> '(手動)') GROUP BY plan_name, year
                )
                SELECT g.min_id AS id, g.name, g.year, g.created_at, g.updated_at,
                       COALESCE(COUNT(DISTINCT i.id), 0) AS issue_count,
                       h.planned_count, h.business, h.railway, h.inspection_type, COALESCE(sc.cnt, 0) AS schedule_count
                FROM g
                LEFT JOIN issues i ON i.plan_name = g.name AND i.year = g.year
                LEFT JOIN header h ON h.plan_name = g.name AND h.year = g.year
                LEFT JOIN schedule_counts sc ON sc.plan_name = g.name AND sc.year = g.year
                GROUP BY g.min_id, g.name, g.year, g.created_at, g.updated_at, h.planned_count, h.business, h.railway, h.inspection_type, sc.cnt
                ORDER BY ${order}
                LIMIT $${idx} OFFSET $${idx+1}
            `;
            const dRes = await pool.query(dataQuery, [...params, limit, offset]);

            const plansWithCounts = dRes.rows.map(row => ({
                id: row.id,
                name: row.name,
                year: row.year,
                created_at: row.created_at,
                updated_at: row.updated_at,
                issue_count: parseInt(row.issue_count) || 0,
                planned_count: row.planned_count != null ? parseInt(row.planned_count, 10) : null,
                business: row.business || null,
                railway: row.railway && String(row.railway).trim() !== '-' ? String(row.railway).trim() : null,
                inspection_type: row.inspection_type && String(row.inspection_type).trim() !== '-' ? String(row.inspection_type).trim() : null,
                schedule_count: parseInt(row.schedule_count) || 0
            }));

            res.json({data: plansWithCounts, total, page: parseInt(page), pages: Math.ceil(total/limit)});
        } catch (e) {
            handleApiError(e, req, res, 'Get plans error');
        }
    });

    app.get('/api/plans/by-name', requireAuth, async (req, res) => {
        try {
            const name = req.query.name;
            const year = req.query.year;

            if (!name || !year) {
                return res.status(400).json({
                    error: '缺少必要參數',
                    message: '請提供 name 和 year 參數'
                });
            }

            let planName, planYear;
            try {
                planName = decodeURIComponent(String(name)).trim();
                planYear = String(year).trim();
            } catch (decodeErr) {
                planName = String(name).replace(/\+/g, ' ').trim();
                planYear = String(year).trim();
            }

            if (!planName || !planYear) {
                return res.status(400).json({
                    error: '參數格式錯誤',
                    message: '計畫名稱或年度不能為空'
                });
            }

            if (!pool) {
                return res.status(503).json({
                    error: '資料庫未初始化',
                    message: '資料庫連線未初始化'
                });
            }

            const normalizedYear = planYear.replace(/^0+/, '').padStart(3, '0');
            const byNameSelect = 'SELECT id, plan_name, year, railway, inspection_type, business, planned_count, owner_group_id FROM inspection_plan_schedule WHERE plan_name = $1 AND year = $2 ORDER BY id ASC LIMIT 1';
            let queryResult = await pool.query(byNameSelect, [planName, planYear]);
            if (!queryResult || !queryResult.rows || queryResult.rows.length === 0) {
                queryResult = await pool.query(byNameSelect, [planName, normalizedYear]);
            }
            if (!queryResult || !queryResult.rows || queryResult.rows.length === 0) {
                queryResult = await pool.query(
                    `SELECT id, plan_name, year, railway, inspection_type, business, planned_count 
                     FROM inspection_plan_schedule 
                     WHERE plan_name = $1 AND (year = $2 OR year = $3 OR TRIM(LEADING '0' FROM year) = TRIM(LEADING '0' FROM $2))
                     ORDER BY id ASC LIMIT 1`,
                    [planName, planYear, normalizedYear]
                );
            }
            if (!queryResult || !queryResult.rows || queryResult.rows.length === 0) {
                return res.status(404).json({ error: '找不到計畫', message: `找不到名稱為「${planName}」且年度為「${planYear}」的計畫` });
            }
            const plan = queryResult.rows[0];
            const railway = (plan.railway && plan.railway !== '-') ? String(plan.railway).trim() : '';
            const inspection_type = (plan.inspection_type && plan.inspection_type !== '-') ? String(plan.inspection_type).trim() : '';
            const business = (plan.business && plan.business !== '-') ? String(plan.business).trim() : '';
            const planned_count = plan.planned_count != null ? parseInt(plan.planned_count, 10) : null;
            const response = {
                data: [{
                    id: plan.id,
                    name: plan.plan_name,
                    year: plan.year,
                    railway,
                    inspection_type,
                    business,
                    planned_count,
                    owner_group_id: plan.owner_group_id
                }]
            };
            if (!railway || !inspection_type) {
                response.warning = '該計畫缺少必要資訊（鐵路機構、檢查類別），請先在計畫管理中編輯';
            }
            return res.json(response);
        } catch (error) {
            console.error('[API] /api/plans/by-name error:', error);
            if (res.headersSent) return;
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                return res.status(503).json({ error: '資料庫連線失敗', message: '無法連接到資料庫，請稍後再試' });
            }
            const errorMessage = process.env.NODE_ENV === 'production' ? '查詢失敗，請稍後再試' : (error.detail || error.message || '未知錯誤');
            return res.status(500).json({ error: '查詢失敗', message: errorMessage });
        }
    });

    app.get('/api/plans/:id', requireAuth, requireAdminOrManager, async (req, res) => {
        try {
            if (req.params.id === 'by-name') return res.status(404).json({error: 'Invalid route'});
            const result = await pool.query(
                "SELECT id, plan_name AS name, year, created_at, updated_at, planned_count, business FROM inspection_plan_schedule WHERE id = $1",
                [req.params.id]
            );
            if (result.rows.length === 0) return res.status(404).json({error: 'Plan not found'});
            const row = result.rows[0];
            const scheduleCountRes = await pool.query(
                "SELECT COUNT(*) AS cnt FROM inspection_plan_schedule WHERE plan_name = $1 AND year = $2 AND (plan_number IS NULL OR plan_number <> '(手動)')",
                [row.name, row.year]
            );
            const schedule_count = parseInt(scheduleCountRes.rows[0]?.cnt, 10) || 0;
            res.json({ ...row, schedule_count });
        } catch (e) {
            handleApiError(e, req, res, 'Get plan by id error');
        }
    });

    app.get('/api/plans/:id/issues', requireAuth, requireAdminOrManager, async (req, res) => {
        try {
            const planResult = await pool.query(
                "SELECT plan_name AS name, year FROM inspection_plan_schedule WHERE id = $1",
                [req.params.id]
            );
            if (planResult.rows.length === 0) return res.status(404).json({error: 'Plan not found'});
            const planName = planResult.rows[0].name;
            const planYear = planResult.rows[0].year || '';
            const { page=1, pageSize=20 } = req.query;
            const limit = parseInt(pageSize);
            const offset = (page-1)*limit;
            const countRes = await pool.query("SELECT count(*) FROM issues WHERE plan_name = $1 AND year = $2", [planName, planYear]);
            const total = parseInt(countRes.rows[0].count);
            const dataRes = await pool.query("SELECT * FROM issues WHERE plan_name = $1 AND year = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4", [planName, planYear, limit, offset]);
            res.json({data: dataRes.rows, total, page: parseInt(page), pages: Math.ceil(total/limit)});
        } catch (e) {
            handleApiError(e, req, res, 'Get plan issues error');
        }
    });

    app.get('/api/plans/:id/schedules', requireAuth, requireAdminOrManager, async (req, res) => {
        try {
            const planResult = await pool.query(
                "SELECT plan_name AS name, year FROM inspection_plan_schedule WHERE id = $1",
                [req.params.id]
            );
            if (planResult.rows.length === 0) return res.status(404).json({error: 'Plan not found'});
            const planName = planResult.rows[0].name;
            const planYear = planResult.rows[0].year || '';
            const scheduleRes = await pool.query(
                `SELECT id, start_date, end_date, plan_number, inspection_seq, railway, inspection_type, business, plan_type, location, inspector 
                 FROM inspection_plan_schedule 
                 WHERE plan_name = $1 AND year = $2 
                 ORDER BY start_date ASC, id ASC`,
                [planName, planYear]
            );
            res.json({data: scheduleRes.rows || []});
        } catch (e) {
            handleApiError(e, req, res, 'Get plan schedules error');
        }
    });

    app.post('/api/plans', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        const { name, year, railway, inspection_type, business, planned_count, ownerGroupId: ownerGroupIdInput, ownerGroupIds: ownerGroupIdsInput } = req.body;
        try {
            if (!name || !year) return res.status(400).json({error: '計畫名稱和年度為必填'});
            if (!railway || !inspection_type) return res.status(400).json({error: '鐵路機構、檢查類別為必填'});
            const n = name.trim();
            const y = year.trim();
            const rCode = String(railway).toUpperCase();
            const it = String(inspection_type);
            const b = business ? String(business).toUpperCase() : null;
            const pc = planned_count != null && planned_count !== '' ? parseInt(planned_count, 10) : null;
            if (pc != null && (isNaN(pc) || pc < 0)) return res.status(400).json({error: '規劃檢查次數請填寫大於等於 0 的數字'});
            const exists = await pool.query(
                "SELECT 1 FROM inspection_plan_schedule WHERE plan_name = $1 AND year = $2 LIMIT 1",
                [n, y]
            );
            if (exists.rows.length > 0) {
                return res.status(400).json({ error: `計畫名稱「${n}」在年度「${y}」已存在` });
            }
            let ownerGroupIds = Array.isArray(ownerGroupIdsInput)
                ? ownerGroupIdsInput.map(x => parseInt(x, 10)).filter(n => Number.isFinite(n))
                : (ownerGroupIdInput != null ? [parseInt(ownerGroupIdInput, 10)].filter(n => Number.isFinite(n)) : []);
            const isAdmin = await isAdminUser(req.session.user.id, pool);
            if (!isAdmin) {
                const myGids = await getUserDataGroupIds(req.session.user.id, pool);
                if (ownerGroupIds.length === 0) ownerGroupIds = myGids.length > 0 ? [myGids[0]] : [];
                const allInMy = ownerGroupIds.length > 0 && ownerGroupIds.every(gid => myGids.includes(gid));
                if (!allInMy) return res.status(403).json({ error: 'Denied' });
            } else {
                if (ownerGroupIds.length === 0) {
                    const primary = await getPrimaryGroupId(req.session.user.id, pool);
                    if (primary != null) ownerGroupIds = [primary];
                }
                for (const gid of ownerGroupIds) {
                    const g = await pool.query("SELECT 1 FROM groups WHERE id = $1 AND COALESCE(is_admin_group, false) = false LIMIT 1", [gid]);
                    if (g.rows.length === 0) return res.status(400).json({ error: '群組不存在' });
                }
            }
            if (ownerGroupIds.length === 0) return res.status(400).json({ error: '請至少選擇一個適用群組' });
            const ownerGroupId = ownerGroupIds[0];
            const ownerUserId = req.session.user.id;
            await pool.query(
                `INSERT INTO inspection_plan_schedule (
                    start_date, end_date, plan_name, year, railway, inspection_type, business, inspection_seq, plan_number, planned_count,
                    owner_group_id, owner_group_ids, owner_user_id, edit_mode
                 ) VALUES (NULL, NULL, $1, $2, $3, $4, $5, '00', '(手動)', $6, $7, $8, $9, $10)`,
                [n, y, rCode, it, b, pc, ownerGroupId, ownerGroupIds, ownerUserId, 'GROUP']
            );
            logAction(req.session.user.username, 'CREATE_PLAN', `新增檢查計畫：${n} (年度：${y})`, req);
            res.json({success:true});
        } catch (e) {
            handleApiError(e, req, res, 'Create plan error');
        }
    });

    app.put('/api/plans/:id', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        const { name, year, business, planned_count } = req.body;
        const id = req.params.id;
        try {
            const planRes = await pool.query(
                "SELECT id, plan_name AS name, year, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM inspection_plan_schedule WHERE id = $1",
                [id]
            );
            if (planRes.rows.length === 0) return res.status(404).json({error: 'Plan not found'});
            const canEdit = await canEditByOwnership(
                { id: req.session.user.id, role: req.session.user.role },
                { ...planRes.rows[0], __type: 'plan_header' },
                pool
            );
            if (!canEdit) return res.status(403).json({ error: 'Denied' });
            const oldName = planRes.rows[0].name;
            const oldYear = planRes.rows[0].year || '';
            if (!name || !year) return res.status(400).json({error: '計畫名稱和年度為必填'});
            const n = name.trim();
            const y = year.trim();
            const pc = planned_count != null && planned_count !== '' ? parseInt(planned_count, 10) : null;
            if (pc != null && (isNaN(pc) || pc < 0)) return res.status(400).json({error: '規劃檢查次數請填寫大於等於 0 的數字'});
            const b = business ? String(business).toUpperCase() : null;
            if (n !== oldName || y !== oldYear) {
                const conflict = await pool.query(
                    "SELECT 1 FROM inspection_plan_schedule WHERE plan_name = $1 AND year = $2 LIMIT 1",
                    [n, y]
                );
                if (conflict.rows.length > 0) {
                    return res.status(400).json({ error: '計畫名稱與年度組合已存在' });
                }
                await pool.query(
                    "UPDATE issues SET plan_name = $1, year = $2 WHERE plan_name = $3 AND year = $4",
                    [n, y, oldName, oldYear]
                );
                await pool.query(
                    "UPDATE inspection_plan_schedule SET plan_name = $1, year = $2, updated_at = CURRENT_TIMESTAMP WHERE plan_name = $3 AND year = $4",
                    [n, y, oldName, oldYear]
                );
            }
            await pool.query(
                "UPDATE inspection_plan_schedule SET planned_count = $1, business = $2, updated_at = CURRENT_TIMESTAMP WHERE plan_name = $3 AND year = $4 AND inspection_seq = '00'",
                [pc, b, n, y]
            );
            logAction(req.session.user.username, 'UPDATE_PLAN', `修改檢查計畫：${oldName} → ${n} (年度：${y})`, req);
            res.json({success:true});
        } catch (e) {
            handleApiError(e, req, res, 'Update plan error');
        }
    });

    app.delete('/api/plans/:id', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        try {
            const planRes = await pool.query(
                "SELECT id, plan_name AS name, year, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM inspection_plan_schedule WHERE id = $1",
                [req.params.id]
            );
            if (planRes.rows.length === 0) return res.status(404).json({error: 'Plan not found'});
            const canEdit = await canEditByOwnership(
                { id: req.session.user.id, role: req.session.user.role },
                { ...planRes.rows[0], __type: 'plan_header' },
                pool
            );
            if (!canEdit) return res.status(403).json({ error: 'Denied' });
            const planName = planRes.rows[0].name;
            const planYear = planRes.rows[0].year || '';
            const issueCount = await pool.query("SELECT count(*) FROM issues WHERE plan_name = $1 AND year = $2", [planName, planYear]);
            const count = parseInt(issueCount.rows[0].count);
            if (count > 0) {
                return res.status(400).json({error: `無法刪除計畫，因為尚有 ${count} 筆相關開立事項。請先刪除或轉移相關事項。`});
            }
            if (planYear) {
                await pool.query("DELETE FROM inspection_plan_schedule WHERE plan_name = $1 AND year = $2", [planName, planYear]);
            } else {
                await pool.query("DELETE FROM inspection_plan_schedule WHERE plan_name = $1", [planName]);
            }
            logAction(req.session.user.username, 'DELETE_PLAN', `刪除檢查計畫：${planName}${planYear ? ` (年度：${planYear})` : ''}`, req);
            res.json({success:true});
        } catch (e) {
            handleApiError(e, req, res, 'Delete plan error');
        }
    });

    app.get('/api/plans/:id/editors', requireAuth, requireAdminOrManager, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
            const metaRes = await pool.query(
                "SELECT id, plan_name, year, inspection_seq, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM inspection_plan_schedule WHERE id=$1",
                [id]
            );
            if (metaRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
            const meta = metaRes.rows[0];
            if (String(meta.inspection_seq) !== '00') return res.status(400).json({ error: '此端點僅適用計畫主檔（inspection_seq=00）' });
            const canEdit = await canEditByOwnership(
                { id: req.session.user.id, role: req.session.user.role },
                { ...meta, __type: 'plan_header' },
                pool
            );
            if (!canEdit) return res.status(403).json({ error: 'Denied' });
            const r = await pool.query(
                `SELECT u.id, u.username, u.name, u.role,
                        COALESCE(BOOL_OR(g.is_admin_group = true), false) AS is_admin
                 FROM plan_editors pe
                 JOIN users u ON u.id = pe.user_id
                 LEFT JOIN user_groups ug ON ug.user_id = u.id
                 LEFT JOIN groups g ON g.id = ug.group_id
                 WHERE pe.plan_id = $1
                 GROUP BY u.id
                 ORDER BY COALESCE(BOOL_OR(g.is_admin_group = true), false) DESC, u.role ASC, u.username ASC`,
                [id]
            );
            res.json({
                data: (r.rows || []).map(u => ({
                    id: u.id,
                    username: u.username,
                    name: u.name,
                    role: u.role,
                    isAdmin: u.is_admin === true
                }))
            });
        } catch (e) {
            handleApiError(e, req, res, 'Get plan editors error');
        }
    });

    app.put('/api/plans/:id/editors', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const editorUserIdsRaw = req.body?.editorUserIds;
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
        const editorUserIds = Array.isArray(editorUserIdsRaw)
            ? Array.from(new Set(editorUserIdsRaw.map(x => parseInt(x, 10)).filter(n => Number.isFinite(n))))
            : [];
        try {
            const metaRes = await pool.query(
                "SELECT id, plan_name, year, inspection_seq, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM inspection_plan_schedule WHERE id=$1",
                [id]
            );
            if (metaRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
            const meta = metaRes.rows[0];
            if (String(meta.inspection_seq) !== '00') return res.status(400).json({ error: '此端點僅適用計畫主檔（inspection_seq=00）' });
            const canEdit = await canEditByOwnership(
                { id: req.session.user.id, role: req.session.user.role },
                { ...meta, __type: 'plan_header' },
                pool
            );
            if (!canEdit) return res.status(403).json({ error: 'Denied' });
            if (editorUserIds.length > 0) {
                const uRes = await pool.query(
                    `SELECT u.id, u.role, COALESCE(BOOL_OR(g.is_admin_group = true), false) AS is_admin
                     FROM users u
                     LEFT JOIN user_groups ug ON ug.user_id = u.id
                     LEFT JOIN groups g ON g.id = ug.group_id
                     WHERE u.id = ANY($1)
                     GROUP BY u.id`,
                    [editorUserIds]
                );
                const byId = new Map((uRes.rows || []).map(r => [parseInt(r.id, 10), r]));
                const invalid = editorUserIds.filter(uid => !byId.has(uid));
                if (invalid.length) return res.status(400).json({ error: `找不到使用者：${invalid.join(', ')}` });
                const notAllowed = editorUserIds.filter(uid => {
                    const row = byId.get(uid);
                    const isAdmin = row?.is_admin === true;
                    const role = String(row?.role || '');
                    return !(isAdmin || role === 'manager');
                });
                if (notAllowed.length) return res.status(400).json({ error: `僅可指派「資料管理者」或「系統管理員」：${notAllowed.join(', ')}` });
            }
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query("DELETE FROM plan_editors WHERE plan_id = $1", [id]);
                if (editorUserIds.length > 0) {
                    await client.query(
                        "INSERT INTO plan_editors (plan_id, user_id) SELECT $1, x FROM UNNEST($2::int[]) AS x ON CONFLICT DO NOTHING",
                        [id, editorUserIds]
                    );
                }
                await client.query('COMMIT');
            } catch (e) {
                try { await client.query('ROLLBACK'); } catch (_) {}
                throw e;
            } finally {
                client.release();
            }
            logAction(req.session.user.username, 'UPDATE_PLAN_EDITORS', `更新檢查計畫協作編修：${meta.plan_name || ''} (${meta.year || ''})，共 ${editorUserIds.length} 人`, req).catch(()=>{});
            res.json({ success: true });
        } catch (e) {
            handleApiError(e, req, res, 'Update plan editors error');
        }
    });

    app.post('/api/plans/import', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        const { data } = req.body;
        if (!data || !Array.isArray(data)) return res.status(400).json({error: '無效的資料格式'});
        const results = { success: 0, failed: 0, errors: [], skipped: 0 };
        const ownerGroupId = await getPrimaryGroupId(req.session.user.id, pool);
        if (ownerGroupId == null) return res.status(400).json({ error: '請先將帳號加入至少一個資料群組' });
        const ownerUserId = req.session.user.id;
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const name = String(row.name || row.planName || row['計畫名稱'] || row['計劃名稱'] || '').trim();
            let year = String(row.year || row['年度'] || '').trim();
            const railway = String(row.railway || row['鐵路機構'] || '').trim();
            const inspection_type = String(row.inspection_type || row.inspectionType || row['檢查類別'] || '').trim();
            const business = String(row.business || row['業務類型'] || row['業務類別'] || '').trim();
            const planned_count_raw = row.planned_count ?? row.plannedCount ?? row['規劃檢查幾次'] ?? row['規劃檢查次數'];
            const planned_count = planned_count_raw !== undefined && planned_count_raw !== null && String(planned_count_raw).trim() !== ''
                ? parseInt(String(planned_count_raw).trim(), 10)
                : null;
            if (!name && !year && !railway && !inspection_type && !business && planned_count == null) {
                results.skipped++;
                continue;
            }
            year = String(year).replace(/\D/g, '').slice(-3).padStart(3, '0');
            if (!name || !/^\d{3}$/.test(year) || !railway || !inspection_type) {
                results.failed++;
                results.errors.push(`第 ${i + 2} 行：年度、計畫名稱、鐵路機構、檢查類別為必填`);
                continue;
            }
            if (planned_count != null && (Number.isNaN(planned_count) || planned_count < 0)) {
                results.failed++;
                results.errors.push(`第 ${i + 2} 行（${name}）：規劃檢查幾次需為大於等於 0 的數字`);
                continue;
            }
            try {
                const exists = await pool.query(
                    "SELECT 1 FROM inspection_plan_schedule WHERE plan_name = $1 AND year = $2 LIMIT 1",
                    [name, year]
                );
                if (exists.rows.length > 0) {
                    results.failed++;
                    results.errors.push(`第 ${i + 2} 行（${name}）：計畫已存在（年度 ${year}）`);
                    continue;
                }
                const rCode = String(railway).toUpperCase();
                const it = String(inspection_type);
                const b = business ? String(business).toUpperCase() : null;
                await pool.query(
                    `INSERT INTO inspection_plan_schedule (
                        start_date, end_date, plan_name, year, railway, inspection_type, business, inspection_seq, plan_number, planned_count,
                        owner_group_id, owner_group_ids, owner_user_id, edit_mode
                     ) VALUES (NULL, NULL, $1, $2, $3, $4, $5, '00', '(手動)', $6, $7, $8, $9, $10)`,
                    [name, year, rCode, it, b, planned_count, ownerGroupId, [ownerGroupId], ownerUserId, 'GROUP']
                );
                results.success++;
            } catch (e) {
                results.failed++;
                results.errors.push(`第 ${i + 2} 行（${name || '未命名'}）：${e.message}`);
            }
        }
        if (results.success > 0) {
            logAction(req.session.user.username, 'IMPORT_PLANS', `匯入檢查計畫：成功 ${results.success} 筆，失敗 ${results.failed} 筆，跳過 ${results.skipped || 0} 筆`, req);
        }
        res.json({
            success: true,
            successCount: results.success,
            failed: results.failed,
            errors: results.errors,
            skipped: results.skipped
        });
    });
};
