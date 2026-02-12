/**
 * 後台管理：loadUsersPage、switchAdminTab、loadLogsPage、loadActionsPage、日誌
 * 依賴：core.js, utils.js, search-view.js (renderPagination), modals.js (showConfirmModal)
 */
(function () {
    'use strict';

    function saveUsersViewState() {
        var state = {
            search: (document.getElementById('userSearch') && document.getElementById('userSearch').value) || '',
            page: window.usersPage,
            pageSize: window.usersPageSize,
            sortField: window.usersSortField,
            sortDir: window.usersSortDir,
            tab: sessionStorage.getItem('currentUsersTab') || 'users'
        };
        sessionStorage.setItem('usersViewState', JSON.stringify(state));
    }

    function restoreUsersViewState() {
        var saved = sessionStorage.getItem('usersViewState');
        if (!saved) return;
        try {
            var state = JSON.parse(saved);
            if (document.getElementById('userSearch')) document.getElementById('userSearch').value = state.search || '';
            if (state.page) window.usersPage = state.page;
            if (state.pageSize) window.usersPageSize = state.pageSize;
            if (state.sortField) window.usersSortField = state.sortField;
            if (state.sortDir) window.usersSortDir = state.sortDir;
            if (state.tab) sessionStorage.setItem('currentUsersTab', state.tab);
        } catch (e) {}
    }
    window.saveUsersViewState = saveUsersViewState;
    window.restoreUsersViewState = restoreUsersViewState;

    async function loadUsersPage(page) {
        page = page || 1;
        var usersView = document.getElementById('usersView');
        if (!usersView || !usersView.classList.contains('active')) return;
        window.usersPage = page;
        var usersPageSizeEl = document.getElementById('usersPageSize');
        window.usersPageSize = usersPageSizeEl ? (parseInt(usersPageSizeEl.value, 10) || 20) : 20;
        var userSearchEl = document.getElementById('userSearch');
        var q = userSearchEl ? (userSearchEl.value || '') : '';
        saveUsersViewState();
        var params = new URLSearchParams({
            page: window.usersPage,
            pageSize: window.usersPageSize,
            q: q,
            sortField: window.usersSortField,
            sortDir: window.usersSortDir,
            _t: Date.now()
        });
        try {
            var res = await window.apiFetch('/api/users?' + params.toString());
            if (!res.ok) {
                window.showToast('載入使用者失敗', 'error');
                return;
            }
            var j = await res.json();
            window.userList = j.data || [];
            window.usersTotal = j.total || 0;
            window.usersPages = j.pages || 1;
            try {
                if (typeof window.ensureGroupsForUserModalLoaded === 'function') await window.ensureGroupsForUserModalLoaded();
            } catch (e) {}
            renderUsers();
            if (document.getElementById('usersPagination')) {
                if (typeof window.renderPagination === 'function') {
                    window.renderPagination('usersPagination', window.usersPage, window.usersPages, 'loadUsersPage');
                }
            }
        } catch (e) {
            window.showToast('載入使用者錯誤', 'error');
        }
    }
    window.loadUsersPage = loadUsersPage;

    function getRoleName(r) {
        var map = { 'manager': '資料管理者', 'viewer': '檢視人員' };
        return map[r] || r;
    }

    function renderUsers() {
        var tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        var userList = window.userList || [];
        var groupsMap = new Map((window.cachedGroupsForModal || []).map(function (g) { return [parseInt(g.id, 10), g.name]; }));
        var myId = window.currentUser && window.currentUser.id;
        var escapeHtml = window.escapeHtml || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
        tbody.innerHTML = userList.map(function (u) {
            var gids = Array.isArray(u.groupIds) ? u.groupIds : [];
            var groupNames = gids.map(function (id) { return groupsMap.get(parseInt(id, 10)) || '#' + id; });
            var groupHtml = groupNames.length
                ? groupNames.map(function (n) { return '<span class="badge" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-weight:700;">' + escapeHtml(n) + '</span>'; }).join(' ')
                : '<span style="color:#94a3b8;">-</span>';
            var disabledBadge = (u.isDisabled === true) ? '<span class="badge" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-weight:700;margin-left:4px;">已停用</span>' : '';
            var opHtml = (myId && u.id === myId)
                ? '-'
                : '<button class="btn btn-outline" style="padding:2px 6px;margin-right:4px;" onclick="openUserModal(\'edit\', ' + u.id + ')" title="編輯">✏️</button><button class="btn btn-outline" style="padding:2px 6px;margin-right:4px;font-size:12px;" onclick="toggleUserDisable(' + u.id + ')" title="' + (u.isDisabled === true ? '啟用此帳號' : '停用此帳號') + '">' + (u.isDisabled === true ? '啟用' : '停用') + '</button><button class="btn btn-outline" style="padding:2px 6px;margin-right:4px;" onclick="resetUserPassword(' + u.id + ')" title="重置為初始密碼 Aa123456">🔑</button><button class="btn btn-danger" style="padding:2px 6px;" onclick="deleteUser(' + u.id + ')" title="刪除">🗑️</button>';
            return '<tr class="' + (u.isDisabled === true ? 'user-row-disabled' : '') + '"><td data-label="姓名" style="padding:12px;">' + escapeHtml(u.name || '-') + '</td><td data-label="帳號">' + escapeHtml(u.username || '-') + disabledBadge + '</td><td data-label="群組" style="display:flex; flex-wrap:wrap; gap:6px; padding:12px 8px;">' + groupHtml + '</td><td data-label="權限">' + escapeHtml(u.isAdmin === true ? '系統管理員' : getRoleName(u.role)) + '</td><td data-label="註冊時間">' + (u.created_at ? new Date(u.created_at).toLocaleDateString() : '-') + '</td><td data-label="操作">' + opHtml + '</td></tr>';
        }).join('');
    }

    function usersSortBy(field) {
        if (window.usersSortField === field) {
            window.usersSortDir = window.usersSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            window.usersSortField = field;
            window.usersSortDir = 'asc';
        }
        saveUsersViewState();
        loadUsersPage(1);
    }
    window.usersSortBy = usersSortBy;

    function saveLogsViewState() {
        var state = {
            search: (document.getElementById('loginSearch') && document.getElementById('loginSearch').value) || '',
            page: window.logsPage,
            pageSize: window.logsPageSize
        };
        sessionStorage.setItem('logsViewState', JSON.stringify(state));
    }

    function restoreLogsViewState() {
        var saved = sessionStorage.getItem('logsViewState');
        if (!saved) return;
        try {
            var state = JSON.parse(saved);
            if (document.getElementById('loginSearch')) document.getElementById('loginSearch').value = state.search || '';
            if (state.page) window.logsPage = state.page;
            if (state.pageSize) window.logsPageSize = state.pageSize;
        } catch (e) {}
    }

    async function loadLogsPage(page) {
        page = page || 1;
        var loginSearchEl = document.getElementById('loginSearch');
        if (!loginSearchEl) return;
        window.logsPage = page;
        var q = loginSearchEl.value || '';
        saveLogsViewState();
        var params = new URLSearchParams({ page: window.logsPage, pageSize: window.logsPageSize, q: q, _t: Date.now() });
        var logsLoadingEl = document.getElementById('logsLoading');
        if (logsLoadingEl) logsLoadingEl.style.display = 'block';
        try {
            var res = await window.apiFetch('/api/admin/logs?' + params.toString());
            if (!res.ok) {
                window.showToast('載入登入紀錄失敗', 'error');
                return;
            }
            var j = await res.json();
            window.currentLogs = window.currentLogs || { login: [], action: [] };
            window.currentLogs.login = j.data || [];
            window.logsTotal = j.total || 0;
            window.logsPages = j.pages || 1;
            var logsTableBody = document.getElementById('logsTableBody');
            if (logsTableBody) {
                logsTableBody.innerHTML = (window.currentLogs.login || []).map(function (l) {
                    return '<tr><td data-label="時間" style="padding:12px;">' + new Date(l.login_time).toLocaleString('zh-TW') + '</td><td data-label="帳號">' + (l.username || '') + '</td><td data-label="IP">' + (l.ip_address || '-') + '</td></tr>';
                }).join('');
            }
            if (typeof window.renderPagination === 'function') {
                window.renderPagination('logsPagination', window.logsPage, window.logsPages, 'loadLogsPage');
            }
        } catch (e) {
            window.showToast('載入登入紀錄錯誤', 'error');
        } finally {
            if (logsLoadingEl) logsLoadingEl.style.display = 'none';
        }
    }
    window.loadLogsPage = loadLogsPage;

    function saveActionsViewState() {
        var state = {
            search: (document.getElementById('actionSearch') && document.getElementById('actionSearch').value) || '',
            page: window.actionsPage,
            pageSize: window.actionsPageSize
        };
        sessionStorage.setItem('actionsViewState', JSON.stringify(state));
    }

    function restoreActionsViewState() {
        var saved = sessionStorage.getItem('actionsViewState');
        if (!saved) return;
        try {
            var state = JSON.parse(saved);
            if (document.getElementById('actionSearch')) document.getElementById('actionSearch').value = state.search || '';
            if (state.page) window.actionsPage = state.page;
            if (state.pageSize) window.actionsPageSize = state.pageSize;
        } catch (e) {}
    }

    async function loadActionsPage(page) {
        page = page || 1;
        var actionSearchEl = document.getElementById('actionSearch');
        if (!actionSearchEl) return;
        window.actionsPage = page;
        var q = actionSearchEl.value || '';
        saveActionsViewState();
        var params = new URLSearchParams({ page: window.actionsPage, pageSize: window.actionsPageSize, q: q, _t: Date.now() });
        var logsLoadingEl = document.getElementById('logsLoading');
        if (logsLoadingEl) logsLoadingEl.style.display = 'block';
        try {
            var res = await window.apiFetch('/api/admin/action_logs?' + params.toString());
            if (!res.ok) {
                window.showToast('載入操作紀錄失敗', 'error');
                return;
            }
            var j = await res.json();
            window.currentLogs = window.currentLogs || { login: [], action: [] };
            window.currentLogs.action = j.data || [];
            window.actionsTotal = j.total || 0;
            window.actionsPages = j.pages || 1;
            var actionsTableBody = document.getElementById('actionsTableBody');
            if (actionsTableBody) {
                var escapeHtml = window.escapeHtml || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
                actionsTableBody.innerHTML = (window.currentLogs.action || []).map(function (l) {
                    return '<tr><td data-label="時間" style="padding:12px;white-space:nowrap;">' + new Date(l.created_at).toLocaleString('zh-TW') + '</td><td data-label="帳號">' + (l.username || '') + '</td><td data-label="動作"><span class="badge new">' + (l.action || '') + '</span></td><td data-label="詳細內容"><div style="font-size:12px;color:#666;">' + escapeHtml(l.details || '') + '</div></td></tr>';
                }).join('');
            }
            if (typeof window.renderPagination === 'function') {
                window.renderPagination('actionsPagination', window.actionsPage, window.actionsPages, 'loadActionsPage');
            }
        } catch (e) {
            window.showToast('載入操作紀錄錯誤', 'error');
        } finally {
            if (logsLoadingEl) logsLoadingEl.style.display = 'none';
        }
    }
    window.loadActionsPage = loadActionsPage;

    function exportLogs(type) {
        var data = type === 'login' ? (window.currentLogs && window.currentLogs.login) : (window.currentLogs && window.currentLogs.action);
        if (!data || data.length === 0) {
            window.showToast('無資料可匯出', 'error');
            return;
        }
        var csvContent = '\uFEFF';
        if (type === 'login') {
            csvContent += '時間,帳號,IP位址\n';
            data.forEach(function (row) {
                csvContent += '"' + new Date(row.login_time).toLocaleString('zh-TW') + '","' + (row.username || '') + '","' + (row.ip_address || '') + '"\n';
            });
        } else {
            csvContent += '時間,帳號,動作,詳細內容\n';
            data.forEach(function (row) {
                csvContent += '"' + new Date(row.created_at).toLocaleString('zh-TW') + '","' + (row.username || '') + '","' + (row.action || '') + '","' + (row.details || '').replace(/"/g, '""') + '"\n';
            });
        }
        var link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })));
        link.setAttribute('download', type + '_logs_' + new Date().toISOString().slice(0, 10) + '.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    window.exportLogs = exportLogs;

    async function deleteLogsFromDB(type) {
        var daysSelect = document.getElementById(type === 'login' ? 'loginCleanupDays' : 'actionCleanupDays');
        var customDaysInput = document.getElementById(type === 'login' ? 'loginCustomDays' : 'actionCustomDays');
        var logTypeName = type === 'login' ? '登入' : '操作';
        if (daysSelect.value === 'all') {
            var confirmed = await window.showConfirmModal('確定要刪除資料庫中所有「' + logTypeName + '」紀錄嗎？\n\n此動作無法復原！', '確定刪除', '取消');
            if (!confirmed) return;
            var endpoint = type === 'login' ? '/api/admin/logs' : '/api/admin/action_logs';
            try {
                var res = await window.apiFetch(endpoint, { method: 'DELETE' });
                if (res.ok) {
                    window.showToast('資料庫記錄已全部刪除');
                    if (type === 'login') loadLogsPage(1);
                    else loadActionsPage(1);
                } else {
                    window.showToast('刪除失敗', 'error');
                }
            } catch (e) {
                window.showToast('Error: ' + e.message, 'error');
            }
            return;
        }
        var days = parseInt(daysSelect.value, 10);
        if (daysSelect.value === 'custom') {
            days = parseInt(customDaysInput.value, 10);
            if (!days || days < 1) {
                window.showToast('請輸入有效的保留天數（至少1天）', 'error');
                return;
            }
        }
        var confirmed2 = await window.showConfirmModal('確定要刪除資料庫中 ' + days + ' 天前的「' + logTypeName + '」紀錄嗎？\n\n將保留最近 ' + days + ' 天的記錄，刪除更早的記錄。\n\n此動作無法復原！', '確定刪除', '取消');
        if (!confirmed2) return;
        var endpoint2 = type === 'login' ? '/api/admin/logs/cleanup' : '/api/admin/action_logs/cleanup';
        try {
            var res2 = await window.apiFetch(endpoint2, {
                method: 'POST',
                body: JSON.stringify({ days: days })
            });
            var data = await res2.json();
            if (res2.ok) {
                window.showToast('已刪除資料庫中 ' + (data.deleted || 0) + ' 筆 ' + days + ' 天前的' + logTypeName + '紀錄');
                if (type === 'login') loadLogsPage(1);
                else loadActionsPage(1);
            } else {
                window.showToast(data.error || '刪除失敗', 'error');
            }
        } catch (e) {
            window.showToast('Error: ' + e.message, 'error');
        }
    }
    window.deleteLogsFromDB = deleteLogsFromDB;

    function setupCleanupDaysSelect() {
        var loginSelect = document.getElementById('loginCleanupDays');
        var actionSelect = document.getElementById('actionCleanupDays');
        var loginCustom = document.getElementById('loginCustomDays');
        var actionCustom = document.getElementById('actionCustomDays');
        if (loginSelect) {
            loginSelect.removeEventListener('change', loginSelect._cleanupHandler);
            loginSelect._cleanupHandler = function () {
                if (loginCustom) loginCustom.classList.toggle('hidden', this.value !== 'custom');
                if (this.value !== 'custom' && loginCustom) loginCustom.value = '';
            };
            loginSelect.addEventListener('change', loginSelect._cleanupHandler);
        }
        if (actionSelect) {
            actionSelect.removeEventListener('change', actionSelect._cleanupHandler);
            actionSelect._cleanupHandler = function () {
                if (actionCustom) actionCustom.classList.toggle('hidden', this.value !== 'custom');
                if (this.value !== 'custom' && actionCustom) actionCustom.value = '';
            };
            actionSelect.addEventListener('change', actionSelect._cleanupHandler);
        }
    }
    window.setupCleanupDaysSelect = setupCleanupDaysSelect;

    function switchAdminTab(tab) {
        if (tab === 'import-export') tab = 'users';
        sessionStorage.setItem('currentAdminTab', tab);
        sessionStorage.setItem('currentUsersTab', tab);
        saveUsersViewState();
        document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        if (typeof event !== 'undefined' && event && event.target) {
            event.target.classList.add('active');
        } else {
            document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
                if (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf("'" + tab + "'") >= 0) {
                    btn.classList.add('active');
                }
            });
        }
        var tabUsers = document.getElementById('tab-users');
        var tabImportExport = document.getElementById('tab-import-export');
        var tabLogs = document.getElementById('tab-logs');
        var tabActions = document.getElementById('tab-actions');
        var tabSystem = document.getElementById('tab-system');
        if (tabUsers) tabUsers.classList.toggle('hidden', tab !== 'users');
        if (tabImportExport) tabImportExport.classList.toggle('hidden', tab !== 'import-export');
        if (tabLogs) tabLogs.classList.toggle('hidden', tab !== 'logs');
        if (tabActions) tabActions.classList.toggle('hidden', tab !== 'actions');
        if (tabSystem) tabSystem.classList.toggle('hidden', tab !== 'system');
        if (tab === 'logs') {
            restoreLogsViewState();
            loadLogsPage(window.logsPage || 1);
        }
        if (tab === 'actions') {
            restoreActionsViewState();
            loadActionsPage(window.actionsPage || 1);
        }
        if (tab === 'users') {
            loadUsersPage(window.usersPage || 1);
            setTimeout(function () {
                try { if (typeof window.loadGroupsAdmin === 'function') window.loadGroupsAdmin(); } catch (e) {}
            }, 50);
        }
        if (tab === 'system') {
            setTimeout(function () {
                try { if (typeof window.setupAdminElements === 'function') window.setupAdminElements(); } catch (e) {}
                try { if (typeof window.setupExportOptions === 'function') window.setupExportOptions(); } catch (e) {}
            }, 50);
        }
    }
    window.switchAdminTab = switchAdminTab;
})();
