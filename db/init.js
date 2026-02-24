const bcrypt = require('bcryptjs');
const { pool } = require('../config/pool');

async function initDB() {
    let retries = 5;
    while (retries > 0) {
        try {
            const client = await pool.connect();
            try {
                console.log('Connected to PostgreSQL. Checking schema...');

                // Session Table
                await client.query(`
                    CREATE TABLE IF NOT EXISTS session (
                        sid varchar NOT NULL COLLATE "default",
                        sess json NOT NULL,
                        expire timestamp(6) NOT NULL
                    ) WITH (OIDS=FALSE);
                `);
                try {
                    await client.query(`ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE`);
                } catch (e) {}
                try {
                    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire)`);
                } catch (e) {}

                // Issues Table
                await client.query(`CREATE TABLE IF NOT EXISTS issues (
                    id SERIAL PRIMARY KEY,
                    number TEXT UNIQUE,
                    year TEXT,
                    unit TEXT,
                    content TEXT,
                    status TEXT,
                    item_kind_code TEXT,
                    division_name TEXT,
                    inspection_category_name TEXT,
                    category TEXT,
                    handling TEXT,
                    review TEXT,
                    plan_name TEXT,
                    issue_date TEXT,
                    owner_group_id INTEGER,
                    owner_user_id INTEGER,
                    edit_mode TEXT DEFAULT 'GROUP',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);

                // Users Table
                await client.query(`CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE,
                    password TEXT,
                    name TEXT,
                    role TEXT DEFAULT 'viewer',
                    must_change_password BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);
                
                try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true`); } catch (e) {}
                try { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false`); } catch (e) {}
                try { await client.query(`UPDATE users SET role = 'manager' WHERE role = 'editor'`); } catch (e) {}

                // Groups / User groups (多群組隸屬)
                await client.query(`CREATE TABLE IF NOT EXISTS groups (
                    id SERIAL PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    is_admin_group BOOLEAN DEFAULT false,
                    allow_all_edit BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);
                try { await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_admin_group BOOLEAN DEFAULT false`); } catch (e) {}
                try { await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS allow_all_edit BOOLEAN DEFAULT false`); } catch (e) {}
                try {
                    await client.query(`
                        CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_admin_group_true
                        ON groups ((is_admin_group))
                        WHERE is_admin_group = true
                    `);
                } catch (e) {}
                await client.query(`CREATE TABLE IF NOT EXISTS user_groups (
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, group_id)
                )`);

                await client.query(`CREATE TABLE IF NOT EXISTS issue_editors (
                    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (issue_id, user_id)
                )`);

                await client.query(`CREATE TABLE IF NOT EXISTS inspection_plan_schedule (
                    id SERIAL PRIMARY KEY,
                    start_date DATE,
                    end_date DATE,
                    plan_name TEXT NOT NULL,
                    year TEXT NOT NULL,
                    plan_type TEXT,
                    railway TEXT NOT NULL,
                    inspection_type TEXT NOT NULL,
                    business TEXT,
                    inspection_seq TEXT NOT NULL,
                    plan_number TEXT NOT NULL,
                    location TEXT,
                    inspector TEXT,
                    owner_group_id INTEGER,
                    owner_user_id INTEGER,
                    edit_mode TEXT DEFAULT 'GROUP',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);

                await client.query(`CREATE TABLE IF NOT EXISTS plan_editors (
                    plan_id INTEGER NOT NULL REFERENCES inspection_plan_schedule(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (plan_id, user_id)
                )`);
                try { await client.query(`ALTER TABLE inspection_plan_schedule ALTER COLUMN start_date DROP NOT NULL`); } catch (e) {}
                try { await client.query(`ALTER TABLE inspection_plan_schedule ALTER COLUMN business DROP NOT NULL`); } catch (e) {}
                try { await client.query(`ALTER TABLE inspection_plan_schedule ADD COLUMN IF NOT EXISTS plan_type TEXT`); } catch (e) {}
                try { await client.query(`ALTER TABLE inspection_plan_schedule ADD COLUMN IF NOT EXISTS location TEXT`); } catch (e) {}
                try { await client.query(`ALTER TABLE inspection_plan_schedule ADD COLUMN IF NOT EXISTS inspector TEXT`); } catch (e) {}
                try {
                    await client.query(`ALTER TABLE inspection_plan_schedule ADD COLUMN IF NOT EXISTS start_date DATE`);
                    await client.query(`ALTER TABLE inspection_plan_schedule ADD COLUMN IF NOT EXISTS end_date DATE`);
                    await client.query(`UPDATE inspection_plan_schedule SET start_date = scheduled_date WHERE start_date IS NULL AND scheduled_date IS NOT NULL`);
                } catch (e) {}
                try { await client.query(`ALTER TABLE inspection_plan_schedule DROP COLUMN IF EXISTS scheduled_date`); } catch (e) {}
                try { await client.query(`DROP INDEX IF EXISTS idx_schedule_date`); } catch (e) {}
                try {
                    await client.query(`CREATE INDEX IF NOT EXISTS idx_schedule_start_date ON inspection_plan_schedule(start_date)`);
                    await client.query(`CREATE INDEX IF NOT EXISTS idx_schedule_year ON inspection_plan_schedule(year)`);
                } catch (e) {}
                try {
                    await client.query(`
                        CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_seq
                        ON inspection_plan_schedule(year, railway, inspection_type, inspection_seq)
                        WHERE inspection_seq <> '00'
                    `);
                } catch (e) {
                    console.warn('Create uq_schedule_seq index warning:', e?.message || e);
                }
                await client.query(`ALTER TABLE inspection_plan_schedule ADD COLUMN IF NOT EXISTS planned_count INTEGER`);

                try {
                    const hasPlans = await client.query(
                        "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inspection_plans'"
                    );
                    if (hasPlans.rows.length > 0) {
                        const planRows = await client.query("SELECT name, year, created_at FROM inspection_plans");
                        for (const r of planRows.rows || []) {
                            const n = (r.name || '').trim();
                            const y = (r.year || '').trim();
                            if (!n) continue;
                            const ex = await client.query(
                                "SELECT 1 FROM inspection_plan_schedule WHERE plan_name = $1 AND year = $2 LIMIT 1",
                                [n, y]
                            );
                            if (ex.rows.length > 0) continue;
                            const sd = r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '2000-01-01';
                            await client.query(
                                `INSERT INTO inspection_plan_schedule (start_date, end_date, plan_name, year, railway, inspection_type, business, inspection_seq, plan_number)
                                 VALUES ($1, NULL, $2, $3, '-', '-', '-', '00', '(手動)')`,
                                [sd, n, y]
                            );
                        }
                        await client.query(`DROP TABLE IF EXISTS inspection_plans CASCADE`);
                    }
                } catch (e) {
                    console.warn('inspection_plans migration warning:', e?.message || e);
                }

                await client.query(`CREATE TABLE IF NOT EXISTS logs (
                    id SERIAL PRIMARY KEY,
                    username TEXT,
                    action TEXT,
                    details TEXT,
                    ip_address TEXT,
                    login_time TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);

                await client.query(`CREATE TABLE IF NOT EXISTS app_files (
                    key TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    mime TEXT NOT NULL,
                    data BYTEA NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);

                await client.query(`CREATE TABLE IF NOT EXISTS system_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);
                try {
                    await client.query(`INSERT INTO system_settings (key, value) VALUES ('ai_enabled', 'true') ON CONFLICT (key) DO NOTHING`);
                } catch (e) {}

                const newColumns = [];
                for (let i = 2; i <= 30; i++) {
                    newColumns.push({ name: `handling${i}`, type: 'TEXT' });
                    newColumns.push({ name: `review${i}`, type: 'TEXT' });
                }
                for (let i = 1; i <= 30; i++) {
                    newColumns.push({ name: `reply_date_r${i}`, type: 'TEXT' });
                    newColumns.push({ name: `response_date_r${i}`, type: 'TEXT' });
                }
                newColumns.push({ name: 'plan_name', type: 'TEXT' });
                newColumns.push({ name: 'issue_date', type: 'TEXT' });
                for (const col of newColumns) {
                    try {
                        await client.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
                    } catch (e) { }
                }

                try { await client.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS owner_group_id INTEGER`); } catch (e) {}
                try { await client.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS owner_group_ids INTEGER[]`); } catch (e) {}
                try { await client.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS owner_user_id INTEGER`); } catch (e) {}
                try { await client.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS edit_mode TEXT DEFAULT 'GROUP'`); } catch (e) {}
                try { await client.query(`ALTER TABLE inspection_plan_schedule ADD COLUMN IF NOT EXISTS owner_group_id INTEGER`); } catch (e) {}
                try { await client.query(`ALTER TABLE inspection_plan_schedule ADD COLUMN IF NOT EXISTS owner_group_ids INTEGER[]`); } catch (e) {}
                try { await client.query(`ALTER TABLE inspection_plan_schedule ADD COLUMN IF NOT EXISTS owner_user_id INTEGER`); } catch (e) {}
                try { await client.query(`ALTER TABLE inspection_plan_schedule ADD COLUMN IF NOT EXISTS edit_mode TEXT DEFAULT 'GROUP'`); } catch (e) {}

                const userRes = await client.query("SELECT count(*) as count FROM users");
                if (parseInt(userRes.rows[0].count) === 0) {
                    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 
                        require('crypto').randomBytes(16).toString('hex');
                    const hash = bcrypt.hashSync(defaultPassword, 10);
                    await client.query("INSERT INTO users (username, password, name, role, must_change_password) VALUES ($1, $2, $3, $4, $5)", 
                        ['admin', hash, '系統管理員', 'manager', true]);
                    console.log("===========================================");
                    console.log("警告: 已建立預設管理員帳號");
                    console.log("帳號: admin");
                    console.log("密碼: " + (process.env.DEFAULT_ADMIN_PASSWORD ? "使用環境變數設定" : defaultPassword));
                    console.log("請立即登入並修改密碼！");
                    console.log("===========================================");
                }

                try {
                    let adminGroupId = null;
                    const agRes = await client.query("SELECT id FROM groups WHERE is_admin_group = true ORDER BY id ASC LIMIT 1");
                    adminGroupId = agRes.rows[0]?.id || null;
                    if (!adminGroupId) {
                        const ins = await client.query(
                            "INSERT INTO groups (name, is_admin_group) VALUES ($1, true) ON CONFLICT (name) DO UPDATE SET is_admin_group = true RETURNING id",
                            ['系統管理群組']
                        );
                        adminGroupId = ins.rows[0]?.id || null;
                    }

                    let defaultGroupId = null;
                    const gRes = await client.query("SELECT id FROM groups WHERE is_admin_group = false ORDER BY id ASC LIMIT 1");
                    defaultGroupId = gRes.rows[0]?.id || null;
                    if (!defaultGroupId) {
                        const ins = await client.query("INSERT INTO groups (name, is_admin_group) VALUES ($1, false) RETURNING id", ['預設群組']);
                        defaultGroupId = ins.rows[0]?.id || null;
                    }

                    try {
                        if (adminGroupId) {
                            const legacyAdmins = await client.query("SELECT id FROM users WHERE role = 'admin'");
                            for (const row of (legacyAdmins.rows || [])) {
                                const uid = row?.id;
                                if (!uid) continue;
                                await client.query(
                                    "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                                    [uid, adminGroupId]
                                );
                            }
                        }
                        await client.query("UPDATE users SET role = 'manager' WHERE role = 'admin'");
                    } catch (e) {
                        console.warn('Legacy admin migration warning:', e?.message || e);
                    }

                    const aRes = await client.query("SELECT id FROM users WHERE username = $1 LIMIT 1", ['admin']);
                    const adminId = aRes.rows[0]?.id;
                    if (adminId && adminGroupId) {
                        await client.query(
                            "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                            [adminId, adminGroupId]
                        );
                    }
                    if (adminId && defaultGroupId) {
                        await client.query(
                            "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                            [adminId, defaultGroupId]
                        );
                    }
                } catch (e) {
                    console.warn('Default group/admin mapping warning:', e?.message || e);
                }
                
                console.log('Database initialized successfully.');
                return;

            } catch (err) {
                console.error('Init DB Schema Error:', err);
                throw err;
            } finally {
                client.release();
            }
        } catch (connErr) {
            console.error(`Connection failed, retrying... (${retries} left)`, connErr.message);
            retries--;
            await new Promise(res => setTimeout(res, 2000));
        }
    }
    throw new Error('Could not connect to database after multiple retries.');
}

module.exports = { initDB };
