import { useState, useEffect } from 'react';

export default function SearchView() {
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/issues?page=1&limit=10', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { data: [], total: 0 }))
      .then((data) => {
        const gs = data.globalStats?.status || [];
        const total = data.total ?? 0;
        const active = parseInt(gs.find((s) => s.status === '持續列管')?.count, 10) || 0;
        const resolved = gs.filter((s) => ['解除列管', '自行列管'].includes(s.status)).reduce((a, s) => a + parseInt(s.count, 10), 0);
        setStats({ total, active, resolved });
      })
      .catch(() => setStats({ total: 0, active: 0, resolved: 0 }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="view-section active">
      <div className="content-header">
        <div className="content-title">開立事項檢索</div>
      </div>
      <div className="dashboard-section">
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-val" style={{ color: '#6366f1' }}>
              {loading ? '...' : stats.total}
            </div>
            <div className="stat-label">總開立事項</div>
          </div>
          <div className="stat-item">
            <div className="stat-val" style={{ color: '#ef4444' }}>
              {loading ? '...' : stats.active}
            </div>
            <div className="stat-label">列管中</div>
          </div>
          <div className="stat-item">
            <div className="stat-val" style={{ color: '#10b981' }}>
              {loading ? '...' : stats.resolved}
            </div>
            <div className="stat-label">已解除/自行列管</div>
          </div>
        </div>
      </div>
      <div className="main-card">
        <div className="integrated-controls">
          <div className="filter-primary-row">
            <div className="search-item" style={{ flex: 2 }}>
              <label>關鍵字</label>
              <input type="text" className="filter-input" placeholder="輸入關鍵字..." />
            </div>
            <div className="search-item">
              <label>年度</label>
              <select className="filter-select">
                <option value="">全部年度</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
              <button type="button" className="btn btn-primary">
                搜尋
              </button>
              <button type="button" className="btn btn-outline">
                重設
              </button>
            </div>
          </div>
        </div>
        <div className="data-container" style={{ marginTop: 16 }}>
          <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
            Phase 2 將完整遷移搜尋、篩選、列表、Drawer 等功能
          </div>
        </div>
      </div>
    </div>
  );
}
