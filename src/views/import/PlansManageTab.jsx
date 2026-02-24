import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import PaginationBar from '../../components/users/PaginationBar';
import PlanImportModal from '../../components/import/PlanImportModal';
import { INSPECTION_NAMES, BUSINESS_NAMES } from '../../utils/constants';

export default function PlansManageTab() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [plans, setPlans] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sortField, setSortField] = useState('year');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({});
  const [planSchedules, setPlanSchedules] = useState({});
  const [planImportOpen, setPlanImportOpen] = useState(false);

  const loadPlans = useCallback(
    async (pageNum = 1) => {
      try {
        const params = new URLSearchParams({
          page: pageNum,
          pageSize,
          q: search,
          year: yearFilter,
          sortField,
          sortDir,
          _t: Date.now(),
        });
        const res = await apiFetch('/api/plans?' + params.toString());
        if (!res.ok) {
          showToast('載入計畫失敗', 'error');
          return;
        }
        const j = await res.json();
        setPlans(j.data || []);
        setTotal(j.total || 0);
        setPages(j.pages || 1);
        setPage(j.page || 1);
      } catch (e) {
        showToast('載入計畫錯誤', 'error');
      }
    },
    [pageSize, search, yearFilter, sortField, sortDir, showToast]
  );

  const loadSchedulesForPlan = useCallback(async (planId) => {
    try {
      const res = await fetch('/api/plans/' + planId + '/schedules?t=' + Date.now(), { credentials: 'include' });
      if (!res.ok) return [];
      const j = await res.json();
      return (j.data || []).filter((s) => s.start_date && s.plan_number && s.plan_number !== '(手動)');
    } catch (e) {
      return [];
    }
  }, []);

  useEffect(() => {
    loadPlans(page);
  }, [loadPlans, page]);

  useEffect(() => {
    const loadAll = async () => {
      const next = {};
      for (const p of plans) {
        next[p.id] = await loadSchedulesForPlan(p.id);
      }
      setPlanSchedules(next);
    };
    loadAll();
  }, [plans, loadSchedulesForPlan]);

  const handleSort = (field) => {
    setSortDir((prev) => (sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortField(field);
    setPage(1);
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(plans.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const batchDelete = () => {
    if (selectedIds.size === 0) return showToast('請至少選擇一筆資料', 'error');
    const planNames = plans
      .filter((p) => selectedIds.has(p.id))
      .map((p) => (p.name || '') + (p.year ? ' (' + p.year + ')' : ''))
      .slice(0, 5);
    setConfirmConfig({
      message: '確定要刪除以下 ' + selectedIds.size + ' 筆檢查計畫嗎？\n\n' + planNames.join('\n') + (selectedIds.size > 5 ? '\n...' : '') + '\n\n此操作無法復原！',
      confirmText: '確定刪除',
      onConfirm: async () => {
        let successCount = 0;
        let failCount = 0;
        for (const id of selectedIds) {
          try {
            const res = await apiFetch('/api/plans/' + id, { method: 'DELETE' });
            if (res.ok) successCount++;
            else failCount++;
          } catch (e) {
            failCount++;
          }
        }
        showToast(successCount > 0 ? '成功刪除 ' + successCount + ' 筆' + (failCount > 0 ? '，失敗 ' + failCount + ' 筆' : '') : '刪除失敗', failCount > 0 ? 'warning' : 'success');
        setSelectedIds(new Set());
        setConfirmOpen(false);
        loadPlans(1);
      },
      onCancel: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

  const deletePlan = (p) => {
    setConfirmConfig({
      message: '確定要刪除檢查計畫「' + (p.name || '') + (p.year ? ' (' + p.year + ')' : '') + '」嗎？\n\n此操作無法復原！',
      confirmText: '確定刪除',
      onConfirm: async () => {
        try {
          const res = await apiFetch('/api/plans/' + p.id, { method: 'DELETE' });
          if (res.ok) {
            showToast('刪除成功', 'success');
            loadPlans(page);
          } else {
            const j = await res.json().catch(() => ({}));
            showToast(j.error || '刪除失敗', 'error');
          }
        } catch (e) {
          showToast('刪除失敗', 'error');
        }
        setConfirmOpen(false);
      },
      onCancel: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

  const openPlanForm = (plan = null) => {
    if (plan) {
      navigate('/import/manage?action=edit&id=' + plan.id);
    } else {
      navigate('/import/manage?action=new');
    }
  };

  const openPlanImport = () => {
    setPlanImportOpen(true);
  };

  const yearOptions = [...new Set(plans.map((p) => p.year).filter(Boolean))].sort((a, b) => b.localeCompare(a));

  return (
    <div className="main-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>管理檢查計畫資料，可新增、編輯、刪除檢查計畫，並支援 Excel 整批匯入。</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => openPlanForm()}>
            ➕ 新增計畫
          </button>
          <button className="btn btn-outline" onClick={openPlanImport}>
            📥 整批匯入
          </button>
        </div>
      </div>
      <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <input
          className="filter-input"
          placeholder="搜尋計畫名稱..."
          style={{ maxWidth: 300 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadPlans(1)}
        />
        <select className="filter-select" style={{ width: 120 }} value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}>
          <option value="">全部年度</option>
          {yearOptions.map((yr) => (
            <option key={yr} value={yr}>
              {yr}年
            </option>
          ))}
        </select>
        <button className="btn btn-outline" onClick={() => loadPlans(1)}>
          搜尋
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          {selectedIds.size > 0 && (
            <button className="btn btn-danger btn-sm" onClick={batchDelete}>
              批次刪除 ({selectedIds.size})
            </button>
          )}
          <select className="page-size-select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); loadPlans(1); }}>
            <option value={10}>10 筆/頁</option>
            <option value={20}>20 筆/頁</option>
            <option value={50}>50 筆/頁</option>
          </select>
          <PaginationBar page={page} pages={pages} onPageChange={setPage} />
        </div>
      </div>
      <div className="data-container">
        <table className="user-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>
                <input type="checkbox" checked={plans.length > 0 && selectedIds.size === plans.length} onChange={(e) => toggleSelectAll(e.target.checked)} />
              </th>
              <th onClick={() => handleSort('year')}>年度</th>
              <th style={{ minWidth: 100 }}>檢查類別</th>
              <th onClick={() => handleSort('name')} style={{ minWidth: 100 }}>檢查計畫名稱</th>
              <th style={{ minWidth: 100 }}>業務類型</th>
              <th style={{ minWidth: 90 }}>規劃次數</th>
              <th style={{ minWidth: 90 }}>已檢查次數</th>
              <th style={{ minWidth: 200 }}>檢查起訖日期</th>
              <th style={{ minWidth: 150 }}>地點</th>
              <th style={{ minWidth: 150 }}>檢查人員</th>
              <th style={{ minWidth: 180 }}>取號編碼</th>
              <th>開立事項數量</th>
              <th onClick={() => handleSort('created_at')}>建立日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => {
              const schedules = planSchedules[p.id] || [];
              const codes = schedules.map((s) => s.plan_number || '-');
              const dates = schedules.map((s) => {
                const start = (s.start_date || '').slice(0, 10);
                const end = (s.end_date || '').slice(0, 10);
                return end && end !== start ? start + ' ~ ' + end : start;
              });
              const locations = schedules.map((s) => s.location || '-');
              const inspectors = schedules.map((s) => s.inspector || '-');
              const inspectionType = schedules[0]?.inspection_type || p.inspection_type;
              return (
                <tr key={p.id}>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} />
                  </td>
                  <td style={{ padding: 12, fontWeight: 600 }}>{p.year || '-'}</td>
                  <td style={{ padding: 12 }}>
                    {inspectionType ? INSPECTION_NAMES[inspectionType] || inspectionType : '-'}
                  </td>
                  <td style={{ padding: 12, fontWeight: 600 }}>{p.name || '-'}</td>
                  <td style={{ padding: 12 }}>{p.business ? BUSINESS_NAMES[p.business] || p.business : '-'}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>{p.planned_count != null ? p.planned_count : '-'}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>{p.schedule_count != null ? p.schedule_count : 0}</td>
                  <td style={{ padding: 12 }}>
                    {dates.length > 0 ? dates.map((d, i) => <div key={i} style={{ margin: '2px 0', fontSize: 12 }}>{d}</div>) : '-'}
                  </td>
                  <td style={{ padding: 12 }}>
                    {locations.length > 0 ? locations.map((l, i) => <div key={i} style={{ margin: '2px 0', fontSize: 12 }}>{l}</div>) : '-'}
                  </td>
                  <td style={{ padding: 12 }}>
                    {inspectors.length > 0 ? inspectors.map((ins, i) => <div key={i} style={{ margin: '2px 0', fontSize: 12 }}>{ins}</div>) : '-'}
                  </td>
                  <td style={{ padding: 12 }}>
                    {codes.length > 0 ? codes.map((c, i) => <div key={i} style={{ margin: '2px 0', fontSize: 12 }}>{c}</div>) : '無'}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>{p.issue_count || 0}</td>
                  <td style={{ padding: 12 }}>{p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : '-'}</td>
                  <td style={{ padding: 12 }}>
                    <button className="btn btn-outline" style={{ padding: '2px 6px', marginRight: 4 }} onClick={() => openPlanForm(p)} title="編輯">
                      ✏️
                    </button>
                    <button className="btn btn-danger" style={{ padding: '2px 6px' }} onClick={() => deletePlan(p)} title="刪除">
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pagination-bar" style={{ padding: 16, justifyContent: 'center' }}>
        <PaginationBar page={page} pages={pages} onPageChange={setPage} />
      </div>

      <ConfirmModal open={confirmOpen} {...confirmConfig} />

      <PlanImportModal
        open={planImportOpen}
        onClose={() => setPlanImportOpen(false)}
        onSuccess={() => {
          setPlanImportOpen(false);
          loadPlans(1);
        }}
      />
    </div>
  );
}
