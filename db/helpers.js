const { pool } = require('../config/pool');

// --- Admin group helpers ---
async function isAdminUser(userId, db = pool) {
    const id = userId != null ? parseInt(userId, 10) : null;
    if (!Number.isFinite(id)) return false;
    const r = await db.query(
        `SELECT 1
         FROM user_groups ug
         JOIN groups g ON g.id = ug.group_id
         WHERE ug.user_id = $1 AND g.is_admin_group = true
         LIMIT 1`,
        [id]
    );
    return (r.rows || []).length > 0;
}

// --- Groups / record-level authorization helpers ---
async function getUserGroupIds(userId, db = pool) {
    const r = await db.query('SELECT group_id FROM user_groups WHERE user_id = $1', [userId]);
    return (r.rows || []).map(x => parseInt(x.group_id, 10)).filter(n => Number.isFinite(n));
}

async function getUserDataGroupIds(userId, db = pool) {
    const r = await db.query(
        `SELECT ug.group_id
         FROM user_groups ug
         JOIN groups g ON g.id = ug.group_id
         WHERE ug.user_id = $1 AND COALESCE(g.is_admin_group, false) = false
         ORDER BY ug.group_id ASC`,
        [userId]
    );
    return (r.rows || []).map(x => parseInt(x.group_id, 10)).filter(n => Number.isFinite(n));
}

async function getPrimaryGroupId(userId, db = pool) {
    const r = await db.query(
        `SELECT ug.group_id
         FROM user_groups ug
         JOIN groups g ON g.id = ug.group_id
         WHERE ug.user_id = $1 AND COALESCE(g.is_admin_group, false) = false
         ORDER BY ug.group_id ASC
         LIMIT 1`,
        [userId]
    );
    const gid = r.rows[0]?.group_id;
    const n = gid != null ? parseInt(gid, 10) : null;
    return Number.isFinite(n) ? n : null;
}

async function isIssueEditor(userId, issueId, db = pool) {
    const uid = userId != null ? parseInt(userId, 10) : null;
    const iid = issueId != null ? parseInt(issueId, 10) : null;
    if (!Number.isFinite(uid) || !Number.isFinite(iid)) return false;
    const r = await db.query(
        "SELECT 1 FROM issue_editors WHERE issue_id = $1 AND user_id = $2 LIMIT 1",
        [iid, uid]
    );
    return (r.rows || []).length > 0;
}

async function isPlanEditorByPlanId(userId, planId, db = pool) {
    const uid = userId != null ? parseInt(userId, 10) : null;
    const pid = planId != null ? parseInt(planId, 10) : null;
    if (!Number.isFinite(uid) || !Number.isFinite(pid)) return false;
    const r = await db.query(
        "SELECT 1 FROM plan_editors WHERE plan_id = $1 AND user_id = $2 LIMIT 1",
        [pid, uid]
    );
    return (r.rows || []).length > 0;
}

async function isPlanEditorByPlanNameYear(userId, planName, year, db = pool) {
    const uid = userId != null ? parseInt(userId, 10) : null;
    if (!Number.isFinite(uid)) return false;
    const n = String(planName || '').trim();
    const y = String(year || '').trim();
    if (!n || !y) return false;
    const r = await db.query(
        `SELECT 1
         FROM inspection_plan_schedule h
         JOIN plan_editors pe ON pe.plan_id = h.id
         WHERE h.plan_name = $1 AND h.year = $2 AND h.inspection_seq = '00'
           AND pe.user_id = $3
         LIMIT 1`,
        [n, y, uid]
    );
    return (r.rows || []).length > 0;
}

async function canEditByOwnership(user, record, db = pool) {
    if (!user || !user.id) return false;
    try {
        if (user.isAdmin === true) return true;
        if (user.role === 'admin') return true;
        const ok = await isAdminUser(user.id, db);
        if (ok) return true;
    } catch (e) {}

    const ownerUserId = record?.owner_user_id != null ? parseInt(record.owner_user_id, 10) : null;
    const ownerGroupId = record?.owner_group_id != null ? parseInt(record.owner_group_id, 10) : null;
    const mode = String(record?.edit_mode || 'GROUP').toUpperCase();
    const recType = String(record?.__type || '').trim();
    const recId = record?.id != null ? parseInt(record.id, 10) : null;

    if (ownerUserId && user.id === ownerUserId) return true;

    if (mode === 'OWNER_ONLY') {
        return ownerUserId != null && user.id === ownerUserId;
    }

    try {
        if (recType === 'issue' && Number.isFinite(recId)) {
            if (await isIssueEditor(user.id, recId, db)) return true;
        }
        if (recType === 'plan_header' && Number.isFinite(recId)) {
            if (await isPlanEditorByPlanId(user.id, recId, db)) return true;
        }
        if (recType === 'schedule') {
            const pn = record?.plan_name;
            const py = record?.year;
            if (await isPlanEditorByPlanNameYear(user.id, pn, py, db)) return true;
        }
    } catch (e) {}

    const ownerGroupIds = Array.isArray(record?.owner_group_ids) && record.owner_group_ids.length > 0
        ? record.owner_group_ids.map(x => parseInt(x, 10)).filter(n => Number.isFinite(n))
        : (ownerGroupId != null ? [ownerGroupId] : []);
    if (ownerGroupIds.length === 0) return true;

    const gids = await getUserGroupIds(user.id, db);
    return ownerGroupIds.some(gid => gids.includes(gid));
}

module.exports = {
    pool,
    isAdminUser,
    getUserGroupIds,
    getUserDataGroupIds,
    getPrimaryGroupId,
    isIssueEditor,
    isPlanEditorByPlanId,
    isPlanEditorByPlanNameYear,
    canEditByOwnership,
};
