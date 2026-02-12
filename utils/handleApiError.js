const { logError } = require('./log');

function handleApiError(e, req, res, context) {
    logError(e, context, req).catch(() => {});
    
    const errorMessage = process.env.NODE_ENV === 'production' 
        ? '伺服器錯誤，請稍後再試' 
        : (e.detail || e.message || '伺服器錯誤，請稍後再試');
    
    res.status(500).json({ error: errorMessage });
}

module.exports = { handleApiError };
