const { pool } = require('../config/pool');
const { requireAuth } = require('../middleware/auth');
const { handleApiError } = require('../utils/handleApiError');

module.exports = function registerOptionsRoutes(app) {
    app.get('/api/options/plans', requireAuth, async (req, res) => {
        try {
            const { withIssues, year: yearFilter } = req.query;
            const yearParam = yearFilter ? [String(yearFilter).trim()] : [];
            let planResult;
            try {
                if (withIssues === 'true') {
                    const params = yearParam.length ? yearParam : [];
                    const whereYear = yearParam.length ? ` AND s.year = $1` : '';
                    planResult = await pool.query(`
                        SELECT DISTINCT s.plan_name AS name, s.year 
                        FROM inspection_plan_schedule s
                        INNER JOIN issues i ON i.plan_name = s.plan_name AND i.year = s.year
                        WHERE s.plan_name IS NOT NULL AND s.plan_name != ''
                            AND i.plan_name IS NOT NULL AND i.plan_name != ''
                            AND i.year IS NOT NULL AND i.year != ''
                            AND s.year IS NOT NULL AND s.year != ''
                            ${whereYear}
                        ORDER BY s.year DESC, s.plan_name ASC
                    `, params);
                } else {
                    const params = yearParam.length ? yearParam : [];
                    const whereYear = yearParam.length ? ` AND year = $1` : '';
                    planResult = await pool.query(`
                        SELECT DISTINCT plan_name AS name, year 
                        FROM inspection_plan_schedule 
                        WHERE plan_name IS NOT NULL AND plan_name != ''
                            AND year IS NOT NULL AND year != ''
                            ${whereYear}
                        ORDER BY year DESC, plan_name ASC
                    `, params);
                }
            } catch (queryError) {
                console.error('Database query error in /api/options/plans:', queryError);
                return res.status(500).json({ error: '查詢資料庫時發生錯誤', details: queryError.message });
            }
            res.set('Cache-Control', 'no-store');
            const plans = (planResult?.rows || [])
                .filter(r => r && r.name && String(r.name).trim() !== '')
                .map(r => {
                    const name = String(r.name || '').trim();
                    const year = String(r.year || '').trim();
                    return {
                        name,
                        year,
                        display: `${name}${year ? ` (${year})` : ''}`,
                        value: `${name}|||${year}`
                    };
                });
            res.json({ data: plans });
        } catch (e) {
            console.error('Get plan options error:', e);
            handleApiError(e, req, res, 'Get plan options error');
        }
    });

    app.get('/api/plans/dashboard-stats/years', requireAuth, async (req, res) => {
        try {
            const yearRes = await pool.query(`
                SELECT DISTINCT year FROM inspection_plan_schedule 
                WHERE year IS NOT NULL AND year != '' 
                ORDER BY year DESC
            `);
            const years = (yearRes.rows || []).map(r => String(r.year || '').trim()).filter(Boolean);
            res.json({ years });
        } catch (e) {
            handleApiError(e, req, res, 'Get dashboard years error');
        }
    });

    app.get('/api/plans/dashboard-stats', requireAuth, async (req, res) => {
        try {
            let selectedYear = req.query.year;
            if (!selectedYear) {
                selectedYear = String(new Date().getFullYear() - 1911).replace(/\D/g, '').slice(-3).padStart(3, '0');
            } else {
                selectedYear = String(selectedYear).replace(/\D/g, '').slice(-3).padStart(3, '0');
            }
            const thisYear = selectedYear;
            const planCountRes = await pool.query(`
                SELECT count(*) AS cnt FROM (
                    SELECT plan_name, year FROM inspection_plan_schedule WHERE year = $1 GROUP BY plan_name, year
                ) g
            `, [thisYear]);
            const totalPlans = parseInt(planCountRes.rows[0]?.cnt, 10) || 0;
            const scheduleCountRes = await pool.query(`
                SELECT count(*) AS cnt FROM inspection_plan_schedule 
                WHERE (plan_number IS NULL OR plan_number <> '(手動)') AND year = $1
            `, [thisYear]);
            const totalSchedules = parseInt(scheduleCountRes.rows[0]?.cnt, 10) || 0;
            const withIssuesRes = await pool.query(`
                SELECT count(*) AS cnt FROM (
                    SELECT DISTINCT s.plan_name, s.year
                    FROM inspection_plan_schedule s
                    INNER JOIN issues i ON i.plan_name = s.plan_name AND i.year = s.year
                    WHERE s.year = $1
                ) t
            `, [thisYear]);
            const withIssues = parseInt(withIssuesRes.rows[0]?.cnt, 10) || 0;
            const byTypeRes = await pool.query(`
                SELECT inspection_type AS type, count(*) AS cnt FROM inspection_plan_schedule 
                WHERE (plan_number IS NULL OR plan_number <> '(手動)') AND year = $1
                GROUP BY inspection_type ORDER BY inspection_type
            `, [thisYear]);
            const byType = {};
            (byTypeRes.rows || []).forEach(r => { byType[String(r.type || '').trim()] = parseInt(r.cnt, 10) || 0; });
            const progressRes = await pool.query(`
                WITH g AS (
                    SELECT plan_name AS name, year, MIN(id) AS min_id
                    FROM inspection_plan_schedule WHERE year = $1 GROUP BY plan_name, year
                ),
                header AS (
                    SELECT plan_name, year, planned_count FROM inspection_plan_schedule WHERE inspection_seq = '00' AND year = $1
                ),
                schedule_counts AS (
                    SELECT plan_name, year, COUNT(*) AS cnt FROM inspection_plan_schedule 
                    WHERE (plan_number IS NULL OR plan_number <> '(手動)') AND year = $1 GROUP BY plan_name, year
                )
                SELECT g.name, g.year, h.planned_count, COALESCE(sc.cnt, 0) AS schedule_count
                FROM g
                LEFT JOIN header h ON h.plan_name = g.name AND h.year = g.year
                LEFT JOIN schedule_counts sc ON sc.plan_name = g.name AND sc.year = g.year
                ORDER BY COALESCE(sc.cnt, 0) DESC
            `, [thisYear]);
            const planProgress = (progressRes.rows || []).map(r => ({
                name: r.name,
                year: r.year,
                planned_count: r.planned_count != null ? parseInt(r.planned_count, 10) : null,
                schedule_count: parseInt(r.schedule_count, 10) || 0
            }));
            const plannedSumRes = await pool.query(`
                SELECT COALESCE(SUM(CAST(planned_count AS INTEGER)), 0) AS total
                FROM inspection_plan_schedule WHERE year = $1 AND inspection_seq = '00' AND planned_count IS NOT NULL
            `, [thisYear]);
            const totalPlanned = parseInt(plannedSumRes.rows[0]?.total, 10) || 0;
            res.json({
                year: thisYear,
                totalPlans,
                totalSchedules,
                totalPlanned,
                withIssues,
                byType,
                planProgress
            });
        } catch (e) {
            handleApiError(e, req, res, 'Dashboard stats error');
        }
    });
};
