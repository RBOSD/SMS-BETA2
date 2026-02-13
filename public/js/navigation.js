/**
 * 導航：switchView、switchToItem、onToggleSidebar、toggleSidebarGroup
 * 依賴：core.js (issuesPage, plansPage)
 * 其他 view 初始化函數由 scripts.js 提供（loadDashboardYearOptions, setupImportListeners 等）
 */
(function () {
    'use strict';

    function updateSidebarActiveState(viewId, dataTab, subTab, adminTab) {
        document.querySelectorAll('.sidebar-btn').forEach(function (btn) { btn.classList.remove('active'); });
        document.querySelectorAll('.sidebar-sub-btn').forEach(function (btn) { btn.classList.remove('active'); });
        document.querySelectorAll('.sidebar-group').forEach(function (g) { g.classList.remove('expanded'); });
        var btn = document.getElementById('btn-' + viewId);
        if (btn) btn.classList.add('active');
        if (viewId === 'importView') {
            var groupImport = document.getElementById('sidebarGroupImport');
            if (groupImport) groupImport.classList.add('expanded');
            var route = 'import:' + (dataTab || 'issues') + ':' + (subTab || 'import');
            var subBtn = document.querySelector('.sidebar-sub-btn[data-route="' + route + '"]');
            if (subBtn) subBtn.classList.add('active');
        } else if (viewId === 'usersView') {
            var groupUsers = document.getElementById('sidebarGroupUsers');
            if (groupUsers) groupUsers.classList.add('expanded');
            var route = 'users:' + (adminTab || 'users');
            var subBtn = document.querySelector('.sidebar-sub-btn[data-route="' + route + '"]');
            if (subBtn) subBtn.classList.add('active');
        }
    }

    function toggleSidebarGroup(groupId) {
        var group = document.getElementById('sidebarGroup' + (groupId === 'import' ? 'Import' : 'Users'));
        if (!group) return;
        if (group.classList.contains('expanded')) {
            group.classList.remove('expanded');
        } else {
            group.classList.add('expanded');
            if (groupId === 'import') {
                switchToItem('importView', 'issues', 'import');
            } else {
                switchToItem('usersView', 'users');
            }
        }
    }
    window.toggleSidebarGroup = toggleSidebarGroup;

    function onToggleSidebar() {
        var panel = document.getElementById('filtersPanel');
        var backdrop = document.getElementById('filterBackdrop');
        if (!panel || !backdrop) return;
        if (panel.classList.contains('open')) {
            panel.classList.remove('open');
            backdrop.classList.remove('visible');
            setTimeout(function () {
                backdrop.style.display = 'none';
            }, 300);
        } else {
            backdrop.style.display = 'block';
            requestAnimationFrame(function () {
                panel.classList.add('open');
                backdrop.classList.add('visible');
            });
        }
    }
    window.onToggleSidebar = onToggleSidebar;

    async function switchView(viewId) {
        sessionStorage.setItem('currentView', viewId);
        document.querySelectorAll('.view-section').forEach(function (el) {
            el.classList.remove('active');
        });
        var viewElement = document.getElementById(viewId);
        if (!viewElement) {
            console.error('View element not found:', viewId);
            return;
        }
        viewElement.classList.add('active');
        var dataTab = sessionStorage.getItem('currentDataTab') || 'issues';
        var issuesSub = sessionStorage.getItem('currentIssuesSubTab') || 'import';
        var plansSub = sessionStorage.getItem('currentPlansSubTab') || 'schedule';
        var usersTab = sessionStorage.getItem('currentUsersTab') || 'users';
        if (viewId === 'importView') {
            updateSidebarActiveState(viewId, dataTab, dataTab === 'issues' ? issuesSub : plansSub, null);
        } else if (viewId === 'usersView') {
            updateSidebarActiveState(viewId, null, null, usersTab);
        } else {
            updateSidebarActiveState(viewId, null, null, null);
        }
        window.scrollTo(0, 0);
        var dashboard = document.getElementById('dashboardSection');
        if (dashboard) {
            dashboard.style.display = (viewId === 'searchView') ? 'block' : 'none';
        }
        var mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.scrollTop = 0;
        var panel = document.getElementById('filtersPanel');
        if (panel && panel.classList.contains('open')) {
            onToggleSidebar();
        }
        var viewMap = {
            'searchView': '/views/search-view.html',
            'planCalendarView': '/views/calendar-dashboard-view.html',
            'importView': '/views/import-view.html',
            'usersView': '/views/users-view.html'
        };
        if (viewMap[viewId] && !viewElement.dataset.loaded) {
            try {
                var response = await fetch(viewMap[viewId]);
                if (response.ok) {
                    var html = await response.text();
                    viewElement.innerHTML = html;
                    viewElement.dataset.loaded = 'true';
                    if (viewId === 'planCalendarView') {
                        setTimeout(function () {
                            if (typeof window.loadDashboardYearOptions === 'function') window.loadDashboardYearOptions();
                        }, 100);
                    } else if (viewId === 'importView') {
                        if (typeof window.setupAdminElements === 'function') window.setupAdminElements();
                        setTimeout(function () {
                            if (typeof window.setupImportListeners === 'function') window.setupImportListeners();
                        }, 100);
                        if (typeof window.loadPlanOptions === 'function') window.loadPlanOptions();
                        setTimeout(function () {
                            try { if (typeof window.loadOwnerGroupSelectsForImportView === 'function') window.loadOwnerGroupSelectsForImportView(); } catch (e) {}
                        }, 150);
                        var openPlansSchedule = sessionStorage.getItem('openPlansSchedule');
                        if (openPlansSchedule) {
                            sessionStorage.removeItem('openPlansSchedule');
                            setTimeout(function () {
                                if (typeof window.switchDataTab === 'function') window.switchDataTab('plans');
                                if (typeof window.switchPlansSubTab === 'function') window.switchPlansSubTab('schedule');
                            }, 250);
                        } else {
                            var savedTab = sessionStorage.getItem('currentDataTab');
                            if (savedTab) setTimeout(function () {
                                if (typeof window.switchDataTab === 'function') window.switchDataTab(savedTab);
                            }, 200);
                        }
                    } else if (viewId === 'usersView') {
                        setTimeout(function () {
                            if (typeof window.setupCleanupDaysSelect === 'function') window.setupCleanupDaysSelect();
                        }, 100);
                    }
                }
            } catch (error) {}
        } else if (viewId === 'planCalendarView' && viewElement.dataset.loaded) {
            if (typeof window.loadCalendarDashboardStats === 'function') window.loadCalendarDashboardStats();
        } else if (viewId === 'usersView' && viewElement.dataset.loaded) {
            setTimeout(function () {
                if (typeof window.setupCleanupDaysSelect === 'function') window.setupCleanupDaysSelect();
            }, 100);
        }
        if (viewId === 'searchView') {
            if (typeof window.restoreSearchViewState === 'function') window.restoreSearchViewState();
            setTimeout(function () {
                if (typeof window.loadIssuesPage === 'function') window.loadIssuesPage(window.issuesPage || 1);
                if (typeof window.updateSortUI === 'function') window.updateSortUI();
            }, 100);
        } else if (viewId === 'usersView') {
            if (typeof window.restoreUsersViewState === 'function') window.restoreUsersViewState();
            var savedTab = sessionStorage.getItem('currentUsersTab') || 'users';
            setTimeout(function () {
                if (typeof window.switchAdminTab === 'function') window.switchAdminTab(savedTab);
                if (typeof window.setupCleanupDaysSelect === 'function') window.setupCleanupDaysSelect();
            }, 200);
        } else if (viewId === 'planCalendarView' && viewElement.dataset.loaded) {
            if (typeof window.loadDashboardYearOptions === 'function') window.loadDashboardYearOptions();
        } else if (viewId === 'importView' && viewElement.dataset.loaded) {
            var openPlansSchedule2 = sessionStorage.getItem('openPlansSchedule');
            if (typeof window.loadPlanOptions === 'function') window.loadPlanOptions();
            setTimeout(function () {
                try { if (typeof window.loadOwnerGroupSelectsForImportView === 'function') window.loadOwnerGroupSelectsForImportView(); } catch (e) {}
            }, 50);
            if (openPlansSchedule2) {
                sessionStorage.removeItem('openPlansSchedule');
                setTimeout(function () {
                    if (typeof window.switchDataTab === 'function') window.switchDataTab('plans');
                    if (typeof window.switchPlansSubTab === 'function') window.switchPlansSubTab('schedule');
                }, 100);
            } else {
                var savedTab2 = sessionStorage.getItem('currentDataTab');
                if (savedTab2) {
                    setTimeout(function () {
                        if (typeof window.switchDataTab === 'function') window.switchDataTab(savedTab2);
                        if (savedTab2 === 'plans') {
                            if (typeof window.restorePlansViewState === 'function') window.restorePlansViewState();
                            setTimeout(function () {
                                if (typeof window.loadPlansPage === 'function') window.loadPlansPage(window.plansPage || 1);
                            }, 300);
                        }
                    }, 200);
                }
            }
        }
    }
    window.switchView = switchView;

    async function switchToItem(viewId, dataTab, subTab) {
        var adminTab = dataTab;
        if (viewId === 'searchView' || viewId === 'planCalendarView') {
            sessionStorage.setItem('currentView', viewId);
            document.querySelectorAll('.sidebar-btn').forEach(function (btn) { btn.classList.remove('active'); });
            document.querySelectorAll('.sidebar-sub-btn').forEach(function (btn) { btn.classList.remove('active'); });
            document.querySelectorAll('.sidebar-group').forEach(function (g) { g.classList.remove('expanded'); });
            var btn = document.getElementById('btn-' + viewId);
            if (btn) btn.classList.add('active');
            await switchView(viewId);
            return;
        }
        if (viewId === 'importView') {
            sessionStorage.setItem('currentDataTab', dataTab || 'issues');
            sessionStorage.setItem('currentIssuesSubTab', dataTab === 'issues' ? (subTab || 'import') : 'import');
            sessionStorage.setItem('currentPlansSubTab', dataTab === 'plans' ? (subTab || 'schedule') : 'schedule');
        } else if (viewId === 'usersView') {
            adminTab = dataTab || 'users';
            sessionStorage.setItem('currentUsersTab', adminTab);
            sessionStorage.setItem('currentAdminTab', adminTab);
        }
        await switchView(viewId);
        updateSidebarActiveState(viewId, dataTab, subTab, adminTab);
        if (viewId === 'importView') {
            setTimeout(function () {
                if (typeof window.switchDataTab === 'function') window.switchDataTab(dataTab || 'issues');
                if (dataTab === 'issues' && typeof window.switchIssuesSubTab === 'function') {
                    window.switchIssuesSubTab(subTab || 'import');
                } else if (dataTab === 'plans' && typeof window.switchPlansSubTab === 'function') {
                    window.switchPlansSubTab(subTab || 'schedule');
                }
            }, 250);
        } else if (viewId === 'usersView') {
            setTimeout(function () {
                if (typeof window.switchAdminTab === 'function') window.switchAdminTab(adminTab || 'users');
            }, 250);
        }
    }
    window.switchToItem = switchToItem;
})();
