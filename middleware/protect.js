const { isAdminUser } = require('../db/helpers');
const { pool } = require('../config/pool');

const protectHtmlPages = (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    
    if (req.path === '/login.html' || req.path === '/login') {
        return next();
    }
    
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return next();
    }
    
    if (req.path === '/' || req.path.endsWith('.html')) {
        if (!req.session || !req.session.user) {
            return res.redirect('/login.html');
        }
    }
    
    next();
};

const protectViewTemplates = (req, res, next) => {
    if (!(req.path && req.path.startsWith('/views/') && req.path.endsWith('.html'))) {
        return next();
    }

    (async () => {
        const userId = req.session?.user?.id;
        const role = req.session?.user?.role;
        let isAdmin = false;
        try {
            if (userId) isAdmin = await isAdminUser(userId, pool);
        } catch (e) {
            isAdmin = false;
        }

        const deny = () =>
            res.status(403).send(
                `<div style="padding:24px;font-family:system-ui,'Noto Sans TC',sans-serif;color:#0f172a;">
                    <h3 style="margin:0 0 8px 0;">權限不足</h3>
                    <div style="color:#64748b;font-size:14px;line-height:1.6;">
                        您沒有權限存取此管理頁面。
                    </div>
                </div>`
            );

        if (req.path === '/views/users-view.html') {
            return isAdmin ? next() : deny();
        }
        if (req.path === '/views/import-view.html' || req.path === '/views/plans-view.html') {
            return (isAdmin || role === 'manager') ? next() : deny();
        }
        return next();
    })().catch(() => {
        return res.status(403).send(
            `<div style="padding:24px;font-family:system-ui,'Noto Sans TC',sans-serif;color:#0f172a;">
                <h3 style="margin:0 0 8px 0;">權限不足</h3>
                <div style="color:#64748b;font-size:14px;line-height:1.6;">
                    您沒有權限存取此管理頁面。
                </div>
            </div>`
        );
    });
};

module.exports = {
    protectHtmlPages,
    protectViewTemplates,
};
