const { pool } = require('../config/pool');
const { isAdminUser, canEditByOwnership, getUserDataGroupIds, getPrimaryGroupId } = require('../db/helpers');
const { requireAuth, requireAdminOrManager } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { logAction, logError } = require('../utils/log');
const { handleApiError } = require('../utils/handleApiError');

module.exports = function registerIssuesRoutes(app) {
    app.get('/api/issues', requireAuth, async (req, res) => {
        const { page = 1, pageSize = 20, q, year, unit, status, itemKindCode, division, inspectionCategory, planName, sortField, sortDir } = req.query;
        const limit = parseInt(pageSize);
        const offset = (page - 1) * limit;
        let where = ["1=1"], params = [], idx = 1;

        res.set('Cache-Control', 'no-store');

        if (q) {
            where.push(`(number LIKE $${idx} OR content LIKE $${idx} OR handling LIKE $${idx} OR review LIKE $${idx} OR plan_name LIKE $${idx})`);
            params.push(`%${q}%`); idx++;
        }
        if (year) { where.push(`year = $${idx}`); params.push(year); idx++; }
        if (unit) { where.push(`unit = $${idx}`); params.push(unit); idx++; }
        if (status) { where.push(`status = $${idx}`); params.push(status); idx++; }
        if (itemKindCode) { where.push(`item_kind_code = $${idx}`); params.push(itemKindCode); idx++; }
        if (division) { where.push(`division_name = $${idx}`); params.push(division); idx++; }
        if (inspectionCategory) { where.push(`inspection_category_name = $${idx}`); params.push(inspectionCategory); idx++; }
        if (planName) {
            const planParts = planName.split('|||');
            const actualPlanName = planParts[0];
            const planYear = planParts[1];
            if (planYear) {
                where.push(`plan_name = $${idx} AND year = $${idx+1}`);
                params.push(actualPlanName, planYear);
                idx += 2;
            } else {
                where.push(`plan_name = $${idx}`);
                params.push(actualPlanName);
                idx++;
            }
        }

        let orderBy = "created_at DESC";
        const validCols = ['year', 'number', 'unit', 'status', 'created_at'];
        if (sortField && validCols.includes(sortField)) {
            orderBy = `${sortField} ${sortDir === 'asc' ? 'ASC' : 'DESC'}`;
        }

        try {
            const countRes = await pool.query(`SELECT count(*) FROM issues WHERE ${where.join(" AND ")}`, params);
            const total = parseInt(countRes.rows[0].count);
            const dataRes = await pool.query(`SELECT * FROM issues WHERE ${where.join(" AND ")} ORDER BY ${orderBy} LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset]);
            const sRes = await pool.query("SELECT status, count(*) as count FROM issues GROUP BY status");
            const uRes = await pool.query("SELECT unit, count(*) as count FROM issues GROUP BY unit");
            const yRes = await pool.query("SELECT year, count(*) as count FROM issues GROUP BY year");
            const tRes = await pool.query("SELECT max(updated_at) as updated, max(created_at) as latest FROM issues");
            const latestTime = tRes.rows[0] ? (tRes.rows[0].updated || tRes.rows[0].latest) : null;

            res.json({
                data: dataRes.rows,
                total,
                page: parseInt(page),
                pageSize: limit,
                pages: Math.ceil(total / limit),
                latestCreatedAt: latestTime,
                globalStats: { status: sRes.rows, unit: uRes.rows, year: yRes.rows }
            });
        } catch (e) { 
            handleApiError(e, req, res, 'Get issues error');
        }
    });

    app.put('/api/issues/:id', requireAuth, verifyCsrf, async (req, res) => {
        const { status, round, handling, review, replyDate, responseDate, content, issueDate, 
                number, year, unit, divisionName, inspectionCategoryName, itemKindCode, planName } = req.body;
        const id = req.params.id;
        const r = parseInt(round) || 1;
        const hField = r === 1 ? 'handling' : `handling${r}`;
        const rField = r === 1 ? 'review' : `review${r}`;
        const replyField = `reply_date_r${r}`;
        const respField = `response_date_r${r}`;
        try {
            const role = req.session?.user?.role;
            const isAdmin = await isAdminUser(req.session.user.id, pool);
            if (!(isAdmin || role === 'manager')) {
                return res.status(403).json({ error: 'Denied' });
            }

            const issueMetaRes = await pool.query(
                "SELECT id, number, status, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM issues WHERE id=$1",
                [id]
            );
            if (issueMetaRes.rows.length === 0) return res.status(404).json({ error: 'Issue not found' });
            const issueMeta = issueMetaRes.rows[0];
            const canEdit = await canEditByOwnership({ id: req.session.user.id, role }, { ...issueMeta, __type: 'issue' }, pool);
            if (!canEdit) return res.status(403).json({ error: 'Denied' });

            const issueNumber = issueMeta.number || `ID:${id}`;
            
            if (r > 30) {
                try {
                    await pool.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS ${hField} TEXT`);
                    await pool.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS ${rField} TEXT`);
                    await pool.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS ${replyField} TEXT`);
                    await pool.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS ${respField} TEXT`);
                } catch (colError) {
                    if (!colError.message.includes('already exists')) {
                        console.error('Error creating columns:', colError);
                    }
                }
            }

            let updateFields = [`status=$1`, `${hField}=$2`, `${rField}=$3`, `updated_at=CURRENT_TIMESTAMP`];
            let params = [status, handling || '', review || ''];
            let paramIdx = 4;
            
            if (replyDate !== undefined) {
                updateFields.splice(updateFields.length - 1, 0, `${replyField}=$${paramIdx}`);
                params.push(replyDate || '');
                paramIdx++;
            }
            if (responseDate !== undefined) {
                updateFields.splice(updateFields.length - 1, 0, `${respField}=$${paramIdx}`);
                params.push(responseDate || '');
                paramIdx++;
            }
            if (content !== undefined) { updateFields.push(`content=$${paramIdx}`); params.push(content); paramIdx++; }
            if (issueDate !== undefined) { updateFields.push(`issue_date=$${paramIdx}`); params.push(issueDate); paramIdx++; }
            if (number !== undefined) { updateFields.push(`number=$${paramIdx}`); params.push(number); paramIdx++; }
            if (year !== undefined) { updateFields.push(`year=$${paramIdx}`); params.push(year); paramIdx++; }
            if (unit !== undefined) { updateFields.push(`unit=$${paramIdx}`); params.push(unit); paramIdx++; }
            if (divisionName !== undefined) { updateFields.push(`division_name=$${paramIdx}`); params.push(divisionName); paramIdx++; }
            if (inspectionCategoryName !== undefined) { updateFields.push(`inspection_category_name=$${paramIdx}`); params.push(inspectionCategoryName); paramIdx++; }
            if (itemKindCode !== undefined) { updateFields.push(`item_kind_code=$${paramIdx}`); params.push(itemKindCode); paramIdx++; }
            if (planName !== undefined) { updateFields.push(`plan_name=$${paramIdx}`); params.push(planName); paramIdx++; }
            
            params.push(id);
            await pool.query(`UPDATE issues SET ${updateFields.join(', ')} WHERE id=$${paramIdx}`, params);
            const actionDetails = `更新開立事項：編號 ${issueNumber}，第 ${r} 次審查，狀態：${status}${content !== undefined ? '，內容已更新' : ''}${issueDate !== undefined ? '，開立日期已更新' : ''}${number !== undefined ? '，編號已更新' : ''}${year !== undefined ? '，年度已更新' : ''}${unit !== undefined ? '，機構已更新' : ''}${divisionName !== undefined ? '，分組已更新' : ''}${inspectionCategoryName !== undefined ? '，檢查種類已更新' : ''}${itemKindCode !== undefined ? '，類型已更新' : ''}${planName !== undefined ? '，檢查計畫已更新' : ''}`;
            logAction(req.session.user.username, 'UPDATE_ISSUE', actionDetails, req);
            res.json({ success: true });
        } catch (e) { 
            handleApiError(e, req, res, 'Update issue error');
        }
    });

    app.get('/api/issues/:id/editors', requireAuth, requireAdminOrManager, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

            const metaRes = await pool.query(
                "SELECT id, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM issues WHERE id=$1",
                [id]
            );
            if (metaRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
            const canEdit = await canEditByOwnership(
                { id: req.session.user.id, role: req.session.user.role },
                { ...metaRes.rows[0], __type: 'issue' },
                pool
            );
            if (!canEdit) return res.status(403).json({ error: 'Denied' });

            const r = await pool.query(
                `SELECT u.id, u.username, u.name, u.role,
                        COALESCE(BOOL_OR(g.is_admin_group = true), false) AS is_admin
                 FROM issue_editors ie
                 JOIN users u ON u.id = ie.user_id
                 LEFT JOIN user_groups ug ON ug.user_id = u.id
                 LEFT JOIN groups g ON g.id = ug.group_id
                 WHERE ie.issue_id = $1
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
            handleApiError(e, req, res, 'Get issue editors error');
        }
    });

    app.put('/api/issues/:id/editors', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const editorUserIdsRaw = req.body?.editorUserIds;
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
        const editorUserIds = Array.isArray(editorUserIdsRaw)
            ? Array.from(new Set(editorUserIdsRaw.map(x => parseInt(x, 10)).filter(n => Number.isFinite(n))))
            : [];
        try {
            const metaRes = await pool.query(
                "SELECT id, number, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM issues WHERE id=$1",
                [id]
            );
            if (metaRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
            const meta = metaRes.rows[0];
            const canEdit = await canEditByOwnership(
                { id: req.session.user.id, role: req.session.user.role },
                { ...meta, __type: 'issue' },
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
                await client.query("DELETE FROM issue_editors WHERE issue_id = $1", [id]);
                if (editorUserIds.length > 0) {
                    await client.query(
                        "INSERT INTO issue_editors (issue_id, user_id) SELECT $1, x FROM UNNEST($2::int[]) AS x ON CONFLICT DO NOTHING",
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
            logAction(req.session.user.username, 'UPDATE_ISSUE_EDITORS', `更新開立事項協作編修：編號 ${meta.number || `ID:${id}`}，共 ${editorUserIds.length} 人`, req).catch(()=>{});
            res.json({ success: true });
        } catch (e) {
            handleApiError(e, req, res, 'Update issue editors error');
        }
    });

    app.delete('/api/issues/:id', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        try {
            const issueRes = await pool.query(
                "SELECT id, number, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM issues WHERE id=$1",
                [req.params.id]
            );
            if (issueRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
            const issueNumber = issueRes.rows[0]?.number || `ID:${req.params.id}`;
            const canEdit = await canEditByOwnership(
                { id: req.session.user.id, role: req.session.user.role },
                { ...issueRes.rows[0], __type: 'issue' },
                pool
            );
            if (!canEdit) return res.status(403).json({ error: 'Denied' });
            
            await pool.query("DELETE FROM issues WHERE id=$1", [req.params.id]);
            logAction(req.session.user.username, 'DELETE_ISSUE', `刪除開立事項：編號 ${issueNumber}`, req);
            res.json({success:true});
        } catch (e) { 
            logError(e, 'Delete issue error', req).catch(() => {});
            res.status(500).json({ error: e.message }); 
        }
    });

    app.post('/api/issues/batch-delete', requireAuth, verifyCsrf, async (req, res) => {
        const isAdmin = await isAdminUser(req.session.user.id, pool);
        if (!(isAdmin || req.session.user.role === 'manager')) return res.status(403).json({error:'Denied'});
        const { ids } = req.body;
        try {
            if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });

            if (!isAdmin) {
                const rows = await pool.query(
                    "SELECT id, number, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM issues WHERE id = ANY($1)",
                    [ids]
                );
                const denied = [];
                for (const row of (rows.rows || [])) {
                    const ok = await canEditByOwnership(
                        { id: req.session.user.id, role: req.session.user.role },
                        { ...row, __type: 'issue' },
                        pool
                    );
                    if (!ok) denied.push(row.number || `ID:${row.id}`);
                }
                if (denied.length > 0) {
                    return res.status(403).json({ error: `Denied: ${denied.slice(0, 10).join(', ')}${denied.length > 10 ? '...' : ''}` });
                }
            }

            const issueRes = await pool.query("SELECT number FROM issues WHERE id = ANY($1)", [ids]);
            const numbers = issueRes.rows.map(r => r.number).filter(Boolean);
            const numberList = numbers.length > 0 ? numbers.join(', ') : `${ids.length} 筆`;
            
            await pool.query("DELETE FROM issues WHERE id = ANY($1)", [ids]);
            logAction(req.session.user.username, 'BATCH_DELETE_ISSUES', `批次刪除開立事項：${numberList} (共 ${ids.length} 筆)`, req);
            res.json({success:true});
        } catch (e) { 
            handleApiError(e, req, res, 'Batch delete issues error');
        }
    });

    app.post('/api/issues/import', requireAuth, requireAdminOrManager, verifyCsrf, async (req, res) => {
        const { data, round, reviewDate, replyDate, allowUpdate, ownerGroupId: ownerGroupIdInput, ownerGroupIds: ownerGroupIdsInput } = req.body;
        const r = parseInt(round) || 1;
        let client;
        try {
            client = await pool.connect();
            await client.query('BEGIN');
            const duplicateNumbers = [];
            const operationResults = [];
            let ownerGroupIds = Array.isArray(ownerGroupIdsInput)
                ? ownerGroupIdsInput.map(x => parseInt(x, 10)).filter(n => Number.isFinite(n))
                : (ownerGroupIdInput != null ? [parseInt(ownerGroupIdInput, 10)].filter(n => Number.isFinite(n)) : []);
            const isAdmin = await isAdminUser(req.session.user.id, client);
            if (!isAdmin) {
                const myGids = await getUserDataGroupIds(req.session.user.id, client);
                if (ownerGroupIds.length === 0) ownerGroupIds = myGids.length > 0 ? [myGids[0]] : [];
                const allInMy = ownerGroupIds.length > 0 && ownerGroupIds.every(gid => myGids.includes(gid));
                if (!allInMy) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({ error: 'Denied' });
                }
            } else {
                if (ownerGroupIds.length === 0) {
                    const primary = await getPrimaryGroupId(req.session.user.id, client);
                    if (primary != null) ownerGroupIds = [primary];
                }
                for (const gid of ownerGroupIds) {
                    const g = await client.query("SELECT 1 FROM groups WHERE id = $1 AND COALESCE(is_admin_group, false) = false LIMIT 1", [gid]);
                    if (g.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: '群組不存在' });
                    }
                }
            }
            if (ownerGroupIds.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: '請至少選擇一個適用群組' });
            }
            const ownerGroupId = ownerGroupIds[0];
            const ownerUserId = req.session.user.id;
            
            for (const item of data) {
                const trimmedNumber = (item.number || '').trim();
                const check = await client.query(
                    "SELECT id, content, owner_group_id, COALESCE(owner_group_ids, ARRAY[]::INTEGER[]) AS owner_group_ids, owner_user_id, edit_mode FROM issues WHERE TRIM(number) = $1",
                    [trimmedNumber]
                );
                if (check.rows.length > 0) {
                    if (r === 1 && !allowUpdate) {
                        const existingContent = (check.rows[0].content || '').trim();
                        const newContent = (item.content || '').trim();
                        if (existingContent !== '' && newContent !== '' && existingContent !== newContent) {
                            duplicateNumbers.push({ number: trimmedNumber, existingContent: existingContent });
                            continue;
                        }
                    }
                    
                    const canEdit = await canEditByOwnership(
                        { id: req.session.user.id, role: req.session.user.role },
                        { ...check.rows[0], __type: 'issue' },
                        client
                    );
                    if (!canEdit) {
                        operationResults.push({ number: trimmedNumber, action: 'skipped_no_permission' });
                        continue;
                    }

                    const hCol = r===1 ? 'handling' : `handling${r}`;
                    const rCol = r===1 ? 'review' : `review${r}`;
                    const replyCol = `reply_date_r${r}`;
                    const respCol = `response_date_r${r}`;
                    const itemReplyDate = item.replyDate || replyDate || '';
                    if (r === 1) {
                        await client.query(
                            `UPDATE issues SET 
                                status=$1, content=$2, ${hCol}=$3, ${rCol}=$4, ${replyCol}=$5, ${respCol}=$6,
                                plan_name=COALESCE($7, plan_name), issue_date=COALESCE($8, issue_date),
                                year=COALESCE($9, year), unit=COALESCE($10, unit),
                                division_name=COALESCE($11, division_name),
                                inspection_category_name=COALESCE($12, inspection_category_name),
                                item_kind_code=COALESCE($13, item_kind_code),
                                updated_at=CURRENT_TIMESTAMP 
                            WHERE TRIM(number)=$14`,
                            [
                                item.status, item.content, item.handling||'', item.review||'', 
                                itemReplyDate, reviewDate||'', item.planName || null, item.issueDate || null,
                                item.year || null, item.unit || null,
                                item.divisionName || null, item.inspectionCategoryName || null,
                                item.itemKindCode || null, trimmedNumber
                            ]
                        );
                        operationResults.push({ number: trimmedNumber, action: 'updated' });
                    } else {
                        await client.query(
                            `UPDATE issues SET 
                                status=$1, ${hCol}=$2, ${rCol}=$3, ${replyCol}=$4, ${respCol}=$5,
                                plan_name=COALESCE($6, plan_name), updated_at=CURRENT_TIMESTAMP 
                            WHERE TRIM(number)=$7`,
                            [item.status, item.handling||'', item.review||'', itemReplyDate, reviewDate||'', item.planName || null, trimmedNumber]
                        );
                        operationResults.push({ number: trimmedNumber, action: 'updated' });
                    }
                } else {
                    const itemReplyDate = item.replyDate || replyDate || '';
                    await client.query(
                        `INSERT INTO issues (
                            number, year, unit, content, status, item_kind_code, division_name, inspection_category_name,
                            handling, review, plan_name, issue_date, response_date_r1, reply_date_r1,
                            owner_group_id, owner_group_ids, owner_user_id, edit_mode
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
                        [
                            trimmedNumber, item.year, item.unit, item.content, item.status||'持續列管',
                            item.itemKindCode, item.divisionName, item.inspectionCategoryName,
                            item.handling||'', item.review||'', item.planName || null, item.issueDate || null, 
                            reviewDate || '', itemReplyDate,
                            ownerGroupId, ownerGroupIds, ownerUserId, 'GROUP'
                        ]
                    );
                    operationResults.push({ number: trimmedNumber, action: 'created' });
                }
            }
            
            if (duplicateNumbers.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: '編號重複',
                    message: `以下編號已存在且內容不同：${duplicateNumbers.map(d => d.number).join(', ')}`,
                    duplicates: duplicateNumbers
                });
            }
            
            await client.query('COMMIT');
            
            let newCount = 0, updateCount = 0;
            const results = operationResults.map(op => {
                if (op.action === 'created') newCount++;
                else if (op.action === 'updated') updateCount++;
                return op;
            });
            
            const roundInfo = r > 1 ? `，第 ${r} 次審查` : '，初次開立';
            const planInfo = data[0]?.planName ? `，檢查計畫：${data[0].planName}` : '';
            logAction(req.session.user.username, 'IMPORT_ISSUES', `匯入開立事項：共 ${data.length} 筆（新增 ${newCount} 筆，更新 ${updateCount} 筆）${roundInfo}${planInfo}`, req);
            res.json({ 
                success: true, 
                count: data.length,
                newCount: newCount,
                updateCount: updateCount,
                skippedNoPermission: operationResults.filter(o => o.action === 'skipped_no_permission').length,
                results: results
            });
        } catch (e) {
            try { if (client) await client.query('ROLLBACK'); } catch (_) {}
            handleApiError(e, req, res, 'Import issues error');
        } finally {
            if (client) client.release();
        }
    });
};
