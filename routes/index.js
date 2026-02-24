/**
 * 集中註冊所有 API 路由
 * 依賴順序：auth, misc 需 csrfProtection；其餘依序註冊
 */
module.exports = function registerAllRoutes(app, { csrfProtection }) {
    require('./auth')(app);
    require('./settings')(app);
    require('./misc')(app, { csrfProtection });
    require('./issues')(app);
    require('./users')(app);
    require('./admin')(app);
    require('./options')(app);
    require('./plans')(app);
    require('./schedule')(app);
    require('./templates')(app);
};
