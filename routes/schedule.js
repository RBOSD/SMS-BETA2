const { pool } = require('../config/pool');
const { requireAuth, requireAdminOrManager } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { getPrimaryGroupId, canEditByOwnership } = require('../db/helpers');
const { getNextAvailableScheduleSeq, getPlanScheduleLockKey } = require('../utils/constants');
const { logAction } = require('../utils/log');
const { handleApiError } = require('../utils/handleApiError');

module.exports = function registerScheduleRoutes(app) {
    app.get('/api/plan-schedule', requireAuth, async (req, res) => {
        const { year, month } = req.query;
        try {
            if (!year || !month) {
                return res.status(400).json({ error: '請提供 year 與 month 參數（西元年、月）' });
            }
            const y = parseInt(String(year), 10);
            const m = parseInt(String(month), 10);
            const start = `${y}-${String(m).padStart(2, '0')}-01`;
            const lastDay = new Date(y, m, 0).getDate();
            const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            const rows = await pool.query(
                `SELECT id, start_date, end_date, plan_name, year, railway, inspection_type, business, inspection_seq, plan_number, created_at, location, inspector 
                 FROM inspection_plan_schedule 
                 WHERE (start_date <= $2::date AND (end_date IS NULL OR end_date >= $1::date))
                 ORDER BY start_date ASC, id ASC`,
                [start, end]
            );
            res.json({ data: rows.rows || [] });
        } catch (e) {
            handleApiError(e, req, res, 'Get plan schedule error');
        }
    });

    app.get('/api/plan-schedule/next-number', requireAuth, async (req, res) => {
        const { year, railway, inspectionType } = req.query;
        try {
            if (!year || !railway || !inspectionType) {
                return res.status(400).json({ error: '請提供 year, railway, inspectionType' });
            }
            const y = String(year).replace(/\D/g, '').slice(-3).padStart(3, '0');
            const r = String(railway).toUpperCase();
            const it = String(inspectionType);
            const seq = await getNextAvailableScheduleSeq(pool, y, r, it);
            const planNumber = `${y}${r}${it}-${seq}`;
            res.json({ nextSeq: seq, planNumber });
        } catch (e) {
            handleApiError(e, req, res, 'Get next plan number error');
        }
    });

    app.post('/api/plan-schedule', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        const { plan_name, start_date, end_date, year, railway, inspection_type, business, location, inspector, plan_number: clientPlanNumber } = req.body;
        const client = await pool.connect();
        try {
            if (!plan_name || !start_date || !end_date || !year || !railway || !inspection_type) {
                const missingFields = [];
                if (!plan_name) missingFields.push('計畫名稱');
                if (!start_date) missingFields.push('開始日期');
                if (!end_date) missingFields.push('結束日期');
                if (!year) missingFields.push('年度');
                if (!railway) missingFields.push('鐵路機構');
                if (!inspection_type) missingFields.push('檢查類別');
                return res.status(400).json({
                    error: `以下欄位為必填：${missingFields.join('、')}`,
                    missingFields: missingFields
                });
            }
            if (end_date < start_date) {
                return res.status(400).json({ error: '結束日期不能早於開始日期' });
            }
            const y = String(year).replace(/\D/g, '').slice(-3).padStart(3, '0');
            const r = String(railway).toUpperCase();
            const it = String(inspection_type);
            const validRailways = ['T', 'H', 'A', 'S'];
            const validInspectionTypes = ['1', '2', '3', '4', '5'];
            if (!validRailways.includes(r)) {
                return res.status(400).json({ error: `無效的鐵路機構：${r}，請選擇有效的鐵路機構` });
            }
            if (!validInspectionTypes.includes(it)) {
                return res.status(400).json({ error: `無效的檢查類別：${it}，請選擇有效的檢查類別` });
            }
            const name = String(plan_name).trim();
            let planNumber;
            let seq;

            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [getPlanScheduleLockKey(y, r, it)]);

            let ownerGroupId = null;
            let ownerGroupIds = [];
            let ownerUserId = req.session.user.id;

            try {
                const headerRes = await client.query(
                    "SELECT id, plan_name, year, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM inspection_plan_schedule WHERE plan_name = $1 AND year = $2 AND inspection_seq = '00' LIMIT 1",
                    [name, y]
                );
                if (headerRes.rows.length > 0) {
                    const h = headerRes.rows[0];
                    const ok = await canEditByOwnership(
                        { id: req.session.user.id, role: req.session.user.role },
                        { ...h, __type: 'plan_header' },
                        client
                    );
                    if (!ok) {
                        await client.query('ROLLBACK');
                        return res.status(403).json({ error: 'Denied' });
                    }
                    ownerGroupIds = Array.isArray(h.owner_group_ids) && h.owner_group_ids.length > 0
                        ? h.owner_group_ids : (h.owner_group_id != null ? [h.owner_group_id] : []);
                    ownerGroupId = ownerGroupIds[0] ?? null;
                }
            } catch (e) {
                throw e;
            }
            if (ownerGroupIds.length === 0) {
                ownerGroupId = await getPrimaryGroupId(req.session.user.id, client);
                if (ownerGroupId == null) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: '請先將帳號加入至少一個資料群組' });
                }
                ownerGroupIds = [ownerGroupId];
            }

            const manualNumber = clientPlanNumber && String(clientPlanNumber).trim();
            if (manualNumber) {
                planNumber = manualNumber;
                const seqMatch = manualNumber.match(/-(\d{2,3})$/);
                if (seqMatch) {
                    seq = seqMatch[1];
                } else {
                    seq = await getNextAvailableScheduleSeq(client, y, r, it);
                }
            } else {
                seq = await getNextAvailableScheduleSeq(client, y, r, it);
                planNumber = `${y}${r}${it}-${seq}`;
            }

            const seqExists = await client.query(
                `SELECT 1 FROM inspection_plan_schedule
                 WHERE year = $1 AND railway = $2 AND inspection_type = $3
                   AND inspection_seq = $4 AND inspection_seq <> '00'
                 LIMIT 1`,
                [y, r, it, seq]
            );
            if (seqExists.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `取號序號 ${seq} 已被使用，請重新新增或改用自動取號` });
            }

            const b = business ? String(business).toUpperCase() : null;

            await client.query(
                `INSERT INTO inspection_plan_schedule (
                    start_date, end_date, plan_name, year, railway, inspection_type, business, inspection_seq, plan_number,
                    location, inspector, owner_group_id, owner_group_ids, owner_user_id, edit_mode
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [start_date, end_date, name, y, r, it, b, seq, planNumber, location || null, inspector || null, ownerGroupId, ownerGroupIds, ownerUserId, 'GROUP']
            );
            await client.query('COMMIT');

            const dateRange = end_date ? `${start_date} ~ ${end_date}` : start_date;
            logAction(req.session.user.username, 'CREATE_PLAN_SCHEDULE', `新增檢查計畫規劃：${name}，取號 ${planNumber}，日期 ${dateRange}`, req);
            res.json({ success: true, planNumber, inspectionSeq: seq });
        } catch (e) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            if (e.code === '23505') {
                return res.status(400).json({ error: '取號衝突（序號已被使用），請重新再試' });
            } else if (e.code === '23502') {
                return res.status(400).json({ error: '必填欄位不能為空，請檢查輸入的資料' });
            } else if (e.code === '22007' || e.code === '22008') {
                return res.status(400).json({ error: '日期格式錯誤，請使用正確的日期格式（YYYY-MM-DD）' });
            }
            handleApiError(e, req, res, 'Create plan schedule error');
        } finally {
            client.release();
        }
    });

    app.get('/api/plan-schedule/all', requireAuth, requireAdminOrManager, async (req, res) => {
        try {
            const rows = await pool.query(
                `SELECT s.id, s.start_date, s.end_date, s.plan_name, s.year, s.railway, s.inspection_type, s.business, s.inspection_seq, s.plan_number, s.created_at, s.updated_at, s.location, s.inspector,
                        (SELECT h.planned_count FROM inspection_plan_schedule h WHERE h.plan_name = s.plan_name AND h.year = s.year AND h.inspection_seq = '00' LIMIT 1) AS planned_count
                 FROM inspection_plan_schedule s 
                 ORDER BY s.year DESC, s.start_date ASC NULLS LAST, s.id ASC`
            );
            res.json({ data: rows.rows || [] });
        } catch (e) {
            handleApiError(e, req, res, 'Get all plan schedules error');
        }
    });

    // 假日資料來源：GitHub ruyut/TaiwanCalendar（中華民國政府行政機關辦公日曆）
    app.get('/api/holidays/:year', requireAuth, async (req, res) => {
        try {
            const year = parseInt(req.params.year);
            if (!year || year < 2000 || year > 2100) {
                return res.status(400).json({ error: '無效的年份' });
            }
            const https = require('https');
            const url = `https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`;
            return new Promise((resolve) => {
                const request = https.get(url, { timeout: 8000 }, (response) => {
                    if (response.statusCode !== 200) {
                        res.json({ data: [] });
                        return resolve();
                    }
                    let data = '';
                    response.setEncoding('utf8');
                    response.on('data', (chunk) => { data += chunk; });
                    response.on('end', () => {
                        try {
                            const rawData = JSON.parse(data);
                            const arr = Array.isArray(rawData) ? rawData : [];
                            const holidays = arr.map(h => {
                                const d = String(h.date || '').trim();
                                const dateStr = d.match(/^\d{8}$/)
                                    ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
                                    : d;
                                return {
                                    date: dateStr,
                                    name: (h.description || '').trim() || '假日',
                                    isHoliday: h.isHoliday === true
                                };
                            });
                            res.json({ data: holidays });
                            resolve();
                        } catch (e) {
                            res.json({ data: [] });
                            resolve();
                        }
                    });
                });
                request.on('error', () => {
                    res.json({ data: [] });
                    resolve();
                });
                request.on('timeout', () => {
                    request.destroy();
                    res.json({ data: [] });
                    resolve();
                });
            });
        } catch (e) {
            res.json({ data: [] });
        }
    });

    app.put('/api/plan-schedule/:id', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        const { plan_name, start_date, end_date, year, railway, inspection_type, business, location, inspector, plan_number: clientPlanNumber } = req.body;
        const client = await pool.connect();
        try {
            if (!plan_name || !start_date || !end_date || !year || !railway || !inspection_type) {
                return res.status(400).json({ error: '計畫名稱、開始日期、結束日期、年度、鐵路機構、檢查類別為必填' });
            }
            if (end_date < start_date) {
                return res.status(400).json({ error: '結束日期不能早於開始日期' });
            }

            await client.query('BEGIN');
            const r = await client.query('SELECT * FROM inspection_plan_schedule WHERE id = $1 FOR UPDATE', [req.params.id]);
            if (r.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: '找不到該筆排程' });
            }
            const oldRow = r.rows[0];

            const canEdit = await canEditByOwnership({ id: req.session.user.id, role: req.session.user.role }, { ...oldRow, __type: 'schedule' }, client);
            if (!canEdit) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Denied' });
            }

            const y = String(year).replace(/\D/g, '').slice(-3).padStart(3, '0');
            const rCode = String(railway).toUpperCase();
            const it = String(inspection_type);
            const b = business ? String(business).toUpperCase() : null;

            const targetPlanName = String(plan_name).trim();
            try {
                const headerRes = await client.query(
                    "SELECT id, plan_name, year, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM inspection_plan_schedule WHERE plan_name = $1 AND year = $2 AND inspection_seq = '00' LIMIT 1",
                    [targetPlanName, y]
                );
                if (headerRes.rows.length > 0) {
                    const ok = await canEditByOwnership(
                        { id: req.session.user.id, role: req.session.user.role },
                        { ...headerRes.rows[0], __type: 'plan_header' },
                        client
                    );
                    if (!ok) {
                        await client.query('ROLLBACK');
                        return res.status(403).json({ error: 'Denied' });
                    }
                }
            } catch (e) {
                throw e;
            }

            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [getPlanScheduleLockKey(y, rCode, it)]);

            let inspection_seq = oldRow.inspection_seq;
            let plan_number = oldRow.plan_number;

            const manualNumber = clientPlanNumber && String(clientPlanNumber).trim();
            if (String(oldRow.inspection_seq) === '00' || String(oldRow.plan_number) === '(手動)') {
                inspection_seq = '00';
                plan_number = '(手動)';
            } else if (manualNumber) {
                plan_number = manualNumber;
                const seqMatch = manualNumber.match(/-(\d{2,3})$/);
                if (seqMatch) {
                    inspection_seq = seqMatch[1];
                } else {
                    inspection_seq = await getNextAvailableScheduleSeq(client, y, rCode, it, oldRow.id);
                }
            } else {
                const oldYear = String(oldRow.year || '').trim();
                const oldRailway = String(oldRow.railway || '').trim();
                const oldType = String(oldRow.inspection_type || '').trim();
                const poolChanged = (y !== oldYear) || (rCode !== oldRailway) || (it !== oldType);
                if (poolChanged) {
                    const candidate = String(oldRow.inspection_seq || '').trim();
                    let canKeep = false;
                    if (candidate && candidate !== '00' && /^[0-9]+$/.test(candidate)) {
                        const used = await client.query(
                            `SELECT 1 FROM inspection_plan_schedule
                             WHERE year = $1 AND railway = $2 AND inspection_type = $3
                               AND inspection_seq = $4 AND id <> $5 AND inspection_seq <> '00'
                             LIMIT 1`,
                            [y, rCode, it, candidate, oldRow.id]
                        );
                        canKeep = used.rows.length === 0;
                    }
                    inspection_seq = canKeep ? candidate : await getNextAvailableScheduleSeq(client, y, rCode, it, oldRow.id);
                    plan_number = `${y}${rCode}${it}-${inspection_seq}`;
                }
            }

            if (String(inspection_seq) !== '00') {
                const ex = await client.query(
                    `SELECT 1 FROM inspection_plan_schedule
                     WHERE year = $1 AND railway = $2 AND inspection_type = $3
                       AND inspection_seq = $4 AND id <> $5 AND inspection_seq <> '00'
                     LIMIT 1`,
                    [y, rCode, it, inspection_seq, oldRow.id]
                );
                if (ex.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `取號序號 ${inspection_seq} 已被使用，請重新選擇或改用自動取號` });
                }
            }

            await client.query(
                `UPDATE inspection_plan_schedule 
                 SET plan_name = $1, start_date = $2, end_date = $3, year = $4, railway = $5, 
                     inspection_type = $6, business = $7, inspection_seq = $8, plan_number = $9, 
                     location = $10, inspector = $11, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $12`,
                [plan_name.trim(), start_date, end_date, y, rCode, it, b, inspection_seq, plan_number, location || null, inspector || null, req.params.id]
            );
            await client.query('COMMIT');

            const dateRange = `${start_date} ~ ${end_date}`;
            logAction(req.session.user.username, 'UPDATE_PLAN_SCHEDULE', `更新檢查計畫規劃：${plan_name}，取號 ${plan_number}，日期 ${dateRange}`, req);
            res.json({ success: true, planNumber: plan_number });
        } catch (e) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            handleApiError(e, req, res, 'Update plan schedule error');
        } finally {
            client.release();
        }
    });

    app.delete('/api/plan-schedule/:id', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        try {
            const r = await pool.query(
                'SELECT id, plan_name, plan_number, year, railway, inspection_type, inspection_seq, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM inspection_plan_schedule WHERE id = $1',
                [req.params.id]
            );
            if (r.rows.length === 0) return res.status(404).json({ error: '找不到該筆排程' });
            const row = r.rows[0];
            if (row.plan_number === '(手動)' || row.inspection_seq === '00') {
                return res.status(400).json({ error: '不可刪除計畫主檔，請從計畫管理刪除整個計畫' });
            }
            const canEdit = await canEditByOwnership({ id: req.session.user.id, role: req.session.user.role }, { ...row, __type: 'schedule' }, pool);
            if (!canEdit) return res.status(403).json({ error: 'Denied' });
            await pool.query('DELETE FROM inspection_plan_schedule WHERE id = $1', [req.params.id]);
            logAction(req.session.user.username, 'DELETE_PLAN_SCHEDULE', `刪除檢查計畫規劃：${row.plan_name}（${row.plan_number}）`, req);
            res.json({ success: true });
        } catch (e) {
            handleApiError(e, req, res, 'Delete plan schedule error');
        }
    });
};
