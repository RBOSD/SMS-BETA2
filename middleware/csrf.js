const csrf = require('csrf');
const { logError } = require('../utils/log');

const csrfProtection = new csrf();

const getCsrfToken = (req, res, next) => {
    if (!req.session.csrfSecret) {
        req.session.csrfSecret = csrfProtection.secretSync();
    }
    req.csrfToken = csrfProtection.create(req.session.csrfSecret);
    next();
};

const verifyCsrf = (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    
    try {
        const token = req.headers['x-csrf-token'] || req.body._csrf;
        const secret = req.session.csrfSecret;
        
        if (!secret || !token) {
            return res.status(403).json({ error: 'CSRF token missing' });
        }
        
        if (!csrfProtection.verify(secret, token)) {
            return res.status(403).json({ error: 'Invalid CSRF token' });
        }
        
        next();
    } catch (e) {
        console.error('CSRF verification error:', e);
        logError(e, 'CSRF verification error', req).catch(() => {});
        return res.status(500).json({ error: 'CSRF verification failed' });
    }
};

module.exports = {
    csrfProtection,
    getCsrfToken,
    verifyCsrf,
};
