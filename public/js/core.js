/**
 * 核心模組：全域狀態、API 請求、CSRF、Toast、日誌
 * 須最先載入
 */
(function () {
    'use strict';

    // 全域狀態
    window.rawData = [];
    window.currentData = [];
    window.currentUser = null;
    window.charts = {};
    window.currentEditItem = null;
    window.userList = [];
    window.sortState = { field: null, dir: 'asc' };
    window.stagedImportData = [];
    window.autoLogoutTimer = null;
    window.currentLogs = { login: [], action: [] };
    window.cachedGlobalStats = null;
    window.csrfToken = null;

    window.isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('dev');

    window.issuesPage = 1;
    window.issuesPageSize = 20;
    window.issuesTotal = 0;
    window.issuesPages = 1;
    window.usersPage = 1;
    window.usersPageSize = 20;
    window.usersTotal = 0;
    window.usersPages = 1;
    window.usersSortField = 'id';
    window.usersSortDir = 'asc';
    window.plansPage = 1;
    window.plansPageSize = 20;
    window.plansTotal = 0;
    window.plansPages = 1;
    window.plansSortField = 'year';
    window.plansSortDir = 'desc';
    window.planList = [];
    window.currentPlanSchedules = [];
    window.logsPage = 1;
    window.logsPageSize = 20;
    window.logsTotal = 0;
    window.logsPages = 1;
    window.actionsPage = 1;
    window.actionsPageSize = 20;
    window.actionsTotal = 0;
    window.actionsPages = 1;
    window.currentImportMode = 'word';
    window.holidayData = {}; // 共用的假日資料（行程規劃月曆、檢查行程檢索月曆）

    async function getCsrfToken() {
        if (window.csrfToken) return window.csrfToken;
        try {
            const res = await fetch('/api/csrf-token', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                window.csrfToken = data.csrfToken;
                return window.csrfToken;
            }
        } catch (e) {
            console.error('Failed to get CSRF token:', e);
        }
        return null;
    }
    window.getCsrfToken = getCsrfToken;

    async function apiFetch(url, options = {}) {
        try {
            const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method);
            if (needsCsrf) {
                const token = await getCsrfToken();
                if (!token) {
                    console.error('Failed to get CSRF token');
                    throw new Error('無法取得 CSRF token，請重新整理頁面');
                }
                options.headers = options.headers || {};
                options.headers['X-CSRF-Token'] = token;
            }
            const response = await fetch(url, {
                ...options,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...options.headers }
            });
            if (response.status === 401) {
                if (window.isDevelopment) console.warn('未登入（401），重定向到登入頁');
                sessionStorage.clear();
                window.location.href = '/login.html';
                throw new Error('Unauthorized');
            }
            if (response.status === 403 && needsCsrf) {
                const errorData = await response.json().catch(() => ({}));
                if (errorData.error && errorData.error.includes('CSRF')) {
                    window.csrfToken = null;
                    const newToken = await getCsrfToken();
                    if (newToken) {
                        options.headers['X-CSRF-Token'] = newToken;
                        const retryResponse = await fetch(url, {
                            ...options,
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json', ...options.headers }
                        });
                        if (retryResponse.ok || retryResponse.status !== 403) {
                            return retryResponse;
                        }
                    }
                }
            }
            return response;
        } catch (error) {
            if (error.message === 'Unauthorized') throw error;
            throw error;
        }
    }
    window.apiFetch = apiFetch;

    async function writeLog(message, level) {
        level = level || 'INFO';
        try {
            await apiFetch('/api/log', {
                method: 'POST',
                body: JSON.stringify({ message: message, level: level })
            }).catch(function () {});
        } catch (e) {}
    }
    window.writeLog = writeLog;

    function showToast(message, type) {
        type = type || 'success';
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        var icon, title;
        if (type === 'success') { icon = '✅'; title = '成功'; }
        else if (type === 'warning') { icon = '⚠️'; title = '警告'; }
        else if (type === 'info') { icon = 'ℹ️'; title = '資訊'; }
        else { icon = '❌'; title = '錯誤'; }
        toast.className = 'toast ' + type;
        toast.innerHTML = '<div class="toast-icon">' + icon + '</div><div class="toast-content"><div class="toast-title">' + title + '</div><div class="toast-msg">' + (message || '') + '</div></div>';
        container.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add('show'); });
        setTimeout(function () {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', function () { toast.remove(); });
        }, 3000);
    }
    window.showToast = showToast;

    function resetAutoLogout() {
        clearTimeout(window.autoLogoutTimer);
        window.autoLogoutTimer = setTimeout(function () {
            showToast('您已閒置過久，系統將自動登出。', 'warning');
            setTimeout(function () {
                if (typeof window.logout === 'function') window.logout();
            }, 2000);
        }, 1800000);
    }
    window.resetAutoLogout = resetAutoLogout;
    window.onload = resetAutoLogout;
    document.onmousemove = resetAutoLogout;
    document.onkeypress = resetAutoLogout;

    function toggleDashboard(btn) {
        const d = document.getElementById('dashboardSection');
        if (!d) return;
        const c = d.classList.contains('collapsed');
        d.classList.toggle('collapsed', !c);
        const icon = btn ? btn.querySelector('.toggle-icon') : null;
        if (icon) icon.textContent = c ? '▲' : '▼';
        if (btn) btn.title = c ? '收合統計圖表' : '展開統計圖表';
    }
    window.toggleDashboard = toggleDashboard;

    function toggleUserMenu() {
        const el = document.getElementById('userDropdown');
        if (el) el.classList.toggle('show');
    }
    window.toggleUserMenu = toggleUserMenu;

    function toggleGroupsPanelSize() {
        const layout = document.getElementById('adminUsersLayout') || document.querySelector('.admin-users-layout');
        if (!layout) return;
        layout.classList.toggle('groups-expanded');
        const expanded = layout.classList.contains('groups-expanded');
        const btn = document.getElementById('btnToggleGroupsPanel');
        if (btn) btn.textContent = expanded ? '⤡ 縮小' : '⤢ 放大';
    }
    window.toggleGroupsPanelSize = toggleGroupsPanelSize;
})();
