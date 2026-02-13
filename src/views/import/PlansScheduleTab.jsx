import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import { escapeHtml } from '../../utils/helpers';
import { INSPECTION_NAMES } from '../../utils/constants';

const SCHEDULE_PLAN_COLORS = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff', '#d1fae5', '#fed7aa', '#e9d5ff'];
const SCHEDULE_PLAN_TEXT_COLORS = ['#1e40af', '#166534', '#92400e', '#9d174d', '#3730a3', '#065f46', '#c2410c', '#6b21a8'];
const RAILWAY_NAMES = { T: '臺鐵', H: '高鐵', A: '林鐵', S: '糖鐵' };

function schedulePlanColorIndex(inspectionType) {
  const typeMap = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
  const type = String(inspectionType || '').trim();
  return typeMap[type] !== undefined ? typeMap[type] : 5;
}

export default function PlansScheduleTab() {
  const showToast = useToast();
  const [scheduleYear, setScheduleYear] = useState(new Date().getFullYear());
  const [scheduleMonth, setScheduleMonth] = useState(new Date().getMonth() + 1);
  const [monthData, setMonthData] = useState([]);
  const [holidayData, setHolidayData] = useState({});
  const [planOptions, setPlanOptions] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [planDetails, setPlanDetails] = useState(null);
  const [planNumber, setPlanNumber] = useState(null);
  const [yearFilter, setYearFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [inspector, setInspector] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const loadPlanOptions = useCallback(async () => {
    try {
      const yearParam = yearFilter ? '&year=' + encodeURIComponent(yearFilter) : '';
      const res = await fetch('/api/options/plans?t=' + Date.now() + yearParam, { credentials: 'include' });
      if (!res.ok) return;
      const j = await res.json();
      setPlanOptions(j.data || []);
      if (!yearFilter && (j.data || []).length > 0) {
        const years = [...new Set((j.data || []).map((p) => p.year).filter(Boolean))].sort((a, b) => b.localeCompare(a));
        setYearOptions(years);
      }
    } catch (e) {
      console.error('載入計畫選項失敗:', e);
    }
  }, [yearFilter]);

  const loadMonthSchedule = useCallback(async () => {
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
  }, [scheduleYear, scheduleMonth]);

  useEffect(() => {
    loadPlanOptions();
  }, [loadPlanOptions]);

  useEffect(() => {
    loadMonthSchedule();
  }, [loadMonthSchedule]);

  const onPlanChange = async (planValue) => {
    setSelectedPlan(planValue);
    setPlanDetails(null);
    setPlanNumber(null);
    if (!planValue) return;
    const parts = planValue.split('|||');
    if (parts.length !== 2) return;
    const [planName, planYear] = parts;
    try {
      const res = await fetch(
        '/api/plans/by-name?name=' + encodeURIComponent(planName) + '&year=' + encodeURIComponent(planYear),
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const j = await res.json();
      const plan = (j.data || [])[0];
      if (!plan || !plan.railway || !plan.inspection_type) {
        showToast('該計畫缺少必要資訊（鐵路機構、檢查類別），請先在計畫管理中編輯', 'warning');
        return;
      }
      setPlanDetails({ railway: plan.railway, inspection_type: plan.inspection_type, owner_group_id: plan.owner_group_id });
    } catch (e) {
      showToast('無法取得計畫資訊', 'error');
    }
  };

  const updatePlanNumber = useCallback(async () => {
    if (!planDetails?.railway || !planDetails?.inspection_type || !startDate || !location?.trim() || !inspector?.trim()) {
      setPlanNumber(null);
      return;
    }
    try {
      const adYear = parseInt(startDate.slice(0, 4), 10);
      const rocYear = adYear - 1911;
      const yr = String(rocYear).replace(/\D/g, '').slice(-3).padStart(3, '0');
      const res = await fetch(
        '/api/plan-schedule/next-number?year=' + yr + '&railway=' + planDetails.railway + '&inspectionType=' + planDetails.inspection_type + '&t=' + Date.now(),
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setPlanNumber(data.planNumber || null);
      } else {
        setPlanNumber(null);
      }
    } catch (e) {
      setPlanNumber(null);
    }
  }, [planDetails, startDate, location, inspector]);

  useEffect(() => {
    const t = setTimeout(updatePlanNumber, 300);
    return () => clearTimeout(t);
  }, [updatePlanNumber]);

  const onStartDateChange = (v) => {
    setStartDate(v);
    if (v) {
      const [y, mo] = v.split('-').map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      const lastDayStr = y + '-' + String(mo).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
      setEndDate((prev) => (prev && (prev < v || prev > lastDayStr) ? '' : prev));
    } else {
      setEndDate('');
    }
    if (v) setSelectedDate(v);
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
    setStartDate(dateStr);
    setSelectedDate(dateStr);
  };

  const dayList = selectedDate
    ? monthData.filter((s) => {
        const startStr = (s.start_date || '').slice(0, 10);
        const endStr = (s.end_date || '').slice(0, 10) || startStr;
        return selectedDate >= startStr && selectedDate <= endStr;
      })
    : [];

  const clearForm = () => {
    setStartDate('');
    setEndDate('');
    setLocation('');
    setInspector('');
    setSelectedDate('');
    setPlanNumber(null);
  };

  const submitSchedule = async () => {
    if (!selectedPlan) return showToast('請選擇檢查計畫', 'error');
    const parts = selectedPlan.split('|||');
    const planName = parts[0];
    const planYear = parts[1];
    if (!planName || !planYear) return showToast('計畫資訊不完整', 'error');
    if (!startDate) return showToast('請選擇開始日期', 'error');
    if (!endDate) return showToast('請選擇結束日期', 'error');
    if (endDate < startDate) return showToast('結束日期不能早於開始日期', 'error');
    if (!location?.trim()) return showToast('請填寫地點', 'error');
    if (!inspector?.trim()) return showToast('請填寫檢查人員', 'error');
    if (!planDetails?.railway || !planDetails?.inspection_type) return showToast('該計畫缺少必要資訊', 'error');

    const adYear = parseInt(startDate.slice(0, 4), 10);
    const rocYear = adYear - 1911;
    const yr = String(rocYear).replace(/\D/g, '').slice(-3).padStart(3, '0');
    const payload = {
      plan_name: planName,
      start_date: startDate,
      end_date: endDate,
      year: yr,
      railway: planDetails.railway,
      inspection_type: planDetails.inspection_type,
      business: null,
      location: location.trim(),
      inspector: inspector.trim(),
    };
    if (planDetails.owner_group_id) payload.ownerGroupId = parseInt(planDetails.owner_group_id, 10);

    try {
      const res = await apiFetch('/api/plan-schedule', { method: 'POST', body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(j.planNumber ? '已上傳，取號：' + j.planNumber : '已上傳成功', 'success');
        loadMonthSchedule();
        clearForm();
        loadPlanOptions();
      } else {
        showToast(j.error || '儲存失敗', 'error');
      }
    } catch (e) {
      showToast(e.message?.includes('CSRF') ? '安全驗證失敗，請重新整理頁面' : '儲存失敗', 'error');
    }
  };

  const printCalendar = () => {
    const w = window.open('', '_blank');
    const y = scheduleYear;
    const m = scheduleMonth;
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const startPad = first.getDay();
    const days = last.getDate();
    let html = '';
    for (let i = 0; i < startPad; i++) html += '<div class="schedule-cal-day schedule-cal-pad"></div>';
    for (let d = 1; d <= days; d++) {
      const dateStr = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const isHoliday = !!holidayData[dateStr];
      const plansForDay = monthData.filter((s) => {
        const startStr = (s.start_date || '').slice(0, 10);
        const endStr = (s.end_date || '').slice(0, 10) || startStr;
        return dateStr >= startStr && dateStr <= endStr;
      });
      const idx = plansForDay.length > 0 ? schedulePlanColorIndex(plansForDay[0].inspection_type) : 0;
      const bg = isHoliday ? '#fef2f2' : plansForDay.length > 0 ? SCHEDULE_PLAN_COLORS[idx] : '#fff';
      html += '<div class="schedule-cal-day" style="background:' + bg + ';"><div class="schedule-cal-day-num" style="font-weight:700;">' + d + '</div>';
      plansForDay.forEach((s) => {
        html += '<div class="schedule-cal-plan-name" style="font-size:11px;margin:2px 0;">' + escapeHtml(s.plan_name || '') + '</div>';
      });
      html += '</div>';
    }
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' +
        y +
        '年' +
        m +
        '月 檢查行程月曆</title><style>@page{size:A4 landscape}*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;padding:12px}.schedule-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;background:#64748b;padding:3px;border-radius:8px}.schedule-cal-head{background:#1e40af;color:#fff;padding:10px;text-align:center;font-weight:700}.schedule-cal-day{border:2px solid #94a3b8;padding:8px;min-height:80px;background:#fff}.schedule-cal-pad{background:#f1f5f9}.schedule-cal-day-num{font-weight:700;margin-bottom:4px}</style></head><body><h1>' +
        y +
        ' 年 ' +
        m +
        ' 月 檢查行程月曆</h1><div class="schedule-calendar"><div class="schedule-cal-head">日</div><div class="schedule-cal-head">一</div><div class="schedule-cal-head">二</div><div class="schedule-cal-head">三</div><div class="schedule-cal-head">四</div><div class="schedule-cal-head">五</div><div class="schedule-cal-head">六</div>' +
        html +
        '</div></body></html>'
    );
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

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
    const isHoliday = !!holidayData[dateStr];
    const plansForDay = monthData.filter((s) => {
      const startStr = (s.start_date || '').slice(0, 10);
      const endStr = (s.end_date || '').slice(0, 10) || startStr;
      return dateStr >= startStr && dateStr <= endStr;
    });
    const hasPlan = plansForDay.length > 0;
    const colorIndices = plansForDay.map((s) => schedulePlanColorIndex(s.inspection_type));
    const primaryColorIdx = hasPlan ? colorIndices[0] : 0;
    const colorClass = hasPlan ? 'schedule-cal-plan-' + primaryColorIdx : '';
    calendarDays.push(
      <div
        key={dateStr}
        className={`schedule-cal-day ${hasPlan ? 'has-plan ' + colorClass : ''} ${isHoliday ? 'schedule-cal-holiday' : ''}`}
        style={isHoliday ? { background: '#fef2f2 !important' } : {}}
        data-date={dateStr}
        onClick={() => selectDay(dateStr)}
      >
        <div className="schedule-cal-day-num" style={isHoliday ? { color: '#dc2626' } : {}}>
          {d}
        </div>
        {hasPlan && <span className="schedule-cal-day-count">共 {plansForDay.length} 筆</span>}
        {hasPlan && (
          <div className="schedule-cal-plan-names">
            {plansForDay.map((s, i) => (
              <div key={i} className="schedule-cal-plan-name" style={{ color: SCHEDULE_PLAN_TEXT_COLORS[colorIndices[i]], fontSize: 12 }}>
                {(s.plan_name || '').trim() || '未命名'}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="main-card">
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: 18, color: '#334155' }}>📅 檢查行程規劃</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>以月曆排程規劃檢查日期，填寫檢查行程後，系統會自動取號。</p>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="schedule-calendar-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline" onClick={prevMonth}>
              ◀ 上個月
            </button>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#334155' }}>
              {scheduleYear} 年 {scheduleMonth} 月
            </span>
            <button type="button" className="btn btn-outline" onClick={nextMonth}>
              下個月 ▶
            </button>
            <button type="button" className="btn btn-primary" onClick={printCalendar}>
              🖨️ 列印月曆
            </button>
          </div>
          <div id="scheduleCalendar" className="schedule-calendar">
            <div className="schedule-cal-head">日</div>
            <div className="schedule-cal-head">一</div>
            <div className="schedule-cal-head">二</div>
            <div className="schedule-cal-head">三</div>
            <div className="schedule-cal-head">四</div>
            <div className="schedule-cal-head">五</div>
            <div className="schedule-cal-head">六</div>
            {calendarDays}
          </div>
          <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#334155', marginBottom: 8 }}>當日排程</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {!selectedDate
                ? '點選月曆日期後顯示'
                : dayList.length === 0
                  ? '當日尚無排程'
                  : dayList.map((s) => (
                      <div key={s.id} style={{ marginBottom: 10, padding: 10, background: '#f1f5f9', borderRadius: 6, borderLeft: '3px solid #3b82f6' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#334155' }}>
                          {s.plan_name || '-'}
                          {s.plan_number && <span style={{ marginLeft: 8, fontSize: 12, color: '#3b82f6' }}>[{s.plan_number}]</span>}
                        </div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>
                          📅 {(s.start_date || '').slice(0, 10)}
                          {s.end_date && s.end_date !== s.start_date ? ' ~ ' + (s.end_date || '').slice(0, 10) : ''}
                        </div>
                        {s.location && <div style={{ color: '#475569', fontSize: 12 }}>📍 {s.location}</div>}
                        {s.inspector && <div style={{ color: '#475569', fontSize: 12 }}>👤 {s.inspector}</div>}
                      </div>
                    ))}
            </div>
          </div>
        </div>
        <div style={{ width: 360, flexShrink: 0 }}>
          <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#334155', marginBottom: 16 }}>填寫檢查行程</div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>年度</label>
              <select className="filter-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="">全部年度</option>
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}年
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>檢查計畫 <span style={{ color: '#ef4444' }}>*</span></label>
              <select className="filter-select" value={selectedPlan} onChange={(e) => onPlanChange(e.target.value)}>
                <option value="">請選擇已建立的檢查計畫</option>
                {planOptions.map((p) => (
                  <option key={(p.name || '') + (p.year || '')} value={(p.name || '') + '|||' + (p.year || '')}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {planDetails && (
              <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #bae6fd' }}>
                <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600, marginBottom: 6 }}>已讀取計畫資訊：</div>
                <div style={{ fontSize: 12, color: '#0c4a6e' }}>
                  <div>
                    鐵路機構：<span style={{ fontWeight: 600 }}>{RAILWAY_NAMES[planDetails.railway] || planDetails.railway}</span>
                  </div>
                  <div>
                    檢查類別：<span style={{ fontWeight: 600 }}>{INSPECTION_NAMES[planDetails.inspection_type] || planDetails.inspection_type}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>開始日期 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="date" className="filter-input" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>結束日期 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="date" className="filter-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>地點 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" className="filter-input" placeholder="例如：臺北車站" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>檢查人員 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" className="filter-input" placeholder="例如：張三、李四" value={inspector} onChange={(e) => setInspector(e.target.value)} />
            </div>
            {planNumber && (
              <div style={{ margin: '-6px 0 14px', color: '#92400e', fontWeight: 700 }}>
                <span style={{ marginRight: 6 }}>🔢</span>
                <span>取號編號：</span>
                <span style={{ fontFamily: "'Courier New', monospace" }}>{planNumber}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={submitSchedule}>
                上傳至資料庫
              </button>
              <button type="button" className="btn btn-outline" onClick={clearForm}>
                清空
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
