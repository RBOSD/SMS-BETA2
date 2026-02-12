/**
 * 導航：switchView、onToggleSidebar
 * 依賴：core.js (issuesPage, plansPage)
 * 其他 view 初始化函數由 scripts.js 提供（loadDashboardYearOptions, setupImportListeners 等）
 */
(function () {
    'use strict';

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
        document.querySelectorAll('.sidebar-btn').forEach(function (btn) {
            btn.classList.remove('active');
        });
        var btn = document.getElementById('btn-' + viewId);
        if (btn) btn.classList.add('active');
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
})();
