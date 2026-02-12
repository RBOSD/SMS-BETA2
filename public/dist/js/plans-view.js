/**
 * 檢查計畫：switchPlansSubTab、loadPlansPage、排程管理（行程規劃月曆）
 * 依賴：core.js, utils.js, search-view.js (renderPagination), modals.js (showConfirmModal), import-view.js (loadPlanOptions)
 */
(function () {
    'use strict';

    var scheduleCalendarYear = new Date().getFullYear();
    var scheduleCalendarMonth = new Date().getMonth() + 1;
    var scheduleMonthData = [];
    var schedulePlanDetails = {};
    var schedulePlanNumberDebounceTimer = null;

    var SCHEDULE_PLAN_COLORS = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff', '#d1fae5', '#fed7aa', '#e9d5ff'];
    var SCHEDULE_PLAN_TEXT_COLORS = ['#1e40af', '#166534', '#92400e', '#9d174d', '#3730a3', '#065f46', '#c2410c', '#6b21a8'];

    function schedulePlanColorIndex(inspectionType) {
        var typeMap = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
        var type = String(inspectionType || '').trim();
        return typeMap[type] !== undefined ? typeMap[type] : 5;
    }

    function switchPlansSubTab(subTab) {
        sessionStorage.setItem('currentPlansSubTab', subTab);
        document.querySelectorAll('#tab-data-plans .admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        if (typeof event !== 'undefined' && event && event.target) {
            event.target.classList.add('active');
        } else {
            document.querySelectorAll('#tab-data-plans .admin-tab-btn').forEach(function (btn) {
                if (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf("'" + subTab + "'") >= 0) {
                    btn.classList.add('active');
                }
            });
        }
        document.getElementById('subtab-plans-manage').classList.toggle('hidden', subTab !== 'manage');
        document.getElementById('subtab-plans-schedule').classList.toggle('hidden', subTab !== 'schedule');
        if (subTab === 'manage') {
            restorePlansViewState();
            setTimeout(function () {
                loadPlansPage(window.plansPage || 1);
            }, 200);
        }
        if (subTab === 'schedule') {
            initScheduleCalendar();
        }
    }
    window.switchPlansSubTab = switchPlansSubTab;

    function savePlansViewState() {
        var state = {
            search: (document.getElementById('planSearch') && document.getElementById('planSearch').value) || '',
            year: (document.getElementById('planYearFilter') && document.getElementById('planYearFilter').value) || '',
            page: window.plansPage,
            pageSize: window.plansPageSize,
            sortField: window.plansSortField,
            sortDir: window.plansSortDir
        };
        sessionStorage.setItem('plansViewState', JSON.stringify(state));
    }

    function restorePlansViewState() {
        var saved = sessionStorage.getItem('plansViewState');
        if (!saved) return;
        try {
            var state = JSON.parse(saved);
            if (document.getElementById('planSearch')) document.getElementById('planSearch').value = state.search || '';
            if (document.getElementById('planYearFilter')) document.getElementById('planYearFilter').value = state.year || '';
            if (state.page) window.plansPage = state.page;
            if (state.pageSize) window.plansPageSize = state.pageSize;
            if (state.sortField) window.plansSortField = state.sortField;
            if (state.sortDir) window.plansSortDir = state.sortDir;
        } catch (e) {}
    }
    window.restorePlansViewState = restorePlansViewState;

    async function loadPlansPage(page) {
        page = page || 1;
        window.plansPage = page;
        var plansPageSizeEl = document.getElementById('plansPageSize');
        if (plansPageSizeEl) {
            window.plansPageSize = parseInt(plansPageSizeEl.value, 10) || 20;
        }
        var q = (document.getElementById('planSearch') && document.getElementById('planSearch').value) || '';
        var year = (document.getElementById('planYearFilter') && document.getElementById('planYearFilter').value) || '';
        savePlansViewState();
        var params = new URLSearchParams({
            page: window.plansPage,
            pageSize: window.plansPageSize,
            q: q,
            year: year,
            sortField: window.plansSortField,
            sortDir: window.plansSortDir,
            _t: Date.now()
        });
        try {
            var res = await fetch('/api/plans?' + params.toString());
            if (!res.ok) {
                window.showToast('載入計畫失敗: ' + (res.status === 500 ? '伺服器錯誤' : '請求失敗'), 'error');
                return;
            }
            var j = await res.json();
            window.planList = j.data || [];
            window.plansTotal = j.total || 0;
            window.plansPages = j.pages || 1;
            await renderPlans();
            if (typeof window.renderPagination === 'function') {
                window.renderPagination('plansPagination', window.plansPage, window.plansPages, 'loadPlansPage');
            }
            updatePlanYearOptions();
        } catch (e) {
            window.showToast('載入計畫錯誤: ' + e.message, 'error');
        }
    }
    window.loadPlansPage = loadPlansPage;

    function getInspectionTypeName(type) {
        var typeMap = { '1': '年度定期檢查', '2': '特別檢查', '3': '例行性檢查', '4': '臨時檢查', '5': '調查' };
        return typeMap[String(type)] || '-';
    }

    function getBusinessTypeName(code) {
        var typeMap = { 'OP': '運轉', 'CV': '土建', 'ME': '機務', 'EL': '電務', 'SM': '安全管理', 'AD': '營運／災防審核', 'OT': '其他／產管規劃' };
        return typeMap[String(code)] || '-';
    }

    async function renderPlans() {
        var tbody = document.getElementById('plansTableBody');
        if (!tbody) return;
        var rows = [];
        var planList = window.planList || [];
        for (var i = 0; i < planList.length; i++) {
            var p = planList[i];
            var codesHtml = '';
            var datesHtml = '';
            var locationsHtml = '';
            var inspectorsHtml = '';
            var inspectionTypeHtml = '';
            try {
                var scheduleRes = await fetch('/api/plans/' + p.id + '/schedules?t=' + Date.now(), { credentials: 'include' });
                if (scheduleRes.ok) {
                    var scheduleData = await scheduleRes.json();
                    var schedules = scheduleData.data || [];
                    var validSchedules = schedules.filter(function (s) {
                        return s.start_date && s.plan_number && s.plan_number !== '(手動)';
                    });
                    if (validSchedules.length > 0) {
                        codesHtml = validSchedules.map(function (s) { return '<div style="margin:2px 0; font-size:12px;">' + (s.plan_number || '-') + '</div>'; }).join('');
                        datesHtml = validSchedules.map(function (s) {
                            var startDate = s.start_date ? s.start_date.slice(0, 10) : '-';
                            var endDate = s.end_date ? s.end_date.slice(0, 10) : null;
                            var range = endDate && endDate !== startDate ? startDate + ' ~ ' + endDate : startDate;
                            return '<div style="margin:2px 0; font-size:12px;">' + range + '</div>';
                        }).join('');
                        locationsHtml = validSchedules.map(function (s) { return '<div style="margin:2px 0; font-size:12px;">' + (s.location || '-') + '</div>'; }).join('');
                        inspectorsHtml = validSchedules.map(function (s) { return '<div style="margin:2px 0; font-size:12px;">' + (s.inspector || '-') + '</div>'; }).join('');
                        var firstType = validSchedules[0] && validSchedules[0].inspection_type;
                        inspectionTypeHtml = firstType ? '<div style="margin:2px 0; font-size:12px;">' + getInspectionTypeName(firstType) + '</div>' : '<span style="color:#94a3b8; font-size:12px;">—</span>';
                    } else {
                        inspectionTypeHtml = p.inspection_type ? '<div style="margin:2px 0; font-size:12px;">' + getInspectionTypeName(p.inspection_type) + '</div>' : '<span style="color:#94a3b8; font-size:12px;">—</span>';
                    }
                } else {
                    inspectionTypeHtml = p.inspection_type ? '<div style="margin:2px 0; font-size:12px;">' + getInspectionTypeName(p.inspection_type) + '</div>' : '<span style="color:#94a3b8; font-size:12px;">—</span>';
                }
            } catch (e) {
                inspectionTypeHtml = p.inspection_type ? '<div style="margin:2px 0; font-size:12px;">' + getInspectionTypeName(p.inspection_type) + '</div>' : '<span style="color:#94a3b8; font-size:12px;">—</span>';
            }
            var createdDate = p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : '-';
            var businessHtml = p.business ? getBusinessTypeName(p.business) : '<span style="color:#94a3b8;">—</span>';
            var plannedCountHtml = p.planned_count != null ? String(p.planned_count) : '<span style="color:#94a3b8;">—</span>';
            var scheduleCountVal = p.schedule_count != null ? p.schedule_count : 0;
            rows.push('<tr><td data-label="選擇" style="padding:12px;text-align:center;"><input type="checkbox" class="plan-check" value="' + p.id + '" onchange="updatePlansBatchDeleteBtn()"></td><td data-label="年度" style="padding:12px;font-weight:600;">' + (p.year || '-') + '</td><td data-label="檢查類別" style="padding:12px;">' + inspectionTypeHtml + '</td><td data-label="檢查計畫名稱" style="padding:12px;font-weight:600;">' + (p.name || '-') + '</td><td data-label="業務類型" style="padding:12px;">' + businessHtml + '</td><td data-label="規劃次數" style="padding:12px;text-align:center;">' + plannedCountHtml + '</td><td data-label="已檢查次數" style="padding:12px;text-align:center;">' + scheduleCountVal + '</td><td data-label="檢查起訖日期" style="padding:12px;">' + (datesHtml || '<span style="color:#94a3b8; font-size:12px;">—</span>') + '</td><td data-label="地點" style="padding:12px;">' + (locationsHtml || '<span style="color:#94a3b8; font-size:12px;">—</span>') + '</td><td data-label="檢查人員" style="padding:12px;">' + (inspectorsHtml || '<span style="color:#94a3b8; font-size:12px;">—</span>') + '</td><td data-label="取號編碼" style="padding:12px;">' + (codesHtml || '<span style="color:#94a3b8; font-size:12px;">無</span>') + '</td><td data-label="開立事項數量" style="padding:12px;text-align:center;">' + (p.issue_count || 0) + '</td><td data-label="建立日期" style="padding:12px;">' + createdDate + '</td><td data-label="操作" style="padding:12px;"><button class="btn btn-outline" style="padding:2px 6px;margin-right:4px;" onclick="openPlanModal(\'edit\', ' + p.id + ')">✏️</button><button class="btn btn-danger" style="padding:2px 6px;" onclick="deletePlan(' + p.id + ')">🗑️</button></td></tr>');
        }
        tbody.innerHTML = rows.join('');
        updatePlansBatchDeleteBtn();
    }

    function toggleSelectAllPlans() {
        var selectAll = document.getElementById('selectAllPlans');
        var checkboxes = document.querySelectorAll('.plan-check');
        var isChecked = selectAll ? selectAll.checked : false;
        checkboxes.forEach(function (cb) { cb.checked = isChecked; });
        if (selectAll) selectAll.checked = isChecked;
        updatePlansBatchDeleteBtn();
    }
    window.toggleSelectAllPlans = toggleSelectAllPlans;

    function updatePlansBatchDeleteBtn() {
        var checkboxes = document.querySelectorAll('.plan-check:checked');
        var count = checkboxes.length;
        var container = document.getElementById('plansBatchActionContainer');
        var badge = document.getElementById('selectedPlansCountBadge');
        var selectAll = document.getElementById('selectAllPlans');
        if (container) container.style.display = count > 0 ? 'block' : 'none';
        if (badge) badge.textContent = count > 0 ? '(' + count + ')' : '';
        if (selectAll) {
            var allCheckboxes = document.querySelectorAll('.plan-check');
            selectAll.checked = checkboxes.length > 0 && checkboxes.length === allCheckboxes.length;
        }
    }
    window.updatePlansBatchDeleteBtn = updatePlansBatchDeleteBtn;

    async function batchDeletePlans() {
        var checkboxes = document.querySelectorAll('.plan-check:checked');
        if (checkboxes.length === 0) {
            window.showToast('請至少選擇一筆資料', 'error');
            return;
        }
        var ids = Array.from(checkboxes).map(function (cb) { return parseInt(cb.value, 10); });
        var planList = window.planList || [];
        var planNames = ids.map(function (id) {
            var plan = planList.find(function (p) { return p.id === id; });
            return plan ? (plan.name || '') + (plan.year ? ' (' + plan.year + ')' : '') : '';
        }).filter(Boolean);
        var confirmed = await window.showConfirmModal('確定要刪除以下 ' + ids.length + ' 筆檢查計畫嗎？\n\n' + planNames.slice(0, 5).join('\n') + (planNames.length > 5 ? '\n...' : '') + '\n\n此操作無法復原！', '確定刪除', '取消');
        if (!confirmed) return;
        try {
            var successCount = 0;
            var failCount = 0;
            var errors = [];
            for (var i = 0; i < ids.length; i++) {
                var id = ids[i];
                try {
                    var res = await window.apiFetch('/api/plans/' + id, { method: 'DELETE' });
                    var j = await res.json().catch(function () { return {}; });
                    if (res.ok) {
                        successCount++;
                    } else {
                        failCount++;
                        var plan = planList.find(function (p) { return p.id === id; });
                        var planName = plan ? (plan.name || '') + (plan.year ? ' (' + plan.year + ')' : '') : 'ID:' + id;
                        errors.push(planName + ': ' + (j.error || '刪除失敗'));
                    }
                } catch (e) {
                    failCount++;
                    var plan2 = planList.find(function (p) { return p.id === id; });
                    var planName2 = plan2 ? (plan2.name || '') + (plan2.year ? ' (' + plan2.year + ')' : '') : 'ID:' + id;
                    errors.push(planName2 + ': ' + e.message);
                }
            }
            if (successCount > 0) {
                var msg = '成功刪除 ' + successCount + ' 筆';
                if (failCount > 0) msg += '，失敗 ' + failCount + ' 筆';
                window.showToast(msg, failCount > 0 ? 'warning' : 'success');
                loadPlansPage(window.plansPage);
                if (typeof window.loadPlanOptions === 'function') window.loadPlanOptions();
                var scheduleTab = document.getElementById('subtab-plans-schedule');
                if (scheduleTab && !scheduleTab.classList.contains('hidden')) {
                    scheduleMonthData = [];
                    loadScheduleForMonth();
                }
            } else {
                window.showToast('刪除失敗：' + (errors.length > 0 ? errors[0] : '未知錯誤'), 'error');
            }
        } catch (e) {
            window.showToast('刪除時發生錯誤: ' + e.message, 'error');
        }
    }
    window.batchDeletePlans = batchDeletePlans;

    function plansSortBy(field) {
        if (window.plansSortField === field) {
            window.plansSortDir = window.plansSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            window.plansSortField = field;
            window.plansSortDir = 'asc';
        }
        savePlansViewState();
        loadPlansPage(1);
    }
    window.plansSortBy = plansSortBy;

    function updatePlanYearOptions() {
        var planList = window.planList || [];
        var yearSet = new Set();
        planList.forEach(function (p) { if (p.year) yearSet.add(p.year); });
        var years = Array.from(yearSet).sort(function (a, b) { return b.localeCompare(a); });
        var select = document.getElementById('planYearFilter');
        if (select) {
            var currentValue = select.value;
            var firstOption = select.options[0] ? select.options[0].outerHTML : '<option value="">全部年度</option>';
            select.innerHTML = firstOption + years.map(function (y) { return '<option value="' + y + '">' + y + '年</option>'; }).join('');
            if (currentValue) select.value = currentValue;
        }
    }

    function initScheduleCalendar() {
        var now = new Date();
        scheduleCalendarYear = now.getFullYear();
        scheduleCalendarMonth = now.getMonth() + 1;
        renderScheduleCalendar();
        loadScheduleForMonth();
        loadSchedulePlanOptions();
        var startDateInput = document.getElementById('scheduleStartDate');
        var endDateInput = document.getElementById('scheduleEndDate');
        var locationInput = document.getElementById('scheduleLocation');
        var inspectorInput = document.getElementById('scheduleInspector');
        if (startDateInput) {
            startDateInput.removeEventListener('change', scheduleOnDateChange);
            startDateInput.addEventListener('change', scheduleOnDateChange);
        }
        if (endDateInput) {
            endDateInput.removeEventListener('change', scheduleOnDateChange);
            endDateInput.addEventListener('change', scheduleOnDateChange);
        }
        if (locationInput) {
            locationInput.removeEventListener('input', scheduleMaybeUpdatePlanNumberDebounced);
            locationInput.addEventListener('input', scheduleMaybeUpdatePlanNumberDebounced);
        }
        if (inspectorInput) {
            inspectorInput.removeEventListener('input', scheduleMaybeUpdatePlanNumberDebounced);
            inspectorInput.addEventListener('input', scheduleMaybeUpdatePlanNumberDebounced);
        }
        scheduleClearForm();
    }
    window.initScheduleCalendar = initScheduleCalendar;

    function scheduleCanShowPlanNumber() {
        var planValue = (document.getElementById('schedulePlanSelect') || {}).value || '';
        var startDateVal = (document.getElementById('scheduleStartDate') || {}).value || '';
        var endDateVal = (document.getElementById('scheduleEndDate') || {}).value || '';
        var locationValue = ((document.getElementById('scheduleLocation') || {}).value || '').trim();
        var inspectorValue = ((document.getElementById('scheduleInspector') || {}).value || '').trim();
        return !!(planValue && schedulePlanDetails.railway && schedulePlanDetails.inspection_type && startDateVal && endDateVal && locationValue && inspectorValue);
    }

    async function scheduleMaybeUpdatePlanNumber() {
        if (!scheduleCanShowPlanNumber()) {
            hideSchedulePlanNumber();
            return;
        }
        await updateSchedulePlanNumber();
    }

    function scheduleMaybeUpdatePlanNumberDebounced() {
        if (schedulePlanNumberDebounceTimer) clearTimeout(schedulePlanNumberDebounceTimer);
        schedulePlanNumberDebounceTimer = setTimeout(function () {
            scheduleMaybeUpdatePlanNumber().catch(function () {});
        }, 300);
    }

    function scheduleUpdateYearFromStartDate() {
        var v = (document.getElementById('scheduleStartDate') || {}).value || '';
        var wrap = document.getElementById('scheduleYearDisplayWrap');
        var display = document.getElementById('scheduleYearDisplay');
        if (!wrap || !display) return;
        if (!v) {
            wrap.style.display = 'none';
            display.textContent = '由開始日期自動換算';
            return;
        }
        var y = parseInt(v.slice(0, 4), 10);
        var roc = y - 1911;
        display.textContent = '民國 ' + roc + ' 年';
        wrap.style.display = 'block';
    }

    async function scheduleOnDateChange() {
        var startDateInput = document.getElementById('scheduleStartDate');
        var endDateInput = document.getElementById('scheduleEndDate');
        var v = startDateInput?.value || '';
        var sel = document.getElementById('scheduleSelectedDate');
        if (sel) sel.value = v;
        scheduleUpdateYearFromStartDate();
        if (v && endDateInput) {
            var date = new Date(v);
            var year = date.getFullYear();
            var month = date.getMonth();
            var firstDay = year + '-' + String(month + 1).padStart(2, '0') + '-01';
            var lastDay = new Date(year, month + 1, 0).getDate();
            var lastDayStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
            endDateInput.setAttribute('min', firstDay);
            endDateInput.setAttribute('max', lastDayStr);
            var currentEndDate = endDateInput.value;
            if (currentEndDate && (currentEndDate < firstDay || currentEndDate > lastDayStr)) {
                endDateInput.value = '';
            }
        } else if (!v && endDateInput) {
            endDateInput.value = '';
            endDateInput.removeAttribute('min');
            endDateInput.removeAttribute('max');
        }
        if (!v) {
            scheduleRenderDayList('');
            hideSchedulePlanNumber();
            return;
        }
        var parts = v.split('-').map(Number);
        var py = parts[0], pm = parts[1];
        if (py && pm && (py !== scheduleCalendarYear || pm !== scheduleCalendarMonth)) {
            scheduleCalendarYear = py;
            scheduleCalendarMonth = pm;
            await loadScheduleForMonth();
            renderScheduleCalendar();
        }
        scheduleRenderDayList(v);
        await scheduleMaybeUpdatePlanNumber();
    }

    async function updateSchedulePlanNumber() {
        if (!scheduleCanShowPlanNumber() || !schedulePlanDetails.railway || !schedulePlanDetails.inspection_type) {
            hideSchedulePlanNumber();
            return;
        }
        var startDateInput = document.getElementById('scheduleStartDate');
        var startDateVal = startDateInput?.value || '';
        if (!startDateVal) {
            hideSchedulePlanNumber();
            return;
        }
        try {
            var adYear = parseInt(startDateVal.slice(0, 4), 10);
            var rocYear = adYear - 1911;
            var yr = String(rocYear).replace(/\D/g, '').slice(-3).padStart(3, '0');
            var url = '/api/plan-schedule/next-number?year=' + encodeURIComponent(yr) + '&railway=' + encodeURIComponent(schedulePlanDetails.railway) + '&inspectionType=' + encodeURIComponent(schedulePlanDetails.inspection_type) + '&t=' + Date.now();
            var res = await fetch(url, { credentials: 'include', cache: 'no-store' });
            if (res.ok) {
                var data = await res.json();
                if (data.planNumber) showSchedulePlanNumber(data.planNumber);
                else hideSchedulePlanNumber();
            } else {
                hideSchedulePlanNumber();
            }
        } catch (e) {
            console.error('取得取號編號失敗:', e);
            hideSchedulePlanNumber();
        }
    }

    function showSchedulePlanNumber(planNumber) {
        var displayDiv = document.getElementById('schedulePlanNumberDisplay');
        var valueEl = document.getElementById('schedulePlanNumberValue');
        if (displayDiv && valueEl) {
            valueEl.textContent = planNumber || '';
            displayDiv.style.display = 'block';
        }
    }

    function hideSchedulePlanNumber() {
        var displayDiv = document.getElementById('schedulePlanNumberDisplay');
        var valueEl = document.getElementById('schedulePlanNumberValue');
        if (displayDiv) displayDiv.style.display = 'none';
        if (valueEl) valueEl.textContent = '-';
    }

    function schedulePrevMonth() {
        if (scheduleCalendarMonth === 1) {
            scheduleCalendarYear--;
            scheduleCalendarMonth = 12;
        } else {
            scheduleCalendarMonth--;
        }
        renderScheduleCalendar();
        loadScheduleForMonth();
    }
    window.schedulePrevMonth = schedulePrevMonth;

    function scheduleNextMonth() {
        if (scheduleCalendarMonth === 12) {
            scheduleCalendarYear++;
            scheduleCalendarMonth = 1;
        } else {
            scheduleCalendarMonth++;
        }
        renderScheduleCalendar();
        loadScheduleForMonth();
    }
    window.scheduleNextMonth = scheduleNextMonth;

    function renderScheduleCalendar() {
        var holidayData = window.holidayData || {};
        var title = document.getElementById('scheduleMonthTitle');
        var cal = document.getElementById('scheduleCalendar');
        if (!title || !cal) return;
        title.textContent = scheduleCalendarYear + ' 年 ' + scheduleCalendarMonth + ' 月';
        var y = scheduleCalendarYear;
        var m = scheduleCalendarMonth;
        var first = new Date(y, m - 1, 1);
        var last = new Date(y, m, 0);
        var startPad = first.getDay();
        var days = last.getDate();
        var pad = Array(startPad).fill(0).map(function () { return '<div class="schedule-cal-day schedule-cal-pad"></div>'; }).join('');
        var dayCells = [];
        for (var d = 1; d <= days; d++) {
            var dateStr = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            var holidayVal = holidayData[dateStr];
            var isHoliday = !!holidayVal;
            var holidayName = (typeof holidayVal === 'string' && holidayVal) ? holidayVal : '假日';
            var plansForDay = scheduleMonthData.filter(function (s) {
                var startStr = (s.start_date || '').slice(0, 10);
                var endStr = (s.end_date || '').slice(0, 10) || startStr;
                return startStr && dateStr >= startStr && dateStr <= endStr;
            });
            var hasPlan = plansForDay.length > 0;
            var colorIndices = plansForDay.map(function (s) { return schedulePlanColorIndex(s.inspection_type); });
            var colorDots = colorIndices.map(function (idx, i) {
                var name = (plansForDay[i].plan_name || '').trim() || '未命名';
                return '<span class="schedule-cal-color-dot" style="background:' + SCHEDULE_PLAN_COLORS[idx] + ';" title="' + name + '"></span>';
            }).join('');
            var colorDotsHtml = colorDots ? '<div class="schedule-cal-dots">' + colorDots + '</div>' : '';
            var planItems = plansForDay.map(function (s, i) {
                var idx = colorIndices[i];
                var tc = SCHEDULE_PLAN_TEXT_COLORS[idx] || '#1e3a8a';
                var name = (s.plan_name || '').trim() || '未命名';
                var location = (s.location || '').trim() || '';
                var inspector = (s.inspector || '').trim() || '';
                var planInfo = [];
                planInfo.push('<div class="schedule-cal-plan-name" style="color:' + tc + '; font-weight:600; font-size:12px; margin-bottom:2px;">' + name + '</div>');
                if (location) planInfo.push('<div class="schedule-cal-plan-detail" style="color:#64748b; font-size:11px; margin-bottom:1px;">📍 ' + location + '</div>');
                if (inspector) planInfo.push('<div class="schedule-cal-plan-detail" style="color:#64748b; font-size:11px;">👤 ' + inspector + '</div>');
                return '<div class="schedule-cal-plan-item" style="margin-bottom:3px; padding:2px 0;">' + planInfo.join('') + '</div>';
            });
            var planText = planItems.length > 0 ? '<div class="schedule-cal-plan-names">' + planItems.join('') + '</div>' : '';
            var primaryColorIdx = hasPlan ? colorIndices[0] : 0;
            var colorClass = hasPlan ? 'schedule-cal-plan-' + primaryColorIdx : '';
            var finalHolidayClass = isHoliday ? 'schedule-cal-holiday' : '';
            var bgStyle = isHoliday ? 'background:#fef2f2 !important;' : '';
            var numColor = isHoliday ? 'color:#dc2626;' : '';
            var holidayTag = isHoliday ? '<span class="schedule-cal-holiday-tag" title="' + holidayName + '">假日</span>' : '';
            var dayNumWrap = hasPlan
                ? '<div class="schedule-cal-day-num-wrap"><div class="schedule-cal-day-num" style="' + numColor + '">' + d + '</div><span class="schedule-cal-day-count">共 ' + plansForDay.length + ' 筆</span></div>'
                : '<div class="schedule-cal-day-num" style="' + numColor + '">' + d + '</div>';
            dayCells.push('<div class="schedule-cal-day ' + (hasPlan ? 'has-plan ' + colorClass : '') + ' ' + finalHolidayClass + '" style="' + bgStyle + '" data-date="' + dateStr + '" onclick="scheduleSelectDay(\'' + dateStr + '\')">' + dayNumWrap + holidayTag + colorDotsHtml + planText + '</div>');
        }
        cal.innerHTML = '<div class="schedule-cal-head">日</div><div class="schedule-cal-head">一</div><div class="schedule-cal-head">二</div><div class="schedule-cal-head">三</div><div class="schedule-cal-head">四</div><div class="schedule-cal-head">五</div><div class="schedule-cal-head">六</div>' + pad + dayCells.join('');
    }

    async function printScheduleCalendar() {
        var holidayData = window.holidayData || {};
        var title = document.getElementById('scheduleMonthTitle');
        if (!title) return;
        var y = scheduleCalendarYear;
        var m = scheduleCalendarMonth;
        var first = new Date(y, m - 1, 1);
        var last = new Date(y, m, 0);
        var startPad = first.getDay();
        var days = last.getDate();
        var pad = Array(startPad).fill(0).map(function () { return '<div class="schedule-cal-day schedule-cal-pad"></div>'; }).join('');
        var dayCells = [];
        for (var d = 1; d <= days; d++) {
            var dateStr = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            var holidayVal = holidayData[dateStr];
            var isHoliday = !!holidayVal;
            var holidayName = (typeof holidayVal === 'string' && holidayVal) ? holidayVal : '假日';
            var plansForDay = scheduleMonthData.filter(function (s) {
                var startStr = (s.start_date || '').slice(0, 10);
                var endStr = (s.end_date || '').slice(0, 10) || startStr;
                return startStr && dateStr >= startStr && dateStr <= endStr;
            });
            var hasPlan = plansForDay.length > 0;
            var colorIndices = plansForDay.map(function (s) { return schedulePlanColorIndex(s.inspection_type); });
            var colorDots = colorIndices.map(function (idx, i) {
                var name = (plansForDay[i].plan_name || '').trim() || '未命名';
                return '<span class="schedule-cal-color-dot" style="background:' + SCHEDULE_PLAN_COLORS[idx] + ';" title="' + name + '"></span>';
            }).join('');
            var colorDotsHtml = colorDots ? '<div class="schedule-cal-dots">' + colorDots + '</div>' : '';
            var planItems = plansForDay.map(function (s, i) {
                var idx = colorIndices[i];
                var tc = SCHEDULE_PLAN_TEXT_COLORS[idx] || '#1e3a8a';
                var name = (s.plan_name || '').trim() || '未命名';
                var location = (s.location || '').trim() || '';
                var inspector = (s.inspector || '').trim() || '';
                var planInfo = [];
                planInfo.push('<div class="schedule-cal-plan-name" style="color:' + tc + '; font-weight:600; font-size:11px; margin-bottom:2px;">' + name + '</div>');
                if (location) planInfo.push('<div class="schedule-cal-plan-detail" style="color:#64748b; font-size:10px; margin-bottom:1px;">📍 ' + location + '</div>');
                if (inspector) planInfo.push('<div class="schedule-cal-plan-detail" style="color:#64748b; font-size:10px;">👤 ' + inspector + '</div>');
                return '<div class="schedule-cal-plan-item" style="margin-bottom:2px; padding:1px 0;">' + planInfo.join('') + '</div>';
            });
            var planText = planItems.length > 0 ? '<div class="schedule-cal-plan-names">' + planItems.join('') + '</div>' : '';
            var primaryColorIdx = hasPlan ? colorIndices[0] : 0;
            var colorClass = hasPlan ? 'schedule-cal-plan-' + primaryColorIdx : '';
            var bgColor = hasPlan ? SCHEDULE_PLAN_COLORS[primaryColorIdx] : '#fff';
            var finalHolidayClass = isHoliday ? 'schedule-cal-holiday' : '';
            var finalBgColor = isHoliday ? '#fef2f2' : bgColor;
            var numColor = isHoliday ? '#dc2626' : '#334155';
            var holidayTag = isHoliday ? '<span class="schedule-cal-holiday-tag" title="' + holidayName + '">假日</span>' : '';
            dayCells.push('<div class="schedule-cal-day ' + (hasPlan ? 'has-plan ' + colorClass : '') + ' ' + finalHolidayClass + '" style="background:' + finalBgColor + ';"><div class="schedule-cal-day-num" style="color:' + numColor + ';font-weight:700;">' + d + '</div>' + holidayTag + colorDotsHtml + planText + '</div>');
        }
        var calendarHtml = '<div class="schedule-cal-head">日</div><div class="schedule-cal-head">一</div><div class="schedule-cal-head">二</div><div class="schedule-cal-head">三</div><div class="schedule-cal-head">四</div><div class="schedule-cal-head">五</div><div class="schedule-cal-head">六</div>' + pad + dayCells.join('');
        var monthTitle = title.textContent;
        var printWindow = window.open('', '_blank');
        printWindow.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + monthTitle + ' 檢查行程月曆</title><style>@page{size:A4 landscape;margin:18mm 28mm}*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%;width:100%;overflow:hidden;font-family:"Microsoft JhengHei","微軟正黑體","Noto Sans TC",Arial,sans-serif}body{background:#fafafa;padding:0 0 12px 0}.print-header{text-align:center;margin-bottom:14px;padding:10px 0;border-bottom:3px solid #1e40af;background:linear-gradient(180deg,#eff6ff 0%,#fff 100%)}.print-header h1{font-size:20px;font-weight:700;color:#1e3a8a;margin:0}.print-header .sub{font-size:11px;color:#64748b;margin-top:3px}.schedule-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;background:#64748b;border:3px solid #475569;border-radius:8px;overflow:hidden;width:100%;max-width:100%;page-break-inside:avoid}.schedule-cal-head{background:linear-gradient(180deg,#1e40af 0%,#1d4ed8 100%);color:#fff;padding:10px 6px;text-align:center;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;min-height:34px;border-right:2px solid rgba(255,255,255,0.3)}.schedule-cal-head:last-child{border-right:none}.schedule-cal-day{border:2px solid #94a3b8;padding:10px 6px;min-height:100px;background:#fff;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;page-break-inside:avoid;overflow:hidden}.schedule-cal-day-num{font-weight:700;font-size:15px;margin-bottom:4px;color:#0f172a}.schedule-cal-holiday{background:#fef2f2!important}.schedule-cal-holiday .schedule-cal-day-num{color:#b91c1c}.schedule-cal-plan-names{font-size:11px;line-height:1.45;margin-top:4px;width:100%}.schedule-cal-plan-name{font-weight:600;font-size:11px}.schedule-cal-plan-detail{font-size:10px;color:#475569}.schedule-cal-pad{background:#f1f5f9}.schedule-cal-dots{display:flex;gap:3px;flex-wrap:wrap;margin-bottom:3px}.schedule-cal-color-dot{width:6px;height:6px;border-radius:50%;display:inline-block}.schedule-cal-day.schedule-cal-plan-0{background:#dbeafe}.schedule-cal-day.schedule-cal-plan-1{background:#dcfce7}.schedule-cal-day.schedule-cal-plan-2{background:#fef9c3}.schedule-cal-day.schedule-cal-plan-3{background:#fce7f3}.schedule-cal-day.schedule-cal-plan-4{background:#e0e7ff}.schedule-cal-day.schedule-cal-plan-5{background:#d1fae5}.schedule-cal-day.schedule-cal-plan-6{background:#ffedd5}.schedule-cal-day.schedule-cal-plan-7{background:#ede9fe}</style></head><body><div class="print-header"><h1>' + monthTitle + ' 檢查行程月曆</h1><div class="sub">列印日期：' + new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) + '</div></div><div class="schedule-calendar">' + calendarHtml + '</div></body></html>');
        printWindow.document.close();
        setTimeout(function () { printWindow.print(); }, 300);
    }
    window.printScheduleCalendar = printScheduleCalendar;

    async function loadScheduleForMonth() {
        try {
            var res = await fetch('/api/plan-schedule?year=' + scheduleCalendarYear + '&month=' + scheduleCalendarMonth + '&t=' + Date.now(), {
                credentials: 'include',
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!res.ok) {
                scheduleMonthData = [];
                renderScheduleCalendar();
                return;
            }
            var j = await res.json();
            scheduleMonthData = j.data || [];
            try {
                var holidayRes = await fetch('/api/holidays/' + scheduleCalendarYear + '?t=' + Date.now(), {
                    credentials: 'include',
                    cache: 'no-store'
                });
                if (holidayRes.ok) {
                    var holidayJson = await holidayRes.json();
                    window.holidayData = {};
                    (holidayJson.data || []).forEach(function (h) {
                        if (h && h.date && h.isHoliday === true) {
                            var dateStr = String(h.date).slice(0, 10);
                            window.holidayData[dateStr] = (h.name || '').trim() || '假日';
                        }
                    });
                } else {
                    window.holidayData = {};
                }
            } catch (e) {
                window.holidayData = {};
            }
        } catch (e) {
            scheduleMonthData = [];
        }
        renderScheduleCalendar();
    }

    function scheduleSelectDay(dateStr) {
        var startDateInput = document.getElementById('scheduleStartDate');
        if (startDateInput) {
            startDateInput.value = dateStr;
            scheduleUpdateYearFromStartDate();
        }
        var sel = document.getElementById('scheduleSelectedDate');
        if (sel) sel.value = dateStr;
        scheduleRenderDayList(dateStr);
    }
    window.scheduleSelectDay = scheduleSelectDay;

    function scheduleRenderDayList(dateStr) {
        var box = document.getElementById('scheduleDayListBody');
        if (!box) return;
        if (!dateStr) {
            box.innerHTML = '點選月曆日期後顯示';
            return;
        }
        var list = scheduleMonthData.filter(function (s) {
            var startStr = (s.start_date || '').slice(0, 10);
            var endStr = (s.end_date || '').slice(0, 10) || startStr;
            return dateStr >= startStr && dateStr <= endStr;
        });
        if (list.length === 0) {
            box.innerHTML = '當日尚無排程';
            return;
        }
        box.innerHTML = list.map(function (s) {
            var startDate = (s.start_date || '').slice(0, 10);
            var endDate = (s.end_date || '').slice(0, 10);
            var range = endDate && endDate !== startDate ? startDate + ' ~ ' + endDate : startDate;
            var location = (s.location || '').trim() || '';
            var inspector = (s.inspector || '').trim() || '';
            var planNumber = (s.plan_number || '').trim() || '';
            return '<div style="margin-bottom:10px; padding:10px; background:#f1f5f9; border-radius:6px; border-left:3px solid #3b82f6;"><div style="font-weight:600; font-size:14px; margin-bottom:6px; color:#334155;">' + (s.plan_name || '-') + (planNumber ? ' <span style="margin-left:8px; font-size:12px; color:#3b82f6; font-weight:500;">[' + planNumber + ']</span>' : '') + '</div><div style="color:#64748b; font-size:12px; margin-bottom:6px;">📅 ' + range + '</div>' + (location ? '<div style="color:#475569; font-size:12px; margin-bottom:4px;">📍 地點：<span style="font-weight:500;">' + location + '</span></div>' : '') + (inspector ? '<div style="color:#475569; font-size:12px;">👤 人員：<span style="font-weight:500;">' + inspector + '</span></div>' : '') + (!location && !inspector ? '<div style="color:#94a3b8; font-size:11px; font-style:italic;">無地點及人員資訊</div>' : '') + '</div>';
        }).join('');
    }

    function scheduleClearForm() {
        var startDateInput = document.getElementById('scheduleStartDate');
        var endDateInput = document.getElementById('scheduleEndDate');
        var sel = document.getElementById('scheduleSelectedDate');
        if (startDateInput) {
            startDateInput.value = '';
            if (endDateInput) {
                endDateInput.removeAttribute('min');
                endDateInput.removeAttribute('max');
            }
        }
        if (endDateInput) endDateInput.value = '';
        if (sel) sel.value = '';
        var planSelect = document.getElementById('schedulePlanSelect');
        var location = document.getElementById('scheduleLocation');
        var inspector = document.getElementById('scheduleInspector');
        var planInfoDiv = document.getElementById('schedulePlanInfo');
        if (planSelect) planSelect.value = '';
        if (location) location.value = '';
        if (inspector) inspector.value = '';
        if (planInfoDiv) planInfoDiv.style.display = 'none';
        schedulePlanDetails = {};
        hideSchedulePlanNumber();
        scheduleUpdateYearFromStartDate();
        var dayList = document.getElementById('scheduleDayListBody');
        if (dayList) dayList.textContent = '點選月曆日期後顯示';
    }
    window.scheduleClearForm = scheduleClearForm;

    function onScheduleYearFilterChange() {
        loadSchedulePlanOptions();
    }
    window.onScheduleYearFilterChange = onScheduleYearFilterChange;

    async function loadSchedulePlanOptions() {
        try {
            var yearSelect = document.getElementById('scheduleYearFilter');
            var yearParam = yearSelect && yearSelect.value ? '&year=' + encodeURIComponent(yearSelect.value) : '';
            var res = await fetch('/api/options/plans?t=' + Date.now() + yearParam, { credentials: 'include' });
            if (!res.ok) return;
            var j = await res.json();
            var select = document.getElementById('schedulePlanSelect');
            if (!select) return;
            var currentValue = select.value;
            select.innerHTML = '<option value="">請選擇已建立的檢查計畫</option>';
            if (j.data && Array.isArray(j.data)) {
                j.data.forEach(function (p) {
                    var opt = document.createElement('option');
                    opt.value = p.name + '|||' + p.year;
                    opt.textContent = p.name;
                    select.appendChild(opt);
                });
            }
            if (currentValue) select.value = currentValue;
            if (yearSelect && (!yearSelect.options || yearSelect.options.length <= 1)) {
                var allRes = await fetch('/api/options/plans?t=' + Date.now(), { credentials: 'include' });
                if (allRes.ok) {
                    var allJ = await allRes.json();
                    var years = (allJ.data || []).map(function (p) { return p.year; }).filter(Boolean);
                    years = [...new Set(years)].sort(function (a, b) { return b.localeCompare(a); });
                    var firstOpt = yearSelect.options[0] ? yearSelect.options[0].outerHTML : '<option value="">全部年度</option>';
                    yearSelect.innerHTML = firstOpt + years.map(function (y) { return '<option value="' + y + '">' + y + '年</option>'; }).join('');
                }
            }
            select.onchange = async function () {
                var selectedValue = select.value;
                schedulePlanDetails = {};
                hideSchedulePlanNumber();
                var planInfoDiv = document.getElementById('schedulePlanInfo');
                if (planInfoDiv) planInfoDiv.style.display = 'none';
                if (!selectedValue) return;
                var parts = selectedValue.split('|||');
                if (parts.length !== 2) {
                    window.showToast('計畫資訊格式錯誤，請重新選擇', 'error');
                    select.value = '';
                    return;
                }
                var planName = parts[0].trim();
                var planYear = parts[1].trim();
                if (!planName || !planYear) {
                    window.showToast('計畫資訊不完整，請重新選擇', 'error');
                    select.value = '';
                    return;
                }
                try {
                    var apiUrl = '/api/plans/by-name?name=' + encodeURIComponent(planName) + '&year=' + encodeURIComponent(planYear);
                    var response = await fetch(apiUrl, { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' } });
                    if (!response.ok) {
                        var errorMessage = '無法取得計畫資訊';
                        try {
                            var errorData = await response.json();
                            errorMessage = errorData.message || errorData.error || errorMessage;
                        } catch (e) {
                            if (response.status === 404) errorMessage = '找不到該計畫';
                            else if (response.status === 500) errorMessage = '伺服器錯誤，請稍後再試';
                        }
                        window.showToast(errorMessage, 'error');
                        select.value = '';
                        return;
                    }
                    var result = await response.json();
                    if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
                        window.showToast('無法取得計畫資訊', 'error');
                        select.value = '';
                        return;
                    }
                    var plan = result.data[0];
                    var railway = (plan.railway && plan.railway !== '-') ? String(plan.railway).trim() : '';
                    var inspection_type = (plan.inspection_type && plan.inspection_type !== '-') ? String(plan.inspection_type).trim() : '';
                    schedulePlanDetails = { plan_name: planName, year: planYear, railway: railway, inspection_type: inspection_type };
                    if (!railway || !inspection_type) {
                        window.showToast('該計畫缺少必要資訊（鐵路機構、檢查類別），請先在計畫管理中編輯', 'warning');
                        schedulePlanDetails = {};
                        select.value = '';
                        return;
                    }
                    var railwaySpan = document.getElementById('schedulePlanRailway');
                    var inspectionTypeSpan = document.getElementById('schedulePlanInspectionType');
                    if (planInfoDiv && railwaySpan && inspectionTypeSpan) {
                        var railwayNames = { 'T': '臺鐵', 'H': '高鐵', 'A': '林鐵', 'S': '糖鐵' };
                        var inspectionTypeNames = { '1': '年度定期檢查', '2': '特別檢查', '3': '例行性檢查', '4': '臨時檢查', '5': '調查' };
                        railwaySpan.textContent = railwayNames[railway] || railway;
                        inspectionTypeSpan.textContent = inspectionTypeNames[inspection_type] || inspection_type;
                        planInfoDiv.style.display = 'block';
                    }
                    await scheduleMaybeUpdatePlanNumber();
                } catch (error) {
                    window.showToast('無法取得計畫資訊，請稍後再試', 'error');
                    select.value = '';
                    schedulePlanDetails = {};
                }
            };
        } catch (e) {
            console.error('載入計畫選項失敗:', e);
        }
    }
    window.loadSchedulePlanOptions = loadSchedulePlanOptions;

    async function scheduleSubmitPlan() {
        var planSelect = document.getElementById('schedulePlanSelect');
        var planValue = planSelect ? planSelect.value : '';
        if (!planValue) {
            window.showToast('請選擇檢查計畫', 'error');
            return;
        }
        var planParts = planValue.split('|||');
        var planName = planParts[0];
        var planYear = planParts[1];
        if (!planName || !planYear) {
            window.showToast('計畫資訊不完整，請重新選擇', 'error');
            return;
        }
        var startDateVal = (document.getElementById('scheduleStartDate') || {}).value;
        var endDateVal = (document.getElementById('scheduleEndDate') || {}).value;
        var locationValue = ((document.getElementById('scheduleLocation') || {}).value || '').trim();
        var inspectorValue = ((document.getElementById('scheduleInspector') || {}).value || '').trim();
        if (!startDateVal) { window.showToast('請選擇開始日期', 'error'); return; }
        if (!endDateVal) { window.showToast('請選擇結束日期', 'error'); return; }
        if (endDateVal < startDateVal) { window.showToast('結束日期不能早於開始日期', 'error'); return; }
        if (!locationValue) { window.showToast('請填寫地點', 'error'); return; }
        if (!inspectorValue) { window.showToast('請填寫檢查人員', 'error'); return; }
        if (!schedulePlanDetails.railway || !schedulePlanDetails.inspection_type) {
            try {
                var apiUrl = '/api/plans/by-name?name=' + encodeURIComponent(planName) + '&year=' + encodeURIComponent(planYear);
                var planRes = await fetch(apiUrl, { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' } });
                if (!planRes.ok) {
                    var errorData = await planRes.json().catch(function () { return {}; });
                    window.showToast(errorData.message || errorData.error || '無法取得計畫資訊', 'error');
                    return;
                }
                var planData = await planRes.json();
                if (!planData.data || !Array.isArray(planData.data) || planData.data.length === 0) {
                    window.showToast('找不到該計畫，請重新選擇', 'error');
                    return;
                }
                var plan = planData.data[0];
                var railway = (plan.railway && plan.railway !== '-') ? String(plan.railway).trim() : '';
                var inspection_type = (plan.inspection_type && plan.inspection_type !== '-') ? String(plan.inspection_type).trim() : '';
                schedulePlanDetails = { plan_name: planName, year: planYear, railway: railway, inspection_type: inspection_type, owner_group_id: plan.owner_group_id || plan.ownerGroupId || null };
                if (!railway || !inspection_type) {
                    window.showToast('該計畫缺少必要資訊（鐵路機構、檢查類別），請先在計畫管理中編輯該計畫', 'error');
                    return;
                }
            } catch (e) {
                window.showToast('無法取得計畫資訊，請稍後再試', 'error');
                return;
            }
        }
        if (!schedulePlanDetails.railway || !schedulePlanDetails.inspection_type) {
            window.showToast('該計畫缺少必要資訊（鐵路機構、檢查類別），請先在計畫管理中編輯該計畫', 'error');
            return;
        }
        var adYear = parseInt(startDateVal.slice(0, 4), 10);
        var rocYear = adYear - 1911;
        var yr = String(rocYear).replace(/\D/g, '').slice(-3).padStart(3, '0');
        var payload = {
            plan_name: planName,
            start_date: startDateVal,
            end_date: endDateVal,
            year: yr,
            railway: schedulePlanDetails.railway,
            inspection_type: schedulePlanDetails.inspection_type,
            business: null,
            location: locationValue,
            inspector: inspectorValue
        };
        if (schedulePlanDetails.owner_group_id) {
            payload.ownerGroupId = parseInt(schedulePlanDetails.owner_group_id, 10);
        }
        try {
            var res = await window.apiFetch('/api/plan-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            var j = await res.json().catch(function () { return {}; });
            if (!res.ok) {
                var errorMsg = j.error || '儲存失敗';
                if (res.status === 400) errorMsg = j.error || '資料格式錯誤，請檢查輸入的資料';
                else if (res.status === 403) errorMsg = '權限不足，請確認您的帳號權限';
                else if (res.status === 500) errorMsg = '伺服器錯誤：' + (j.error || '請稍後再試');
                window.showToast(errorMsg, 'error');
                return;
            }
            window.showToast(j.planNumber ? '已上傳，取號：' + j.planNumber : '已上傳成功', 'success');
            await loadScheduleForMonth();
            scheduleRenderDayList(startDateVal);
            scheduleClearForm();
            if (typeof window.loadPlanOptions === 'function') window.loadPlanOptions();
            loadSchedulePlanOptions();
        } catch (e) {
            var errorMsg = e.message && e.message.indexOf('CSRF') >= 0 ? '安全驗證失敗，請重新整理頁面後再試' : (e.message && e.message.indexOf('fetch') >= 0 ? '網路連線錯誤' : '儲存失敗，請稍後再試');
            window.showToast(errorMsg, 'error');
        }
    }
    window.scheduleSubmitPlan = scheduleSubmitPlan;
})();
