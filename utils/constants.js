const RAILWAY_CODES = { T: '臺鐵', H: '高鐵', A: '林鐵', S: '糖鐵' };
const INSPECTION_CODES = { '1': '年度定期檢查', '2': '特別檢查', '3': '例行性檢查', '4': '臨時檢查', '5': '調查' };
const BUSINESS_CODES = { OP: '運轉', CV: '土建', ME: '機務', EL: '電務', SM: '安全管理', AD: '營運', OT: '其他' };

function getPlanScheduleLockKey(year3, railwayCode, inspectionType) {
    return `plan-schedule|${year3}|${railwayCode}|${inspectionType}`;
}

async function getNextAvailableScheduleSeq(db, year3, railwayCode, inspectionType, excludeId = null) {
    const params = [year3, railwayCode, inspectionType];
    let sql = `
        SELECT inspection_seq
        FROM inspection_plan_schedule
        WHERE year = $1 AND railway = $2 AND inspection_type = $3
          AND inspection_seq <> '00'
    `;
    if (excludeId != null) {
        sql += ` AND id <> $4`;
        params.push(excludeId);
    }
    const r = await db.query(sql, params);
    const used = new Set();
    for (const row of (r.rows || [])) {
        const s = String(row.inspection_seq || '').trim();
        if (!s) continue;
        const n = parseInt(s, 10);
        if (Number.isFinite(n) && n > 0) used.add(n);
    }
    let next = 1;
    while (used.has(next)) next++;
    return String(next).padStart(2, '0');
}

module.exports = {
    RAILWAY_CODES,
    INSPECTION_CODES,
    BUSINESS_CODES,
    getPlanScheduleLockKey,
    getNextAvailableScheduleSeq,
};
