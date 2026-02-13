import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/api';
import { escapeHtml } from '../utils/helpers';

const SCHEDULE_PLAN_COLORS = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff', '#d1fae5', '#fed7aa', '#e9d5ff'];
const SCHEDULE_PLAN_TEXT_COLORS = ['#1e40af', '#166534', '#92400e', '#9d174d', '#3730a3', '#065f46', '#c2410c', '#6b21a8'];
const TYPE_NAMES = { '1': '年度定期檢查', '2': '特別檢查', '3': '例行性檢查', '4': '臨時檢查' };

function schedulePlanColorIndex(inspectionType) {
  const typeMap = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
  const type = String(inspectionType || '').trim();
  return typeMap[type] !== undefined ? typeMap[type] : 5;
}

export default function CalendarView() {
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [scheduleYear, setScheduleYear] = useState(new Date().getFullYear());
  const [scheduleMonth, setScheduleMonth] = useState(new Date().getMonth() + 1);
  const [monthData, setMonthData] = useState([]);
  const [holidayData, setHolidayData] = useState({});
  const [stats, setStats] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadYears = useCallback(async () => {
    try {
      const res = await fetch('/api/plans/dashboard-stats/years?t=' + Date.now(), { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const y = data.years || [];
      setYears(y);
      if (y.length > 0) {
        setSelectedYear((prev) => (prev ? prev : String(y[0])));
      }
    } catch (e) {
      console.error('載入年度選單失敗:', e);
    }
  }, []);

  const loadStats = useCallback(async () => {
    if (!selectedYear) return;
    setLoading(true);
    try {
      const res = await fetch(
        '/api/plans/dashboard-stats?year=' + encodeURIComponent(selectedYear) + '&t=' + Date.now(),
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('無法載入統計');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  const loadMonthSchedule = useCallback(async () => {
    if (!selectedYear) return;
    try {
      const res = await fetch(
        '/api/plan-schedule?year=' + scheduleYear + '&month=' + scheduleMonth + '&t=' + Date.now(),
        { credentials: 'include', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
      );
      if (!res.ok) {
        setMonthData([]);
        return;
      }
      const j = await res.json();
      setMonthData(j.data || []);

      const holidayRes = await fetch('/api/holidays/' + scheduleYear + '?t=' + Date.now(), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (holidayRes.ok) {
        const holidayJson = await holidayRes.json();
        const next = {};
        (holidayJson.data || []).forEach((h) => {
          if (h && h.date && h.isHoliday === true) {
            const dateStr = String(h.date).slice(0, 10);
            next[dateStr] = (h.name || '').trim() || '假日';
          }
        });
        setHolidayData(next);
      }
    } catch (e) {
      setMonthData([]);
    }
  }, [selectedYear, scheduleYear, scheduleMonth]);

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadStats();
      const roc = parseInt(String(selectedYear).replace(/\D/g, ''), 10);
      const adYear = Number.isFinite(roc) ? 1911 + roc : new Date().getFullYear();
      const now = new Date();
      setScheduleYear(adYear);
      setScheduleMonth(now.getFullYear() === adYear ? now.getMonth() + 1 : 1);
    } else {
      setStats(null);
      setMonthData([]);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (selectedYear) loadMonthSchedule();
  }, [selectedYear, scheduleYear, scheduleMonth, loadMonthSchedule]);

  const onYearChange = (e) => {
    const v = e.target.value;
    setSelectedYear(v);
    if (!v) setStats(null);
  };

  const prevMonth = () => {
    if (scheduleMonth === 1) {
      setScheduleYear((y) => y - 1);
      setScheduleMonth(12);
    } else {
      setScheduleMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (scheduleMonth === 12) {
      setScheduleYear((y) => y + 1);
      setScheduleMonth(1);
    } else {
      setScheduleMonth((m) => m + 1);
    }
  };

  const selectDay = (dateStr) => {
    setSelectedDay(dateStr);
  };

  const dayList = selectedDay
    ? monthData.filter((s) => {
        const startStr = (s.start_date || '').slice(0, 10);
        const endStr = (s.end_date || '').slice(0, 10) || startStr;
        return selectedDay >= startStr && selectedDay <= endStr;
      })
    : [];

  const y = scheduleYear;
  const m = scheduleMonth;
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const startPad = first.getDay();
  const days = last.getDate();

  const calendarDays = [];
  for (let i = 0; i < startPad; i++) {
    calendarDays.push(<div key={'pad-' + i} className="schedule-cal-day schedule-cal-pad" />);
  }
  for (let d = 1; d <= days; d++) {
    const dateStr = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const holidayVal = holidayData[dateStr];
    const isHoliday = !!holidayVal;
    const plansForDay = monthData.filter((s) => {
      const startStr = (s.start_date || '').slice(0, 10);
      const endStr = (s.end_date || '').slice(0, 10) || startStr;
      return startStr && dateStr >= startStr && dateStr <= endStr;
    });
    const hasPlan = plansForDay.length > 0;
    const colorIndices = plansForDay.map((s) => schedulePlanColorIndex(s.inspection_type));
    const primaryColorIdx = hasPlan ? colorIndices[0] : 0;
    const colorClass = hasPlan ? 'schedule-cal-plan-' + primaryColorIdx : '';
    const finalHolidayClass = isHoliday ? 'schedule-cal-holiday' : '';

    calendarDays.push(
      <div
        key={dateStr}
        className={`schedule-cal-day ${hasPlan ? 'has-plan ' + colorClass : ''} ${finalHolidayClass}`}
        style={isHoliday ? { background: '#fef2f2 !important' } : {}}
        data-date={dateStr}
        onClick={() => selectDay(dateStr)}
      >
        {hasPlan ? (
          <div className="schedule-cal-day-num-wrap">
            <div className="schedule-cal-day-num" style={isHoliday ? { color: '#dc2626' } : {}}>
              {d}
            </div>
            <span className="schedule-cal-day-count">共 {plansForDay.length} 筆</span>
          </div>
        ) : (
          <div className="schedule-cal-day-num" style={isHoliday ? { color: '#dc2626' } : {}}>
            {d}
          </div>
        )}
        {isHoliday && (
          <span className="schedule-cal-holiday-tag" title={holidayVal}>
            假日
          </span>
        )}
        {hasPlan && (
          <div className="schedule-cal-dots">
            {plansForDay.map((s, i) => (
              <span
                key={i}
                className="schedule-cal-color-dot"
                style={{ background: SCHEDULE_PLAN_COLORS[colorIndices[i]] }}
                title={escapeHtml((s.plan_name || '').trim() || '未命名')}
              />
            ))}
          </div>
        )}
        {hasPlan && (
          <div className="schedule-cal-plan-names">
            {plansForDay.map((s, i) => {
              const idx = colorIndices[i];
              const tc = SCHEDULE_PLAN_TEXT_COLORS[idx] || '#1e3a8a';
              const name = (s.plan_name || '').trim() || '未命名';
              const location = (s.location || '').trim() || '';
              const inspector = (s.inspector || '').trim() || '';
              return (
                <div key={i} className="schedule-cal-plan-item" style={{ marginBottom: 3, padding: '2px 0' }}>
                  <div className="schedule-cal-plan-name" style={{ color: tc, fontWeight: 600, fontSize: 12, marginBottom: 2 }}>
                    {name}
                  </div>
                  {location && (
                    <div className="schedule-cal-plan-detail" style={{ color: '#64748b', fontSize: 11, marginBottom: 1 }}>
                      📍 {location}
                    </div>
                  )}
                  {inspector && (
                    <div className="schedule-cal-plan-detail" style={{ color: '#64748b', fontSize: 11 }}>
                      👤 {inspector}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="view-section active">
      <div className="main-card" style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: 18, color: '#334155' }}>📊 檢查行程統計</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>選擇年度：</label>
              <select
                id="dashboardYearSelect"
                className="filter-select"
                style={{ width: 120 }}
                value={selectedYear}
                onChange={onYearChange}
              >
                <option value="">載入中…</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: 13 }}>選擇年度後顯示該年度統計資料與月曆。</p>
        </div>
        <div
          id="calendarDashboardStats"
          className="stats-bar dashboard-stats-cards"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}
        >
          <div
            className="stat-item dashboard-stat-card"
            style={{
              minWidth: 120,
              background: 'linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%)',
              border: '1px solid #c7d2fe',
              borderRadius: 12,
              padding: '14px 18px',
            }}
          >
            <div className="stat-val" style={{ color: '#4338ca', fontSize: '1.5rem', fontWeight: 700 }}>
              {loading ? '-' : (stats ? stats.totalPlans : '-')}
            </div>
            <div className="stat-label" style={{ color: '#4f46e5', fontWeight: 600 }}>
              計畫
            </div>
          </div>
          <div
            className="stat-item dashboard-stat-card"
            style={{
              minWidth: 120,
              background: 'linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)',
              border: '1px solid #fcd34d',
              borderRadius: 12,
              padding: '14px 18px',
            }}
          >
            <div className="stat-val" style={{ color: '#b45309', fontSize: '1.5rem', fontWeight: 700 }}>
              {loading ? '-' : (stats ? stats.totalPlanned : '-')}
            </div>
            <div className="stat-label" style={{ color: '#d97706', fontWeight: 600 }}>
              規劃次數
            </div>
          </div>
          <div
            className="stat-item dashboard-stat-card"
            style={{
              minWidth: 120,
              background: 'linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%)',
              border: '1px solid #a7f3d0',
              borderRadius: 12,
              padding: '14px 18px',
            }}
          >
            <div className="stat-val" style={{ color: '#047857', fontSize: '1.5rem', fontWeight: 700 }}>
              {loading ? '-' : (stats ? stats.totalSchedules : '-')}
            </div>
            <div className="stat-label" style={{ color: '#059669', fontWeight: 600 }}>
              已檢查次數
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 14, color: '#475569' }}>依檢查類別統計（已檢查次數）</div>
        <div id="dashboardStatByType" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          {!selectedYear ? (
            <span style={{ color: '#64748b', fontSize: 13 }}>請先選擇年度</span>
          ) : stats && stats.byType ? (
            ['1', '2', '3', '4'].map((t) => (
              <span
                key={t}
                style={{
                  background: '#f1f5f9',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {TYPE_NAMES[t] || t}：{stats.byType[t] || 0}
              </span>
            ))
          ) : (
            <span style={{ color: '#64748b', fontSize: 13 }}>載入中…</span>
          )}
        </div>
        <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 14, color: '#475569' }}>計畫進度統計</div>
        <div id="dashboardPlanProgress" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="user-table dashboard-progress-table" style={{ fontSize: 13, minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: 10, whiteSpace: 'nowrap' }}>年度</th>
                <th style={{ padding: 10, whiteSpace: 'nowrap' }}>計畫名稱</th>
                <th style={{ padding: 10, whiteSpace: 'nowrap' }}>規劃次數</th>
                <th style={{ padding: 10, whiteSpace: 'nowrap' }}>已檢查次數</th>
                <th style={{ padding: 10, whiteSpace: 'nowrap' }}>進度</th>
              </tr>
            </thead>
            <tbody id="dashboardPlanProgressBody">
              {!selectedYear ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, color: '#64748b' }}>
                    請先選擇年度
                  </td>
                </tr>
              ) : stats && stats.planProgress && stats.planProgress.length > 0 ? (
                stats.planProgress.map((p, i) => {
                  const planned = p.planned_count != null ? p.planned_count : 0;
                  const done = p.schedule_count != null ? p.schedule_count : 0;
                  const pct = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : done > 0 ? 100 : 0;
                  return (
                    <tr key={i}>
                      <td data-label="年度" style={{ padding: 10 }}>
                        {p.year || '-'}
                      </td>
                      <td data-label="計畫名稱" style={{ padding: 10 }}>
                        {p.name || '-'}
                      </td>
                      <td data-label="規劃次數" style={{ padding: 10 }}>
                        {planned}
                      </td>
                      <td data-label="已檢查次數" style={{ padding: 10 }}>
                        {done}
                      </td>
                      <td data-label="進度" style={{ padding: 10 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 80,
                            height: 8,
                            background: '#e2e8f0',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}
                        >
                          <span
                            style={{
                              display: 'block',
                              height: '100%',
                              width: pct + '%',
                              background: '#2563eb',
                              borderRadius: 4,
                            }}
                          />
                        </span>{' '}
                        {pct}%
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: 12, color: '#64748b' }}>
                    尚無資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="main-card" style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: 18, color: '#334155' }}>📅 檢查行程月曆</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>顯示已排程的檢查計畫，供所有人查看。</p>
        </div>
        <div className="schedule-calendar-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={prevMonth}>
            ◀ 上個月
          </button>
          <span id="dashboardScheduleMonthTitle" style={{ fontWeight: 700, fontSize: 16, color: '#334155' }}>
            {scheduleYear} 年 {scheduleMonth} 月
          </span>
          <button type="button" className="btn btn-outline" onClick={nextMonth}>
            下個月 ▶
          </button>
        </div>
        <div id="dashboardScheduleCalendar" className="schedule-calendar">
          <div className="schedule-cal-head">日</div>
          <div className="schedule-cal-head">一</div>
          <div className="schedule-cal-head">二</div>
          <div className="schedule-cal-head">三</div>
          <div className="schedule-cal-head">四</div>
          <div className="schedule-cal-head">五</div>
          <div className="schedule-cal-head">六</div>
          {calendarDays}
        </div>
        <div
          id="dashboardScheduleDayList"
          style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, color: '#334155', marginBottom: 8 }}>當日排程（點選月曆日期後顯示）</div>
          <div id="dashboardScheduleDayListBody" style={{ fontSize: 13, color: '#64748b' }}>
            {!selectedDay ? (
              '點選月曆上的日期可查看該日詳細檢查內容'
            ) : dayList.length === 0 ? (
              <span style={{ color: '#64748b' }}>{selectedDay} 無排程</span>
            ) : (
              dayList.map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    marginBottom: 8,
                    background: '#fff',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#334155', fontSize: 13 }}>{(s.plan_name || '').trim() || '未命名'}</div>
                  {s.plan_number && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>編號：{s.plan_number}</div>
                  )}
                  {s.location && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>📍 {s.location}</div>
                  )}
                  {s.inspector && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>👤 {s.inspector}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
