const { pool, isAdminUser } = require('../db/helpers');

const requireAdmin = async (req, res, next) => {
    try {
        if (!req.session || !req.session.user) return res.status(403).json({ error: 'Denied' });
        const ok = await isAdminUser(req.session.user.id, pool);
        if (!ok) return res.status(403).json({ error: 'Denied' });
        return next();
    } catch (e) {
        return res.status(403).json({ error: 'Denied' });
    }
};

const requireAdminOrManager = async (req, res, next) => {
    try {
        if (!req.session || !req.session.user) return res.status(403).json({ error: 'Denied' });
        const role = req.session.user.role;
        if (role === 'manager') return next();
        const ok = await isAdminUser(req.session.user.id, pool);
        if (!ok) return res.status(403).json({ error: 'Denied' });
        return next();
    } catch (e) {
        return res.status(403).json({ error: 'Denied' });
    }
};

const requireAuth = (req, res, next) => {
    try {
        if (req.session && req.session.user) {
            next();
        } else {
            console.warn('[AUTH] Unauthorized request to:', req.path, 'Session:', !!req.session);
            if (!res.headersSent) {
                res.status(401).json({ error: 'Unauthorized' });
            }
        }
    } catch (e) {
        console.error('[AUTH] Error in requireAuth middleware:', e);
        process.stderr.write(`[AUTH] ERROR: ${e.message}\n`);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Authentication check failed',
                message: e.message,
                code: e.code
            });
        }
    }
};

module.exports = {
    requireAuth,
    requireAdmin,
    requireAdminOrManager,
};
