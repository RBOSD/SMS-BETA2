/**
 * 資料管理：setupImportListeners、setupAdminElements、switchDataTab、loadPlanOptions、switchIssuesSubTab
 * 依賴：core.js, utils.js, search-view.js (loadFilterPlanOptions)
 * 注意：switchDataTab 會呼叫 switchPlansSubTab、loadPlansPage（由 plans-view.js 或 scripts.js 提供）
 */
(function () {
    'use strict';

    function setupAdminElements() {
        if (!window.currentUser || window.currentUser.isAdmin !== true) return;
        var uploadCardBackup = document.getElementById('uploadCardBackup');
        if (uploadCardBackup) uploadCardBackup.classList.remove('hidden');
        var exportJsonOption = document.getElementById('exportJsonOption');
        if (exportJsonOption) {
            exportJsonOption.style.display = 'flex';
            exportJsonOption.style.alignItems = 'center';
        }
    }
    window.setupAdminElements = setupAdminElements;

    function setupImportListeners() {
        var wordInputEl = document.getElementById('wordInput');
        var importIssueDateEl = document.getElementById('importIssueDate');
        if (wordInputEl) {
            wordInputEl.disabled = false;
            wordInputEl.removeEventListener('change', window.checkImportReady);
            wordInputEl.addEventListener('change', window.checkImportReady);
        }
        if (importIssueDateEl) {
            importIssueDateEl.removeEventListener('input', window.checkImportReady);
            importIssueDateEl.removeEventListener('keyup', window.checkImportReady);
            importIssueDateEl.addEventListener('input', window.checkImportReady);
            importIssueDateEl.addEventListener('keyup', window.checkImportReady);
        }
        if (typeof window.initImportRoundOptions === 'function') window.initImportRoundOptions();
        if (typeof window.checkImportReady === 'function') window.checkImportReady();
    }
    window.setupImportListeners = setupImportListeners;

    async function loadPlanOptions() {
        try {
            var res = await fetch('/api/options/plans?t=' + Date.now(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            if (!res.ok) {
                console.error('載入計畫選項失敗：', res.status, res.statusText);
                return;
            }
            var json = await res.json();
            if (!json.data || json.data.length === 0) {
                if (window.isDevelopment) console.warn('沒有找到任何檢查計畫');
                if (typeof window.loadFilterPlanOptions === 'function') await window.loadFilterPlanOptions();
                return;
            }
            var selectIds = ['importPlanName', 'batchPlanName', 'manualPlanName', 'createPlanName'];
            selectIds.forEach(function (selectId) {
                var select = document.getElementById(selectId);
                if (!select) return;
                var currentValue = select.value;
                var firstOption = select.options[0] ? select.options[0].outerHTML : '';
                var yearGroups = new Map();
                var existingValues = new Set();
                if (firstOption) {
                    var tempDiv = document.createElement('div');
                    tempDiv.innerHTML = firstOption;
                    var firstOpt = tempDiv.querySelector('option');
                    if (firstOpt && firstOpt.value) existingValues.add(firstOpt.value);
                }
                json.data.forEach(function (p) {
                    var planName, planYear, planValue, planDisplay;
                    if (typeof p === 'object' && p !== null) {
                        planName = p.name || '';
                        planYear = p.year || '';
                        planValue = p.value || (planName + '|||' + planYear);
                        planDisplay = planName;
                    } else {
                        planName = p;
                        planYear = '';
                        planValue = p;
                        planDisplay = p;
                    }
                    if (!existingValues.has(planValue) && planName) {
                        existingValues.add(planValue);
                        var groupKey = planYear || '未分類';
                        if (!yearGroups.has(groupKey)) yearGroups.set(groupKey, []);
                        yearGroups.get(groupKey).push({ value: planValue, display: planDisplay, name: planName, year: planYear });
                    }
                });
                var allOptions = '';
                var sortedYears = Array.from(yearGroups.keys()).sort(function (a, b) {
                    if (a === '未分類') return 1;
                    if (b === '未分類') return -1;
                    return (parseInt(b) || 0) - (parseInt(a) || 0);
                });
                sortedYears.forEach(function (year) {
                    var plans = yearGroups.get(year);
                    plans.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'zh-TW'); });
                    var yearLabel = year === '未分類' ? '未分類' : (year + ' 年度');
                    allOptions += '<optgroup label="' + yearLabel + '">';
                    plans.forEach(function (plan) {
                        allOptions += '<option value="' + plan.value + '">' + plan.display + '</option>';
                    });
                    allOptions += '</optgroup>';
                });
                select.innerHTML = firstOption + allOptions;
                if (currentValue && Array.from(select.options).some(function (opt) { return opt.value === currentValue; })) {
                    select.value = currentValue;
                }
            });
            if (typeof window.loadFilterPlanOptions === 'function') await window.loadFilterPlanOptions();
        } catch (e) {
            console.error('Load plans failed', e);
        }
    }
    window.loadPlanOptions = loadPlanOptions;

    function switchDataTab(tab) {
        if (tab === 'export') tab = 'issues';
        sessionStorage.setItem('currentDataTab', tab);
        document.querySelectorAll('#importView .admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        if (typeof event !== 'undefined' && event && event.target) {
            event.target.classList.add('active');
        } else {
            document.querySelectorAll('#importView .admin-tab-btn').forEach(function (btn) {
                if (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf("'" + tab + "'") >= 0) {
                    btn.classList.add('active');
                }
            });
        }
        document.getElementById('tab-data-issues').classList.toggle('hidden', tab !== 'issues');
        document.getElementById('tab-data-plans').classList.toggle('hidden', tab !== 'plans');
        if (tab === 'issues') {
            var savedSubTab = sessionStorage.getItem('currentIssuesSubTab') || 'import';
            setTimeout(function () {
                if (typeof window.switchIssuesSubTab === 'function') window.switchIssuesSubTab(savedSubTab);
            }, 100);
            loadPlanOptions();
        }
        if (tab === 'plans') {
            var savedSubTab2 = sessionStorage.getItem('currentPlansSubTab') || 'schedule';
            setTimeout(function () {
                if (typeof window.switchPlansSubTab === 'function') window.switchPlansSubTab(savedSubTab2);
            }, 100);
            loadPlanOptions();
        }
    }
    window.switchDataTab = switchDataTab;

    function switchIssuesSubTab(subTab) {
        sessionStorage.setItem('currentIssuesSubTab', subTab);
        document.querySelectorAll('#tab-data-issues .admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        if (typeof event !== 'undefined' && event && event.target) {
            event.target.classList.add('active');
        } else {
            document.querySelectorAll('#tab-data-issues .admin-tab-btn').forEach(function (btn) {
                if (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf("'" + subTab + "'") >= 0) {
                    btn.classList.add('active');
                }
            });
        }
        document.getElementById('subtab-issues-import').classList.toggle('hidden', subTab !== 'import');
        document.getElementById('subtab-issues-create').classList.toggle('hidden', subTab !== 'create');
        document.getElementById('subtab-issues-year-edit').classList.toggle('hidden', subTab !== 'year-edit');
        if (subTab === 'batch' || subTab === 'manual') {
            document.getElementById('subtab-issues-create').classList.remove('hidden');
            if (subTab === 'batch' && typeof window.switchCreateMode === 'function') window.switchCreateMode('batch');
            else if (subTab === 'manual' && typeof window.switchCreateMode === 'function') window.switchCreateMode('single');
        }
        if (subTab === 'create') {
            if (typeof window.initCreateIssuePage === 'function') window.initCreateIssuePage();
            loadPlanOptions();
        }
        if (subTab === 'year-edit') {
            if (typeof window.resetYearEditState === 'function') window.resetYearEditState();
            if (typeof window.hideYearEditIssueContent === 'function') window.hideYearEditIssueContent();
            if (typeof window.hideYearEditIssueList === 'function') window.hideYearEditIssueList();
            var emptyEl = document.getElementById('yearEditEmpty');
            var notFoundEl = document.getElementById('yearEditNotFound');
            if (emptyEl) emptyEl.style.display = 'block';
            if (notFoundEl) notFoundEl.style.display = 'none';
            setTimeout(function () {
                if (typeof window.loadYearEditPlanOptions === 'function') window.loadYearEditPlanOptions();
            }, 100);
        }
    }
    window.switchIssuesSubTab = switchIssuesSubTab;
})();
