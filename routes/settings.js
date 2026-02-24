const { pool } = require('../config/pool');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { handleApiError } = require('../utils/handleApiError');

async function ensureSystemSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const r = await pool.query("SELECT 1 FROM system_settings WHERE key = 'ai_enabled'");
  if (r.rows.length === 0) {
    await pool.query("INSERT INTO system_settings (key, value) VALUES ('ai_enabled', 'true')");
  }
}

async function getAiEnabled() {
  try {
    const r = await pool.query("SELECT value FROM system_settings WHERE key = 'ai_enabled'");
    const val = r.rows[0]?.value;
    return val === 'true' || val === '1';
  } catch (e) {
    if (e.code === '42P01' || (e.message && e.message.includes('does not exist'))) {
      await ensureSystemSettingsTable();
      return true;
    }
    throw e;
  }
}

module.exports = function registerSettingsRoutes(app) {
  app.get('/api/settings', requireAuth, async (req, res) => {
    try {
      await ensureSystemSettingsTable();
      const aiEnabled = await getAiEnabled();
      res.json({ aiEnabled });
    } catch (e) {
      handleApiError(e, req, res, 'Get settings error');
    }
  });

  app.put('/api/settings', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
    const { aiEnabled } = req.body;
    try {
      await ensureSystemSettingsTable();
      const val = aiEnabled === true || aiEnabled === 'true' ? 'true' : 'false';
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('ai_enabled', $1, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
        [val]
      );
      res.json({ aiEnabled: val === 'true' });
    } catch (e) {
      handleApiError(e, req, res, 'Update settings error');
    }
  });
};

module.exports.getAiEnabled = getAiEnabled;
