/**
 * 頁面載入：DOMContentLoaded、initListeners、initEditForm
 * 依賴：core.js, auth.js, navigation.js, dashboard.js, search-view.js, import-view.js, users-view.js
 */
(function () {
    'use strict';

    function initListeners() {
        var kw = document.getElementById('filterKeyword');
        if (kw) kw.addEventListener('keyup', function (e) { if (e.key === 'Enter' && typeof window.applyFilters === 'function') window.applyFilters(); });
        var backdrop = document.getElementById('drawerBackdrop');
        if (backdrop) backdrop.addEventListener('click', function () { if (typeof window.closeDrawer === 'function') window.closeDrawer(); });
    }

    function initEditForm() {
        // 審查次數現在是只讀顯示，不再需要初始化下拉選項
        // 保留此函數以保持代碼兼容性
    }

    window.initListeners = initListeners;
    window.initEditForm = initEditForm;

    async function runInit() {
        document.body.style.display = 'flex';
        try {
            var checkAuth = window.checkAuth;
            if (typeof checkAuth !== 'function') {
                console.error('checkAuth 未定義');
                return;
            }
            await checkAuth();
            var currentUser = window.currentUser;
            if (currentUser) {
                var mustChangePassword = sessionStorage.getItem('mustChangePassword') === 'true';
                if (mustChangePassword) {
                    var modal = document.getElementById('changePasswordModal');
                    if (modal) {
                        modal.style.display = 'flex';
                        sessionStorage.removeItem('mustChangePassword');
                        return;
                    }
                }
                document.body.style.display = 'flex';
                var savedView = sessionStorage.getItem('currentView');
                var targetView = savedView || 'searchView';
                var viewElement = document.getElementById(targetView);
                if (!viewElement) targetView = 'searchView';
                try {
                    if (typeof window.switchView === 'function') await window.switchView(targetView);
                } catch (viewError) {
                    console.error('切換視圖錯誤:', viewError);
                    var searchViewEl = document.getElementById('searchView');
                    if (searchViewEl) {
                        searchViewEl.classList.add('active');
                        document.querySelectorAll('.view-section').forEach(function (el) {
                            if (el.id !== 'searchView') el.classList.remove('active');
                        });
                    }
                }
                try { initListeners(); } catch (e) { console.error('初始化監聽器錯誤:', e); }
                try { initEditForm(); } catch (e) { console.error('初始化編輯表單錯誤:', e); }
                try { if (typeof window.initCharts === 'function') window.initCharts(); } catch (e) { console.error('初始化圖表錯誤:', e); }
                try {
                    if (typeof window.loadPlanOptions === 'function') window.loadPlanOptions();
                    if (typeof window.loadFilterPlanOptions === 'function') window.loadFilterPlanOptions();
                } catch (e) { console.error('載入計畫選項錯誤:', e); }
                try { if (typeof window.initImportRoundOptions === 'function') window.initImportRoundOptions(); } catch (e) { console.error('初始化匯入輪次選項錯誤:', e); }
                if (targetView === 'searchView') {
                    try {
                        if (typeof window.loadIssuesPage === 'function') await window.loadIssuesPage(1);
                    } catch (e) {
                        console.error('載入事項資料錯誤:', e);
                        var emptyMsg = document.getElementById('emptyMsg');
                        if (emptyMsg) {
                            emptyMsg.innerText = '載入資料時發生錯誤，請重新整理頁面';
                            emptyMsg.style.display = 'block';
                        }
                    }
                }
                if (currentUser.isAdmin === true && targetView === 'usersView') {
                    try { if (typeof window.loadUsersPage === 'function') window.loadUsersPage(1); } catch (e) { console.error('載入使用者資料錯誤:', e); }
                }
            } else {
                if (window.isDevelopment) console.warn('未檢測到登入狀態，嘗試重定向到登入頁');
            }
        } catch (error) {
            console.error('初始化錯誤:', error);
            document.body.style.display = 'flex';
            var appBody = document.getElementById('appBody');
            if (appBody) {
                appBody.innerHTML = '<div style="padding: 40px; text-align: center; color: #ef4444;">' +
                    '<h2>初始化錯誤</h2>' +
                    '<p>頁面載入時發生錯誤，請重新整理頁面或聯絡系統管理員。</p>' +
                    '<button onclick="window.location.reload()" class="btn btn-primary" style="margin-top: 20px;">重新整理頁面</button></div>';
            }
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runInit);
    } else {
        runInit();
    }
})();
