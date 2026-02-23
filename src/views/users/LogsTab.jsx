import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import PaginationBar from '../../components/users/PaginationBar';

export default function LogsTab() {
  const showToast = useToast();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [cleanupDays, setCleanupDays] = useState('30');
  const [customDays, setCustomDays] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({});

  const loadLogs = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum,
        pageSize,
        q: search,
        _t: Date.now(),
      });
      const res = await apiFetch('/api/admin/logs?' + params.toString());
      if (!res.ok) {
        showToast('載入登入紀錄失敗', 'error');
        return;
      }
      const j = await res.json();
      setData(j.data || []);
      setTotal(j.total || 0);
      setPages(j.pages || 1);
      setPage(j.page || 1);
    } catch (e) {
      showToast('載入登入紀錄錯誤', 'error');
    } finally {
      setLoading(false);
    }
  }, [pageSize, search, showToast]);

  useEffect(() => {
    loadLogs(page);
  }, [loadLogs, page]);

  const handleExport = () => {
    if (!data || data.length === 0) {
      showToast('無資料可匯出', 'error');
      return;
    }
    let csv = '\uFEFF時間,帳號,姓名,IP位址\n';
    data.forEach((row) => {
      csv += `"${new Date(row.login_time).toLocaleString('zh-TW')}","${row.username || ''}","${row.user_name || ''}","${row.ip_address || ''}"\n`;
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'login_logs_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('匯出完成', 'success');
  };

  const handleDelete = async () => {
    const days = cleanupDays === 'custom' ? parseInt(customDays, 10) : parseInt(cleanupDays, 10);
    const logTypeName = '登入';
    if (cleanupDays === 'all') {
      setConfirmConfig({
        message: `確定要刪除資料庫中所有「${logTypeName}」紀錄嗎？\n\n此動作無法復原！`,
        confirmText: '確定刪除',
        onConfirm: async () => {
          try {
            const res = await apiFetch('/api/admin/logs', { method: 'DELETE' });
            if (res.ok) {
              showToast('資料庫記錄已全部刪除', 'success');
              loadLogs(1);
            } else showToast('刪除失敗', 'error');
          } catch (e) {
            showToast('Error: ' + e.message, 'error');
          }
          setConfirmOpen(false);
        },
        onCancel: () => setConfirmOpen(false),
      });
    } else {
      if (cleanupDays === 'custom' && (!days || days < 1)) {
        showToast('請輸入有效的保留天數（至少1天）', 'error');
        return;
      }
      setConfirmConfig({
        message: `確定要刪除資料庫中 ${days} 天前的「${logTypeName}」紀錄嗎？\n\n將保留最近 ${days} 天的記錄。\n\n此動作無法復原！`,
        confirmText: '確定刪除',
        onConfirm: async () => {
          try {
            const res = await apiFetch('/api/admin/logs/cleanup', {
              method: 'POST',
              body: JSON.stringify({ days }),
            });
            const data = await res.json();
            if (res.ok) {
              showToast(`已刪除 ${data.deleted || 0} 筆 ${days} 天前的${logTypeName}紀錄`, 'success');
              loadLogs(1);
            } else showToast(data.error || '刪除失敗', 'error');
          } catch (e) {
            showToast('Error: ' + e.message, 'error');
          }
          setConfirmOpen(false);
        },
        onCancel: () => setConfirmOpen(false),
      });
    }
    setConfirmOpen(true);
  };

  return (
    <div className="main-card">
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: 18, color: '#334155' }}>登入紀錄</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
          查看系統使用者的登入紀錄，包含登入時間、帳號、姓名和 IP 位址。可匯出資料或清理舊紀錄。
        </p>
      </div>
      <div
        style={{
          padding: 16,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          background: '#ffffff',
          flexWrap: 'wrap',
        }}
      >
        <input
          className="filter-input"
          placeholder="搜尋所有內容"
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), loadLogs(1))}
        />
        <button className="btn btn-outline btn-sm" onClick={() => { setPage(1); loadLogs(1); }}>搜尋</button>
        <button className="btn btn-outline btn-sm" onClick={handleExport}>
          匯出 CSV
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="filter-select"
            style={{ width: 140 }}
            value={cleanupDays}
            onChange={(e) => {
              setCleanupDays(e.target.value);
              setShowCustomInput(e.target.value === 'custom');
            }}
          >
            <option value="30">保留30天</option>
            <option value="60">保留60天</option>
            <option value="90">保留90天</option>
            <option value="180">保留180天</option>
            <option value="365">保留365天</option>
            <option value="custom">自訂天數</option>
            <option value="all">刪除全部</option>
          </select>
          {showCustomInput && (
            <input
              type="number"
              min={1}
              placeholder="天數"
              className="filter-input"
              style={{ width: 80 }}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
            />
          )}
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>
            刪除資料庫記錄
          </button>
        </div>
      </div>
      <div className="pagination-bar" style={{ padding: 16, borderBottom: '1px solid var(--border)', justifyContent: 'flex-end' }}>
        <PaginationBar page={page} pages={pages} onPageChange={setPage} />
      </div>
      <div className="data-container">
        <table className="user-table">
          <thead>
            <tr>
              <th style={{ padding: 16 }}>時間</th>
              <th>帳號</th>
              <th>姓名</th>
              <th>IP 位址</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                  ⏳ 載入紀錄中...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                  查無資料
                </td>
              </tr>
            ) : (
              data.map((l, i) => (
                <tr key={i}>
                  <td data-label="時間" style={{ padding: 12 }}>
                    {new Date(l.login_time).toLocaleString('zh-TW')}
                  </td>
                  <td data-label="帳號">{l.username || ''}</td>
                  <td data-label="姓名">{l.user_name || '-'}</td>
                  <td data-label="IP">{l.ip_address || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination-bar" style={{ padding: 16, justifyContent: 'center' }}>
        <PaginationBar page={page} pages={pages} onPageChange={setPage} />
      </div>
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
