import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../api/api';
import { stripHtml, getLatestReviewOrHandling, extractKindCodeFromNumber, getKindLabel } from '../utils/helpers';
import DashboardCharts from '../components/search/DashboardCharts';
import DetailDrawer from '../components/common/DetailDrawer';
import ConfirmModal from '../components/common/ConfirmModal';

const SORT_FIELD_MAP = { year: 'year', number: 'number', unit: 'unit', status: 'status', content: 'created_at', latest: 'created_at' };
const DIVISION_OPTIONS = [
  { value: '運務', label: '運務 (A)' }, { value: '工務', label: '工務 (B)' }, { value: '機務', label: '機務 (C)' },
  { value: '電務', label: '電務 (D)' }, { value: '安全', label: '安全 (E)' }, { value: '審核', label: '審核 (F)' },
  { value: '災防', label: '災防 (G)' }, { value: '運轉', label: '運轉 (OP)' }, { value: '土木', label: '土木 (CP)' },
  { value: '機電', label: '機電 (EM)' }, { value: '土建', label: '土建 (CV)' }, { value: '安全管理', label: '安全管理 (SM)' },
  { value: '營運', label: '營運 (AD)' }, { value: '其他', label: '其他 (OT)' },
];

export default function SearchView() {
  const { user } = useAuth();
  const showToast = useToast();
  const [filters, setFilters] = useState({
    keyword: '',
    year: '',
    plan: '',
    unit: '',
    status: '',
    kind: '',
    division: '',
    inspection: '',
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortState, setSortState] = useState({ field: 'year', dir: 'desc' });
  const [globalStats, setGlobalStats] = useState(null);
  const [planOptions, setPlanOptions] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [unitOptions, setUnitOptions] = useState([]);
  const [latestCreatedAt, setLatestCreatedAt] = useState(null);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [drawerIssue, setDrawerIssue] = useState(null);
  const [expandedContentId, setExpandedContentId] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());

  const canManage = user && (user.isAdmin === true || user.role === 'manager');
  const canEdit = canManage;
  const isViewer = user && user.role === 'viewer';

  const loadPlanOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/options/plans?withIssues=true&t=' + Date.now(), {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        setPlanOptions(json.data.map((p) => ({ value: p.value, display: p.display || p.name || '' })));
      }
    } catch (e) {
      console.error('Load plan options failed', e);
    }
  }, []);

  const loadIssues = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const sortField = SORT_FIELD_MAP[sortState.field] || 'created_at';
      const params = new URLSearchParams({
        page: pageNum,
        pageSize,
        q: filters.keyword,
        year: filters.year,
        unit: filters.unit,
        status: filters.status,
        itemKindCode: filters.kind,
        division: filters.division,
        inspectionCategory: filters.inspection,
        planName: filters.plan,
        sortField,
        sortDir: sortState.dir,
        _t: Date.now(),
      });
      const res = await apiFetch('/api/issues?' + params.toString());
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast('載入資料失敗: ' + (err.error || res.statusText), 'error');
        return;
      }
      const j = await res.json();
      setData(j.data || []);
      setTotal(j.total || 0);
      setPages(j.pages || 1);
      setPage(j.page || 1);
      setLatestCreatedAt(j.latestCreatedAt || null);
      if (j.globalStats) {
        setGlobalStats(j.globalStats);
        const years = [...new Set((j.globalStats.year || []).map((x) => x.year).filter(Boolean))].sort().reverse();
        const units = [...new Set((j.globalStats.unit || []).map((x) => x.unit).filter(Boolean))].sort();
        if (years.length) setYearOptions(years);
        if (units.length) setUnitOptions(units);
      }
    } catch (e) {
      console.error(e);
      showToast('載入資料錯誤', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize, sortState, showToast]);

  useEffect(() => {
    loadPlanOptions();
  }, [loadPlanOptions]);

  useEffect(() => {
    loadIssues(page);
  }, [loadIssues, page]);

  const applyFilters = () => {
    setPage(1);
    loadIssues(1);
  };

  const resetFilters = () => {
    setFilters({
      keyword: '',
      year: '',
      plan: '',
      unit: '',
      status: '',
      kind: '',
      division: '',
      inspection: '',
    });
    setPage(1);
    setTimeout(() => loadIssues(1), 0);
  };

  const handleSort = (field) => {
    setSortState((prev) => ({
      field,
      dir: prev.field === field ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc',
    }));
    setPage(1);
    setTimeout(() => loadIssues(1), 0);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      showToast('請至少選擇一筆資料', 'error');
      return;
    }
    setConfirmOpen(true);
    setConfirmConfig({
      message: `確定要刪除 ${selectedIds.size} 筆資料嗎？\n\n此操作無法復原！`,
      confirmText: '確定刪除',
      onConfirm: async () => {
        try {
          const res = await apiFetch('/api/issues/batch-delete', {
            method: 'POST',
            body: JSON.stringify({ ids: Array.from(selectedIds) }),
          });
          if (res.ok) {
            setSelectedIds(new Set());
            loadIssues(page);
            showToast('成功刪除 ' + selectedIds.size + ' 筆資料', 'success');
          } else {
            const j = await res.json().catch(() => ({}));
            showToast('刪除失敗: ' + (j.error || '不明錯誤'), 'error');
          }
        } catch (e) {
          showToast('刪除失敗: ' + (e.message || ''), 'error');
        }
        setConfirmOpen(false);
      },
      onCancel: () => setConfirmOpen(false),
    });
  };

  const toggleSelectAll = (checked) => {
    if (checked) setSelectedIds(new Set(data.map((d) => d.id)));
    else setSelectedIds(new Set());
  };

  const toggleSelect = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const stats = globalStats?.status || [];
  const totalCount = stats.reduce((s, x) => s + parseInt(x.count, 10), 0);
  const activeCount = parseInt(stats.find((x) => x.status === '持續列管')?.count, 10) || 0;
  const resolvedCount = stats
    .filter((x) => ['解除列管', '自行列管'].includes(x.status))
    .reduce((s, x) => s + parseInt(x.count, 10), 0);

  return (
    <div className="view-section active">
      <div className="content-header">
        <div className="content-title">開立事項檢索</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          className="dashboard-toggle-btn"
          onClick={() => setDashboardOpen((o) => !o)}
          title="收合/展開統計圖表"
        >
          <span className="toggle-icon">{dashboardOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {dashboardOpen && (
        <div id="dashboardSection" className="dashboard-section">
          <div className="stats-bar">
            <div className="stat-item">
              <div className="stat-val" style={{ color: '#6366f1' }}>{loading ? '...' : totalCount}</div>
              <div className="stat-label">總開立事項</div>
            </div>
            <div className="stat-item">
              <div className="stat-val" style={{ color: '#ef4444' }}>{loading ? '...' : activeCount}</div>
              <div className="stat-label">列管中</div>
            </div>
            <div className="stat-item">
              <div className="stat-val" style={{ color: '#10b981' }}>{loading ? '...' : resolvedCount}</div>
              <div className="stat-label">已解除/自行列管</div>
            </div>
          </div>
          <DashboardCharts globalStats={globalStats} />
        </div>
      )}

      <div className="main-card">
        <div className="integrated-controls">
          <div className="filter-primary-row">
            <div className="search-item" style={{ flex: 2 }}>
              <label>關鍵字</label>
              <input
                type="text"
                className="filter-input"
                placeholder="輸入關鍵字..."
                value={filters.keyword}
                onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              />
            </div>
            <div className="search-item">
              <label>年度</label>
              <select
                className="filter-select"
                value={filters.year}
                onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
              >
                <option value="">全部年度</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="search-item" style={{ flex: 1.5, minWidth: 200 }}>
              <label>檢查計畫</label>
              <select
                className="filter-select"
                value={filters.plan}
                onChange={(e) => setFilters((f) => ({ ...f, plan: e.target.value }))}
              >
                <option value="">全部計畫</option>
                {planOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.display}</option>
                ))}
              </select>
            </div>
            <div className="search-item">
              <label>機構</label>
              <select
                className="filter-select"
                value={filters.unit}
                onChange={(e) => setFilters((f) => ({ ...f, unit: e.target.value }))}
              >
                <option value="">全部機構</option>
                {unitOptions.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="search-item">
              <label>狀態</label>
              <select
                className="filter-select"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">全部狀態</option>
                <option value="持續列管">持續列管</option>
                <option value="解除列管">解除列管</option>
                <option value="自行列管">自行列管</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={applyFilters}>搜尋</button>
              <button type="button" className="btn btn-outline" onClick={resetFilters}>重設</button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: 8 }}>
            <button type="button" className="btn-link" onClick={() => setAdvancedOpen((o) => !o)}>
              {advancedOpen ? '⬆️ 收合篩選條件' : '⬇️ 顯示更多篩選條件'}
            </button>
          </div>

          <div className={`filter-advanced-row ${advancedOpen ? 'show' : ''}`}>
            <div className="search-item">
              <label>檢查種類</label>
              <select
                className="filter-select"
                value={filters.inspection}
                onChange={(e) => setFilters((f) => ({ ...f, inspection: e.target.value }))}
              >
                <option value="">全部檢查種類</option>
                <option value="定期檢查">定期檢查</option>
                <option value="例行性檢查">例行性檢查</option>
                <option value="特別檢查">特別檢查</option>
                <option value="臨時檢查">臨時檢查</option>
              </select>
            </div>
            <div className="search-item">
              <label>開立類型</label>
              <select
                className="filter-select"
                value={filters.kind}
                onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))}
              >
                <option value="">全部類型</option>
                <option value="N">缺失事項</option>
                <option value="O">觀察事項</option>
                <option value="R">建議事項</option>
              </select>
            </div>
            <div className="search-item">
              <label>分組</label>
              <select
                className="filter-select"
                value={filters.division}
                onChange={(e) => setFilters((f) => ({ ...f, division: e.target.value }))}
              >
                <option value="">全部分組</option>
                {DIVISION_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="control-row-actions">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {canManage && selectedIds.size > 0 && (
                <button className="btn btn-danger btn-sm" onClick={handleBatchDelete}>
                  批次刪除 ({selectedIds.size})
                </button>
              )}
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {latestCreatedAt &&
                  `資料庫更新時間：${new Date(latestCreatedAt).toLocaleDateString('zh-TW')} ${new Date(latestCreatedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                共 <span style={{ color: '#0f172a', fontWeight: 700 }}>{total}</span> 筆
              </div>
              <select
                className="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                  setTimeout(() => loadIssues(1), 0);
                }}
              >
                <option value={10}>10 筆/頁</option>
                <option value={20}>20 筆/頁</option>
                <option value={50}>50 筆/頁</option>
              </select>
              <div className="pagination-bar">
                <button
                  className="page-btn"
                  disabled={page <= 1 || pages <= 0}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ◀
                </button>
                {pages > 0 && Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, pages - 4));
                  const p = start + i;
                  if (p > pages) return null;
                  return (
                    <button
                      key={p}
                      className={`page-btn ${p === page ? 'active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  className="page-btn"
                  disabled={page >= pages || pages <= 0}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  ▶
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="data-container">
          <table id="dataTable">
            <thead>
              <tr>
                {canManage && (
                  <th style={{ width: 40 }} className="manager-col">
                    <input
                      type="checkbox"
                      checked={data.length > 0 && selectedIds.size === data.length}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>
                )}
                <th style={{ width: 70 }} onClick={() => handleSort('year')} className={sortState.field === 'year' ? `sort-${sortState.dir}` : ''}>年度</th>
                <th style={{ width: 130 }} onClick={() => handleSort('number')} className={sortState.field === 'number' ? `sort-${sortState.dir}` : ''}>編號</th>
                <th style={{ width: 80 }} onClick={() => handleSort('unit')} className={sortState.field === 'unit' ? `sort-${sortState.dir}` : ''}>機構</th>
                <th style={{ width: 130 }} onClick={() => handleSort('status')} className={sortState.field === 'status' ? `sort-${sortState.dir}` : ''}>狀態與類型</th>
                <th onClick={() => handleSort('content')} className={sortState.field === 'content' ? `sort-${sortState.dir}` : ''}>事項內容</th>
                <th onClick={() => handleSort('latest')} className={sortState.field === 'latest' ? `sort-${sortState.dir}` : ''}>最新辦理/審查情形</th>
                <th style={{ width: 120 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={canManage ? 8 : 7} style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                    查無資料
                  </td>
                </tr>
              )}
              {data.map((item) => {
                const k = item.item_kind_code || item.itemKindCode || extractKindCodeFromNumber(item.number);
                const kindInfo = getKindLabel(k);
                const st = String(item.status || 'Open');
                const badge = st !== 'Open' && st ? (
                  <span className={`badge ${st === '持續列管' ? 'active' : st === '解除列管' ? 'resolved' : 'self'}`}>{st}</span>
                ) : null;
                const latest = getLatestReviewOrHandling(item);
                const updateTxt = latest
                  ? (latest.type === 'review' ? '[審]' : '[回]') + ' ' + stripHtml(latest.content).slice(0, 80)
                  : '-';
                const snippet = stripHtml(item.content || '').slice(0, 180);
                const fullContent = item.content || '';
                const showMore = stripHtml(fullContent).length > 180;

                return (
                  <tr
                    key={item.id}
                    onClick={() => setDrawerIssue(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    {canManage && (
                      <td className="manager-col" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="issue-check"
                          checked={selectedIds.has(item.id)}
                          onChange={(e) => toggleSelect(item.id, e.target.checked)}
                        />
                      </td>
                    )}
                    <td data-label="年度">{item.year || ''}</td>
                    <td data-label="編號" style={{ fontWeight: 600, color: 'var(--primary)' }}>{item.number || ''}</td>
                    <td data-label="機構">{item.unit || ''}</td>
                    <td data-label="狀態與類型">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {kindInfo && <span className={`kind-tag ${kindInfo.tag}`}>{kindInfo.label}</span>}
                        {badge}
                      </div>
                    </td>
                    <td data-label="事項內容" style={{ verticalAlign: 'top' }}>
                      <div className="text-content" style={{ whiteSpace: expandedContentId === item.id ? 'pre-wrap' : undefined, maxWidth: expandedContentId === item.id ? 'none' : undefined, lineHeight: 1.6 }}>
                        {expandedContentId === item.id ? stripHtml(fullContent) : snippet}
                        {showMore && (
                          expandedContentId === item.id ? (
                            <a
                              href="#"
                              onClick={(e) => { e.stopPropagation(); setExpandedContentId(null); }}
                              style={{ display: 'inline-block', marginTop: 6 }}
                            >
                              收合
                            </a>
                          ) : (
                            <a
                              href="#"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedContentId(item.id);
                              }}
                            >
                              ...更多
                            </a>
                          )
                        )}
                      </div>
                    </td>
                    <td data-label="最新辦理/審查情形">
                      <div className="text-content">{updateTxt}</div>
                    </td>
                    <td data-label="操作">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        {(canEdit || isViewer) && (
                          <button
                            className="badge"
                            style={{ background: '#fff', border: '1px solid #ddd', cursor: 'pointer', marginTop: 4 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrawerIssue(item);
                            }}
                          >
                            {isViewer ? '✏️ 查看詳情' : '✏️ 審查/查看詳情'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, alignItems: 'center', gap: 12, paddingRight: 24, paddingBottom: 40 }}>
        <select
          className="page-size-select"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
            setTimeout(() => loadIssues(1), 0);
          }}
        >
          <option value={10}>10 筆/頁</option>
          <option value={20}>20 筆/頁</option>
          <option value={50}>50 筆/頁</option>
        </select>
        <div className="pagination-bar">
          <button className="page-btn" disabled={page <= 1 || pages <= 0} onClick={() => setPage((p) => Math.max(1, p - 1))}>◀</button>
          {pages > 0 && Array.from({ length: Math.min(5, pages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, pages - 4));
            const p = start + i;
            if (p > pages) return null;
            return (
              <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>
                {p}
              </button>
            );
          })}
          <button className="page-btn" disabled={page >= pages || pages <= 0} onClick={() => setPage((p) => Math.min(pages, p + 1))}>▶</button>
        </div>
      </div>

      <DetailDrawer open={!!drawerIssue} issue={drawerIssue} onClose={() => setDrawerIssue(null)} onRefresh={() => loadIssues(page)} />
      <ConfirmModal
        open={confirmOpen}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        onConfirm={confirmConfig.onConfirm}
        onCancel={confirmConfig.onCancel}
      />
    </div>
  );
}
