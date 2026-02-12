/**
 * 開立事項檢索：loadIssuesPage、applyFilters、renderTable、sortData、分頁、篩選
 * 依賴：core.js, utils.js, dashboard.js (updateChartsData)
 */
(function () {
    'use strict';

    function renderPagination(containerId, currentPage, totalPages, onPageChange) {
        var containerTop = document.getElementById(containerId + 'Top');
        var containerBottom = document.getElementById(containerId + 'Bottom');
        var html = '';
        html += '<button class="page-btn" ' + (currentPage === 1 ? 'disabled' : '') + ' onclick="' + onPageChange + '(' + (currentPage - 1) + ')">◀</button>';
        var delta = 2, range = [];
        for (var i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) { range.push(i); }
        if (currentPage - delta > 2) range.unshift('...');
        if (currentPage + delta < totalPages - 1) range.push('...');
        range.unshift(1);
        if (totalPages > 1) range.push(totalPages);
        range.forEach(function (i) {
            if (i === '...') html += '<div class="page-dots">...</div>';
            else html += '<button class="page-btn ' + (i === currentPage ? 'active' : '') + '" onclick="' + onPageChange + '(' + i + ')">' + i + '</button>';
        });
        html += '<button class="page-btn" ' + (currentPage === totalPages ? 'disabled' : '') + ' onclick="' + onPageChange + '(' + (currentPage + 1) + ')">▶</button>';
        if (containerTop) containerTop.innerHTML = html;
        if (containerBottom) containerBottom.innerHTML = html;
    }
    window.renderPagination = renderPagination;

    function saveSearchViewState() {
        var state = {
            keyword: (document.getElementById('filterKeyword') && document.getElementById('filterKeyword').value) || '',
            year: (document.getElementById('filterYear') && document.getElementById('filterYear').value) || '',
            plan: (document.getElementById('filterPlan') && document.getElementById('filterPlan').value) || '',
            unit: (document.getElementById('filterUnit') && document.getElementById('filterUnit').value) || '',
            status: (document.getElementById('filterStatus') && document.getElementById('filterStatus').value) || '',
            kind: (document.getElementById('filterKind') && document.getElementById('filterKind').value) || '',
            division: (document.getElementById('filterDivision') && document.getElementById('filterDivision').value) || '',
            inspection: (document.getElementById('filterInspection') && document.getElementById('filterInspection').value) || '',
            page: window.issuesPage,
            pageSize: window.issuesPageSize,
            sortField: (window.sortState && window.sortState.field) || '',
            sortDir: (window.sortState && window.sortState.dir) || 'asc'
        };
        sessionStorage.setItem('searchViewState', JSON.stringify(state));
    }
    window.saveSearchViewState = saveSearchViewState;

    function restoreSearchViewState() {
        var saved = sessionStorage.getItem('searchViewState');
        if (!saved) return;
        try {
            var state = JSON.parse(saved);
            if (document.getElementById('filterKeyword')) document.getElementById('filterKeyword').value = '';
            if (document.getElementById('filterYear')) document.getElementById('filterYear').value = '';
            if (document.getElementById('filterPlan')) document.getElementById('filterPlan').value = '';
            if (document.getElementById('filterUnit')) document.getElementById('filterUnit').value = '';
            if (document.getElementById('filterStatus')) document.getElementById('filterStatus').value = '';
            if (document.getElementById('filterKind')) document.getElementById('filterKind').value = '';
            if (document.getElementById('filterDivision')) document.getElementById('filterDivision').value = '';
            if (document.getElementById('filterInspection')) document.getElementById('filterInspection').value = '';
            if (state.page) window.issuesPage = state.page;
            if (state.pageSize) window.issuesPageSize = state.pageSize;
            if (state.sortField && window.sortState) window.sortState.field = state.sortField;
            if (state.sortDir && window.sortState) window.sortState.dir = state.sortDir;
        } catch (e) {}
    }
    window.restoreSearchViewState = restoreSearchViewState;

    function renderStats(stats) {
        var s = stats.status;
        var total = s.reduce(function (sum, item) { return sum + parseInt(item.count, 10); }, 0);
        var active = (s.find(function (x) { return x.status === '持續列管'; }) || {}).count || 0;
        var resolved = s.filter(function (x) { return ['解除列管', '自行列管'].indexOf(x.status) >= 0; }).reduce(function (sum, x) { return sum + parseInt(x.count, 10); }, 0);
        var totalEl = document.getElementById('countTotal');
        var activeEl = document.getElementById('countActive');
        var resolvedEl = document.getElementById('countResolved');
        if (totalEl) totalEl.innerText = total;
        if (activeEl) activeEl.innerText = active;
        if (resolvedEl) resolvedEl.innerText = resolved;
    }
    window.renderStats = renderStats;

    function updateBatchUI() {
        var checkboxes = document.querySelectorAll('.issue-check:checked');
        var count = checkboxes.length;
        var container = document.getElementById('batchActionContainer');
        var badge = document.getElementById('selectedCountBadge');
        if (count > 0) {
            if (container) container.style.display = 'block';
            if (badge) badge.textContent = '(' + count + ')';
        } else {
            if (container) container.style.display = 'none';
            if (badge) badge.textContent = '';
        }
    }
    window.updateBatchUI = updateBatchUI;

    function applyFilters() {
        window.issuesPage = 1;
        saveSearchViewState();
        loadIssuesPage(1);
    }
    window.applyFilters = applyFilters;

    async function loadIssuesPage(page) {
        page = page || 1;
        window.issuesPage = page;
        var pageSizeTop = document.getElementById('issuesPageSizeTop');
        var pageSizeBottom = document.getElementById('issuesPageSizeBottom');
        if (pageSizeTop) pageSizeTop.value = window.issuesPageSize;
        if (pageSizeBottom) pageSizeBottom.value = window.issuesPageSize;
        saveSearchViewState();
        var filterKeyword = document.getElementById('filterKeyword');
        var filterYear = document.getElementById('filterYear');
        var filterUnit = document.getElementById('filterUnit');
        var filterStatus = document.getElementById('filterStatus');
        var filterKind = document.getElementById('filterKind');
        var filterDivision = document.getElementById('filterDivision');
        var filterInspection = document.getElementById('filterInspection');
        var filterPlan = document.getElementById('filterPlan');
        var q = filterKeyword ? filterKeyword.value : '';
        var year = filterYear ? filterYear.value : '';
        var unit = filterUnit ? filterUnit.value : '';
        var status = filterStatus ? filterStatus.value : '';
        var kind = filterKind ? filterKind.value : '';
        var division = filterDivision ? filterDivision.value : '';
        var inspection = filterInspection ? filterInspection.value : '';
        var planName = filterPlan ? filterPlan.value : '';
        var sortField = 'year', sortDir = 'desc';
        if (window.sortState && window.sortState.field) {
            if (window.sortState.field === 'number') sortField = 'title';
            else if (window.sortState.field === 'year') sortField = 'year';
            else if (window.sortState.field === 'unit') sortField = 'unit';
            else if (window.sortState.field === 'status') sortField = 'status';
            else if (window.sortState.field === 'content') sortField = 'content';
            else if (window.sortState.field === 'latest') sortField = 'updated_at';
            sortDir = window.sortState.dir || 'asc';
        }
        var params = new URLSearchParams({
            page: window.issuesPage,
            pageSize: window.issuesPageSize,
            q: q, year: year, unit: unit, status: status,
            itemKindCode: kind, division: division, inspectionCategory: inspection,
            planName: planName, sortField: sortField, sortDir: sortDir,
            _t: Date.now()
        });
        try {
            var res = await window.apiFetch('/api/issues?' + params.toString());
            if (!res.ok) {
                var errJson = await res.json().catch(function () { return {}; });
                window.showToast('載入資料失敗: ' + (errJson.error || res.statusText), 'error');
                return;
            }
            var j = await res.json();
            window.currentData = j.data || [];
            window.issuesTotal = j.total || 0;
            window.issuesPages = j.pages || 1;
            var dataTimestamp = document.getElementById('dataTimestamp');
            if (j.latestCreatedAt && dataTimestamp) {
                var d = new Date(j.latestCreatedAt);
                dataTimestamp.innerText = '資料庫更新時間：' + d.toLocaleDateString('zh-TW') + ' ' + d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
            } else if (dataTimestamp) dataTimestamp.innerText = '';
            var filterYearEl = document.getElementById('filterYear');
            if (filterYearEl && filterYearEl.options.length === 0 && j.globalStats) {
                var years = [].slice.call(new Set(j.globalStats.year.map(function (x) { return x.year; }).filter(Boolean))).sort().reverse();
                filterYearEl.innerHTML = '<option value="">全部年度</option>' + years.map(function (v) { return '<option value="' + v + '">' + v + '</option>'; }).join('');
                var filterUnitEl = document.getElementById('filterUnit');
                var units = [].slice.call(new Set(j.globalStats.unit.map(function (x) { return x.unit; }).filter(Boolean))).sort();
                filterUnitEl.innerHTML = '<option value="">全部機構</option>' + units.map(function (v) { return '<option value="' + v + '">' + v + '</option>'; }).join('');
            }
            if (j.globalStats) {
                window.cachedGlobalStats = j.globalStats;
                if (typeof window.updateChartsData === 'function') window.updateChartsData(j.globalStats);
                renderStats(j.globalStats);
            }
            renderTable();
            renderPagination('issuesPagination', window.issuesPage, window.issuesPages, 'loadIssuesPage');
            var totalCountEl = document.getElementById('issuesTotalCount');
            if (totalCountEl) totalCountEl.innerText = window.issuesTotal;
        } catch (e) {
            console.error(e);
            window.showToast('載入資料錯誤 (請檢查 Console)', 'error');
        }
    }
    window.loadIssuesPage = loadIssuesPage;

    function resetFilters() {
        document.querySelectorAll('.filter-input,.filter-select').forEach(function (e) { e.value = ''; });
        applyFilters();
    }
    window.resetFilters = resetFilters;

    function sortData(field) {
        if (!window.sortState) window.sortState = { field: null, dir: 'asc' };
        if (window.sortState.field === field) {
            window.sortState.dir = window.sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
            window.sortState.field = field;
            window.sortState.dir = 'asc';
        }
        saveSearchViewState();
        loadIssuesPage(1);
        if (typeof window.updateSortUI === 'function') window.updateSortUI();
    }
    window.sortData = sortData;

    function updateSortUI() {
        var sortState = window.sortState || {};
        document.querySelectorAll('th').forEach(function (th) {
            th.classList.remove('sort-asc', 'sort-desc');
            var onclick = th.getAttribute('onclick');
            if (onclick && onclick.indexOf("'" + sortState.field + "'") >= 0) {
                th.classList.add(sortState.dir === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });
    }
    window.updateSortUI = updateSortUI;

    function toggleAllCheckboxes() {
        var selectAll = document.getElementById('selectAll');
        var checkboxes = document.querySelectorAll('.issue-check');
        if (!selectAll || !checkboxes.length) return;
        checkboxes.forEach(function (cb) { cb.checked = selectAll.checked; });
        updateBatchUI();
    }
    window.toggleAllCheckboxes = toggleAllCheckboxes;

    async function batchDeleteIssues() {
        var checkboxes = document.querySelectorAll('.issue-check:checked');
        if (checkboxes.length === 0) {
            window.showToast('請至少選擇一筆資料', 'error');
            return;
        }
        var ids = Array.from(checkboxes).map(function (cb) { return cb.value; });
        var confirmed = false;
        if (typeof window.showConfirmModal === 'function') {
            confirmed = await window.showConfirmModal('確定要刪除 ' + ids.length + ' 筆資料嗎？\n\n此操作無法復原！', '確定刪除', '取消');
        } else {
            confirmed = confirm('確定要刪除 ' + ids.length + ' 筆資料嗎？\n\n此操作無法復原！');
        }
        if (!confirmed) return;
        try {
            var res = await window.apiFetch('/api/issues/batch-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: ids })
            });
            if (res.ok) {
                checkboxes.forEach(function (cb) { cb.checked = false; });
                updateBatchUI();
                await loadIssuesPage(window.issuesPage);
                window.showToast('成功刪除 ' + ids.length + ' 筆資料', 'success');
            } else {
                var j = await res.json().catch(function () { return {}; });
                window.showToast('刪除失敗: ' + (j.error || '不明錯誤'), 'error');
            }
        } catch (e) {
            window.showToast('刪除失敗: ' + e.message, 'error');
        }
    }
    window.batchDeleteIssues = batchDeleteIssues;

    function renderTable() {
        var tbody = document.getElementById('dataBody');
        var emptyMsg = document.getElementById('emptyMsg');
        if (!tbody) return;
        tbody.innerHTML = '';
        var currentData = window.currentData || [];
        if (!currentData || currentData.length === 0) {
            if (emptyMsg) emptyMsg.style.display = 'block';
            return;
        }
        if (emptyMsg) emptyMsg.style.display = 'none';
        var currentUser = window.currentUser;
        var canManage = currentUser && (currentUser.isAdmin === true || currentUser.role === 'manager');
        var canEdit = currentUser && (currentUser.isAdmin === true || currentUser.role === 'manager');
        var isViewer = currentUser && currentUser.role === 'viewer';
        var batchContainer = document.getElementById('batchActionContainer');
        var badgeEl = document.getElementById('selectedCountBadge');
        var selectAll = document.getElementById('selectAll');
        if (batchContainer) batchContainer.style.display = 'none';
        if (badgeEl) badgeEl.innerText = '';
        if (selectAll) selectAll.checked = false;
        document.querySelectorAll('.manager-col').forEach(function (el) {
            el.style.display = canManage ? 'table-cell' : 'none';
        });
        var getLatestReviewOrHandling = window.getLatestReviewOrHandling;
        var stripHtml = window.stripHtml;
        var extractKindCodeFromNumber = window.extractKindCodeFromNumber;
        var getKindLabel = window.getKindLabel;
        var html = '';
        currentData.forEach(function (item) {
            try {
                var badge = '';
                var st = String(item.status || 'Open');
                if (st !== 'Open') {
                    var stClass = st === '持續列管' ? 'active' : (st === '解除列管' ? 'resolved' : 'self');
                    badge = '<span class="badge ' + stClass + '">' + st + '</span>';
                }
                var updateTxt = '-';
                if (getLatestReviewOrHandling) {
                    var latest = getLatestReviewOrHandling(item);
                    if (latest) {
                        var prefix = latest.type === 'review' ? '[審]' : '[回]';
                        updateTxt = prefix + ' ' + (stripHtml ? stripHtml(latest.content).slice(0, 80) : latest.content.slice(0, 80));
                    }
                }
                var aiContent = '';
                if (item.aiResult && item.aiResult.status === 'done') {
                    var f = String(item.aiResult.fulfill || '');
                    var isYes = f.indexOf('是') >= 0 || f.indexOf('Yes') >= 0;
                    aiContent = '<div class="ai-tag ' + (isYes ? 'yes' : 'no') + '">' + (isYes ? '✅' : '⚠️') + ' ' + f + '</div>';
                }
                var btnText = isViewer ? '✏️ 查看詳情' : '✏️ 審查/查看詳情';
                var editBtn = (canEdit || isViewer) ? '<button class="badge" style="background:#fff;border:1px solid #ddd;cursor:pointer;margin-top:4px;" onclick="event.stopPropagation();openDetail(\'' + item.id + '\',false)">' + btnText + '</button>' : '';
                var checkbox = canManage ? '<td class="manager-col"><input type="checkbox" class="issue-check" value="' + item.id + '" onclick="event.stopPropagation(); updateBatchUI()"></td>' : '<td class="manager-col" style="display:none"></td>';
                var k = item.itemKindCode || item.item_kind_code;
                if (!k && extractKindCodeFromNumber) k = extractKindCodeFromNumber(item.number);
                var kindLabel = getKindLabel ? getKindLabel(k) : '';
                var statusHtml = '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">' + kindLabel + badge + '</div>';
                var snippet = stripHtml ? stripHtml(item.content || '').slice(0, 180) : String(item.content || '').slice(0, 180);
                var fullHtml = String(item.content || '');
                var moreLink = (stripHtml && stripHtml(item.content || '').length > 180) ? ' <a href=\'javascript:void(0)\' onclick="event.stopPropagation();showPreview(' + JSON.stringify(fullHtml) + ', \'編號 ' + item.number + ' 內容\')">...更多</a>' : '';
                html += '<tr onclick="openDetail(\'' + item.id + '\',false)">' + checkbox + '<td data-label="年度">' + (item.year || '') + '</td><td data-label="編號" style="font-weight:600;color:var(--primary);">' + (item.number || '') + '</td><td data-label="機構">' + (item.unit || '') + '</td><td data-label="狀態與類型">' + statusHtml + '</td><td data-label="事項內容"><div class="text-content">' + snippet + moreLink + '</div></td><td data-label="最新辦理/審查情形"><div class="text-content">' + (stripHtml ? stripHtml(updateTxt) : updateTxt) + '</div></td><td data-label="操作"><div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">' + aiContent + editBtn + '</div></td></tr>';
            } catch (err) {
                console.error('Skipping bad row:', item, err);
            }
        });
        tbody.innerHTML = html;
    }
    window.renderTable = renderTable;

    function onIssuesPageSizeChange(val) {
        window.issuesPageSize = parseInt(val, 10);
        saveSearchViewState();
        loadIssuesPage(1);
    }
    window.onIssuesPageSizeChange = onIssuesPageSizeChange;

    function toggleAdvancedFilters(btn) {
        var panel = document.getElementById('advancedFilters');
        if (!panel || !btn) return;
        var isShown = panel.classList.contains('show');
        if (isShown) {
            panel.classList.remove('show');
            btn.innerText = '⬇️ 顯示更多篩選條件';
        } else {
            panel.classList.add('show');
            btn.innerText = '⬆️ 收合篩選條件';
        }
    }
    window.toggleAdvancedFilters = toggleAdvancedFilters;

    async function loadFilterPlanOptions() {
        try {
            var res = await fetch('/api/options/plans?withIssues=true&t=' + Date.now(), {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
                credentials: 'include'
            });
            if (!res.ok) return;
            var json = await res.json();
            var select = document.getElementById('filterPlan');
            if (!select) return;
            var currentValue = select.value;
            var firstOption = select.options[0] ? select.options[0].outerHTML : '';
            if (!json.data || json.data.length === 0) {
                if (typeof window.writeLog === 'function') window.writeLog('查詢看板：沒有找到有關聯開立事項的計畫');
                select.innerHTML = firstOption;
                return;
            }
            if (typeof window.writeLog === 'function') window.writeLog('查詢看板：找到 ' + json.data.length + ' 個有關聯開立事項的計畫');
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
                    planValue = p.value || planName + '|||' + planYear;
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
                return (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0);
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
        } catch (e) {
            console.error('Load filter plan options failed', e);
        }
    }
    window.loadFilterPlanOptions = loadFilterPlanOptions;
})();
