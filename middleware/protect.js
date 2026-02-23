const protectHtmlPages = (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    
    if (req.path === '/login') {
        return next();
    }
    
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return next();
    }
    
    if (req.path === '/' || req.path.endsWith('.html')) {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }
    }
    
    next();
};

module.exports = {
    protectHtmlPages,
};
