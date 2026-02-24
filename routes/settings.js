const { pool } = require('../config/pool');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { handleApiError } = require('../utils/handleApiError');

async function getAiEnabled() {
  const r = await pool.query("SELECT value FROM system_settings WHERE key = 'ai_enabled'");
  const val = r.rows[0]?.value;
  return val === 'true' || val === '1';
}

module.exports = function registerSettingsRoutes(app) {
  app.get('/api/settings', requireAuth, async (req, res) => {
    try {
      const aiEnabled = await getAiEnabled();
      res.json({ aiEnabled });
    } catch (e) {
      handleApiError(e, req, res, 'Get settings error');
    }
  });

  app.put('/api/settings', requireAuth, requireAdmin, verifyCsrf, async (req, res) => {
    const { aiEnabled } = req.body;
    try {
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
