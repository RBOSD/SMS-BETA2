/**
 * 檢查行程檢索：loadDashboardYearOptions、月曆、統計
 * 依賴：core.js (holidayData), utils.js (escapeHtml)
 */
(function () {
    'use strict';

    var dashboardSelectedYear = 0; // ROC 年度
    var dashboardScheduleYear = new Date().getFullYear();
    var dashboardScheduleMonth = new Date().getMonth() + 1;
    var dashboardMonthData = [];

    var SCHEDULE_PLAN_COLORS = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff', '#d1fae5', '#fed7aa', '#e9d5ff'];
    var SCHEDULE_PLAN_TEXT_COLORS = ['#1e40af', '#166534', '#92400e', '#9d174d', '#3730a3', '#065f46', '#c2410c', '#6b21a8'];

    function schedulePlanColorIndex(inspectionType) {
        var typeMap = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
        var type = String(inspectionType || '').trim();
        return typeMap[type] !== undefined ? typeMap[type] : 5;
    }

    async function loadDashboardYearOptions() {
        try {
            var res = await fetch('/api/plans/dashboard-stats/years?t=' + Date.now(), { credentials: 'include' });
            if (!res.ok) return;
            var data = await res.json();
            var years = data.years || [];
            var select = document.getElementById('dashboardYearSelect');
            if (!select) return;
            var currentValue = select.value || dashboardSelectedYear;
            select.innerHTML = '<option value="">請選擇年度</option>';
            years.forEach(function (y) {
                var opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y + '年';
                select.appendChild(opt);
            });
            if (currentValue) {
                select.value = currentValue;
                dashboardSelectedYear = currentValue;
            } else if (years.length > 0) {
                select.value = years[0];
                dashboardSelectedYear = years[0];
            }
            if (dashboardSelectedYear) {
                loadCalendarDashboardStats();
                initDashboardCalendar();
            }
        } catch (e) {
            console.error('載入年度選單失敗:', e);
        }
    }
    window.loadDashboardYearOptions = loadDashboardYearOptions;

    function onDashboardYearChange() {
        var select = document.getElementById('dashboardYearSelect');
        if (!select) return;
        var year = select.value;
        if (!year) {
            dashboardSelectedYear = '';
            var statPlans = document.getElementById('dashboardStatPlans');
            var statSchedules = document.getElementById('dashboardStatSchedules');
            var statByType = document.getElementById('dashboardStatByType');
            var progressBody = document.getElementById('dashboardPlanProgressBody');
            if (statPlans) statPlans.textContent = '-';
            if (statSchedules) statSchedules.textContent = '-';
            var statPlanned = document.getElementById('dashboardStatPlanned');
            if (statPlanned) statPlanned.textContent = '-';
            if (statByType) statByType.innerHTML = '<span style="color:#64748b;">請先選擇年度</span>';
            if (progressBody) progressBody.innerHTML = '<tr><td colspan="5" style="padding:12px;color:#64748b;">請先選擇年度</td></tr>';
            dashboardMonthData = [];
            renderDashboardCalendar();
            var box = document.getElementById('dashboardScheduleDayListBody');
            if (box) box.innerHTML = '請先選擇年度';
            return;
        }
        dashboardSelectedYear = year;
        loadCalendarDashboardStats();
        loadDashboardScheduleForMonth();
        renderDashboardCalendar();
    }
    window.onDashboardYearChange = onDashboardYearChange;

    async function loadCalendarDashboardStats() {
        if (!dashboardSelectedYear) return;
        var statPlans = document.getElementById('dashboardStatPlans');
        var statSchedules = document.getElementById('dashboardStatSchedules');
        var statByType = document.getElementById('dashboardStatByType');
        var progressBody = document.getElementById('dashboardPlanProgressBody');
        if (!statPlans && !statSchedules) return;
        var typeNames = { '1': '年度定期檢查', '2': '特別檢查', '3': '例行性檢查', '4': '臨時檢查' };
        try {
            var res = await fetch('/api/plans/dashboard-stats?year=' + encodeURIComponent(dashboardSelectedYear) + '&t=' + Date.now(), { credentials: 'include' });
            if (!res.ok) throw new Error('無法載入統計');
            var data = await res.json();
            var totalPlans = data.totalPlans != null ? data.totalPlans : 0;
            var totalSchedules = data.totalSchedules != null ? data.totalSchedules : 0;
            var totalPlanned = data.totalPlanned != null ? data.totalPlanned : 0;
            var byType = data.byType || {};
            var planProgress = data.planProgress || [];
            if (statPlans) statPlans.textContent = totalPlans;
            if (statSchedules) statSchedules.textContent = totalSchedules;
            var statPlanned = document.getElementById('dashboardStatPlanned');
            if (statPlanned) statPlanned.textContent = totalPlanned;
            if (statByType) {
                statByType.innerHTML = ['1', '2', '3', '4'].map(function (t) {
                    var count = byType[t] || 0;
                    return '<span style="background:#f1f5f9; padding:6px 12px; border-radius:8px; font-size:13px;">' + (typeNames[t] || t) + '：' + count + '</span>';
                }).join('');
            }
            if (progressBody) {
                progressBody.innerHTML = planProgress.map(function (p) {
                    var planned = p.planned_count != null ? p.planned_count : 0;
                    var done = p.schedule_count != null ? p.schedule_count : 0;
                    var pct = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : (done > 0 ? 100 : 0);
                    return '<tr><td data-label="年度" style="padding:10px;">' + (p.year || '-') + '</td><td data-label="計畫名稱" style="padding:10px;">' + (p.name || '-') + '</td><td data-label="規劃次數" style="padding:10px;">' + planned + '</td><td data-label="已檢查次數" style="padding:10px;">' + done + '</td><td data-label="進度" style="padding:10px;"><span style="display:inline-block;width:80px;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;"><span style="display:block;height:100%;width:' + pct + '%;background:#2563eb;border-radius:4px;"></span></span> ' + pct + '%</td></tr>';
                }).join('') || '<tr><td data-label="說明" colspan="5" style="padding:12px;color:#64748b;">尚無資料</td></tr>';
            }
        } catch (e) {
            if (statPlans) statPlans.textContent = '—';
            if (statSchedules) statSchedules.textContent = '—';
            var statPlanned = document.getElementById('dashboardStatPlanned');
            if (statPlanned) statPlanned.textContent = '—';
            if (statByType) statByType.innerHTML = '<span style="color:#94a3b8;">載入失敗</span>';
            if (progressBody) progressBody.innerHTML = '<tr><td data-label="說明" colspan="5" style="padding:12px;color:#ef4444;">載入失敗</td></tr>';
        }
    }

    function initDashboardCalendar() {
        var roc = parseInt(String(dashboardSelectedYear).replace(/\D/g, ''), 10);
        var adYear = Number.isFinite(roc) ? 1911 + roc : new Date().getFullYear();
        var now = new Date();
        dashboardScheduleYear = adYear;
        dashboardScheduleMonth = now.getMonth() + 1;
        if (now.getFullYear() !== adYear) {
            dashboardScheduleMonth = 1;
        }
        renderDashboardCalendar();
        loadDashboardScheduleForMonth();
    }

    function renderDashboardCalendar() {
        var holidayData = window.holidayData || {};
        var title = document.getElementById('dashboardScheduleMonthTitle');
        var cal = document.getElementById('dashboardScheduleCalendar');
        if (!title || !cal) return;
        title.textContent = dashboardScheduleYear + ' 年 ' + dashboardScheduleMonth + ' 月';
        var y = dashboardScheduleYear;
        var m = dashboardScheduleMonth;
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
            var plansForDay = dashboardMonthData.filter(function (s) {
                var startStr = (s.start_date || '').slice(0, 10);
                var endStr = (s.end_date || '').slice(0, 10) || startStr;
                return startStr && dateStr >= startStr && dateStr <= endStr;
            });
            var hasPlan = plansForDay.length > 0;
            var colorIndices = plansForDay.map(function (s) { return schedulePlanColorIndex(s.inspection_type); });
            var colorDots = colorIndices.map(function (idx, i) {
                var name = (plansForDay[i].plan_name || '').trim() || '未命名';
                return '<span class="schedule-cal-color-dot" style="background:' + SCHEDULE_PLAN_COLORS[idx] + ';" title="' + (window.escapeHtml ? window.escapeHtml(name) : name) + '"></span>';
            }).join('');
            var colorDotsHtml = colorDots ? '<div class="schedule-cal-dots">' + colorDots + '</div>' : '';
            var planItems = plansForDay.map(function (s, i) {
                var idx = colorIndices[i];
                var tc = SCHEDULE_PLAN_TEXT_COLORS[idx] || '#1e3a8a';
                var name = (s.plan_name || '').trim() || '未命名';
                var location = (s.location || '').trim() || '';
                var inspector = (s.inspector || '').trim() || '';
                var planInfo = [];
                planInfo.push('<div class="schedule-cal-plan-name" style="color:' + tc + '; font-weight:600; font-size:12px; margin-bottom:2px;">' + (window.escapeHtml ? window.escapeHtml(name) : name) + '</div>');
                if (location) planInfo.push('<div class="schedule-cal-plan-detail" style="color:#64748b; font-size:11px; margin-bottom:1px;">📍 ' + (window.escapeHtml ? window.escapeHtml(location) : location) + '</div>');
                if (inspector) planInfo.push('<div class="schedule-cal-plan-detail" style="color:#64748b; font-size:11px;">👤 ' + (window.escapeHtml ? window.escapeHtml(inspector) : inspector) + '</div>');
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
            dayCells.push('<div class="schedule-cal-day ' + (hasPlan ? 'has-plan ' + colorClass : '') + ' ' + finalHolidayClass + '" style="' + bgStyle + '" data-date="' + dateStr + '" onclick="dashboardSelectDay(\'' + dateStr + '\')">' + dayNumWrap + holidayTag + colorDotsHtml + planText + '</div>');
        }
        cal.innerHTML = '<div class="schedule-cal-head">日</div><div class="schedule-cal-head">一</div><div class="schedule-cal-head">二</div><div class="schedule-cal-head">三</div><div class="schedule-cal-head">四</div><div class="schedule-cal-head">五</div><div class="schedule-cal-head">六</div>' + pad + dayCells.join('');
    }

    async function loadDashboardScheduleForMonth() {
        if (!dashboardSelectedYear) return;
        try {
            var res = await fetch('/api/plan-schedule?year=' + dashboardScheduleYear + '&month=' + dashboardScheduleMonth + '&t=' + Date.now(), {
                credentials: 'include',
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!res.ok) {
                dashboardMonthData = [];
                renderDashboardCalendar();
                return;
            }
            var j = await res.json();
            dashboardMonthData = j.data || [];
            try {
                var holidayRes = await fetch('/api/holidays/' + dashboardScheduleYear + '?t=' + Date.now(), {
                    credentials: 'include',
                    cache: 'no-store'
                });
                if (holidayRes.ok) {
                    var holidayJson = await holidayRes.json();
                    window.holidayData = window.holidayData || {};
                    (holidayJson.data || []).forEach(function (h) {
                        if (h && h.date && h.isHoliday === true) {
                            var dateStr = String(h.date).slice(0, 10);
                            window.holidayData[dateStr] = (h.name || '').trim() || '假日';
                        }
                    });
                }
            } catch (e) {}
        } catch (e) {
            dashboardMonthData = [];
        }
        renderDashboardCalendar();
    }

    function dashboardSelectDay(dateStr) {
        dashboardRenderDayList(dateStr);
    }
    window.dashboardSelectDay = dashboardSelectDay;

    function dashboardRenderDayList(dateStr) {
        var box = document.getElementById('dashboardScheduleDayListBody');
        if (!box) return;
        if (!dateStr) {
            box.innerHTML = '點選月曆上的日期可查看該日詳細檢查內容';
            return;
        }
        var list = dashboardMonthData.filter(function (s) {
            var startStr = (s.start_date || '').slice(0, 10);
            var endStr = (s.end_date || '').slice(0, 10) || startStr;
            return dateStr >= startStr && dateStr <= endStr;
        });
        if (list.length === 0) {
            box.innerHTML = '<span style="color:#64748b;">' + dateStr + ' 無排程</span>';
            return;
        }
        var escape = window.escapeHtml || function (x) { return String(x); };
        box.innerHTML = list.map(function (s) {
            var name = (s.plan_name || '').trim() || '未命名';
            var loc = (s.location || '').trim();
            var insp = (s.inspector || '').trim();
            var num = (s.plan_number || '').trim();
            var html = '<div style="padding:10px 12px; margin-bottom:8px; background:#fff; border-radius:8px; border:1px solid #e2e8f0;">';
            html += '<div style="font-weight:600; color:#334155; font-size:13px;">' + escape(name) + '</div>';
            if (num) html += '<div style="font-size:12px; color:#64748b; margin-top:4px;">編號：' + escape(num) + '</div>';
            if (loc) html += '<div style="font-size:12px; color:#64748b; margin-top:2px;">📍 ' + escape(loc) + '</div>';
            if (insp) html += '<div style="font-size:12px; color:#64748b; margin-top:2px;">👤 ' + escape(insp) + '</div>';
            html += '</div>';
            return html;
        }).join('');
    }

    function dashboardSchedulePrevMonth() {
        if (dashboardScheduleMonth === 1) {
            dashboardScheduleYear--;
            dashboardScheduleMonth = 12;
        } else {
            dashboardScheduleMonth--;
        }
        renderDashboardCalendar();
        loadDashboardScheduleForMonth();
    }
    window.dashboardSchedulePrevMonth = dashboardSchedulePrevMonth;

    function dashboardScheduleNextMonth() {
        if (dashboardScheduleMonth === 12) {
            dashboardScheduleYear++;
            dashboardScheduleMonth = 1;
        } else {
            dashboardScheduleMonth++;
        }
        renderDashboardCalendar();
        loadDashboardScheduleForMonth();
    }
    window.dashboardScheduleNextMonth = dashboardScheduleNextMonth;
})();
