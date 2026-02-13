/**
 * 開立事項修正 - 完整 React 改寫
 * 選擇計畫後可查看並編輯該計畫下所有事項
 */
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import { stripHtml } from '../../utils/helpers';
import DetailDrawer from '../../components/common/DetailDrawer';

function parsePlanValue(value) {
  if (!value) return { name: '', year: '' };
  if (value.indexOf('|||') >= 0) {
    const parts = value.split('|||');
    return { name: parts[0] || '', year: parts[1] || '' };
  }
  return { name: value, year: '' };
}

function extractNumberFromString(str) {
  if (!str) return null;
  const matches = str.match(/(\d+)(?!.*\d)/);
  if (matches?.[1]) return parseInt(matches[1], 10);
  const allNumbers = str.match(/\d+/g);
  if (allNumbers?.length > 0) return parseInt(allNumbers[allNumbers.length - 1], 10);
  return null;
}

export default function IssuesYearEditTab() {
  const showToast = useToast();
  const [planOptions, setPlanOptions] = useState([]);
  const [planValue, setPlanValue] = useState('');
  const [issueList, setIssueList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadPlanOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/options/plans?withIssues=true&t=' + Date.now(), {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error('載入失敗');
      const j = await res.json();
      const data = j.data || [];
      const yearGroups = new Map();
      data.forEach((p) => {
        const planName = (p.name || '').trim();
        const planYear = (p.year || '').trim();
        const planVal = (p.value || planName + '|||' + planYear);
        const groupKey = planYear || '未分類';
        if (!yearGroups.has(groupKey)) yearGroups.set(groupKey, []);
        yearGroups.get(groupKey).push({ value: planVal, display: planName });
      });
      const sorted = Array.from(yearGroups.entries()).sort((a, b) =>
        a[0] === '未分類' ? 1 : b[0] === '未分類' ? -1 : (parseInt(b[0]) || 0) - (parseInt(a[0]) || 0)
      );
      setPlanOptions(sorted);
    } catch (e) {
      showToast('載入檢查計畫失敗: ' + e.message, 'error');
    }
  }, [showToast]);

  const loadIssues = useCallback(
    async (planVal) => {
      if (!planVal) {
        setIssueList([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          '/api/issues?page=1&pageSize=1000&planName=' + encodeURIComponent(planVal) + '&_t=' + Date.now(),
          { credentials: 'include' }
        );
        if (!res.ok) throw new Error('載入失敗');
        const j = await res.json();
        let list = j.data || [];
        list = list.sort((a, b) => {
          const kindOrder = { N: 1, O: 2, R: 3 };
          const kindA = kindOrder[a.item_kind_code || a.itemKindCode || ''] || 99;
          const kindB = kindOrder[b.item_kind_code || b.itemKindCode || ''] || 99;
          if (kindA !== kindB) return kindA - kindB;
          const numA = extractNumberFromString(a.number || '');
          const numB = extractNumberFromString(b.number || '');
          if (numA != null && numB != null) return numA - numB;
          return (a.number || '').localeCompare(b.number || '', 'zh-TW');
        });
        setIssueList(list);
      } catch (e) {
        showToast('載入事項列表失敗', 'error');
        setIssueList([]);
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadPlanOptions();
  }, [loadPlanOptions]);

  useEffect(() => {
    loadIssues(planValue);
  }, [planValue, loadIssues]);

  const handleSelectIssue = (issue) => {
    setSelectedIssue(issue);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedIssue(null);
  };

  const handleRefresh = () => {
    loadIssues(planValue);
  };

  const viewState = !planValue ? 'empty' : loading ? 'loading' : issueList.length === 0 ? 'notfound' : 'list';

  return (
    <div className="main-card">
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#334155', fontSize: 18 }}>📝 開立事項修正</h3>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          選擇檢查計畫後，可查看該計畫下的所有事項，點選後可編輯該事項的全部內容，包括所有審查及回復紀錄。
        </p>
      </div>

      <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, marginBottom: 24, border: '1px solid #e2e8f0' }}>
        <label style={{ display: 'block', fontWeight: 600, color: '#475569', fontSize: 13, marginBottom: 8 }}>
          檢查計畫 <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select className="filter-select" style={{ width: '100%' }} value={planValue} onChange={(e) => setPlanValue(e.target.value)}>
          <option value="">請選擇檢查計畫</option>
          {planOptions.map(([year, plans]) => (
            <optgroup key={year} label={year === '未分類' ? '未分類' : year + ' 年度'}>
              {plans.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.display}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {viewState === 'loading' && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>載入中...</div>
      )}

      {viewState === 'empty' && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>請選擇檢查計畫</div>
          <div style={{ fontSize: 13 }}>選擇後將自動顯示該計畫下的所有事項</div>
        </div>
      )}

      {viewState === 'notfound' && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#ef4444' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>該檢查計畫下尚無開立事項</div>
          <div style={{ fontSize: 13 }}>請選擇其他檢查計畫</div>
        </div>
      )}

      {viewState === 'list' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 12, fontWeight: 600, color: '#334155', fontSize: 15 }}>
            事項列表（共 {issueList.length} 項）
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
            {issueList.map((issue, index) => {
              const contentPreview = stripHtml(issue.content || '').substring(0, 150);
              const kindCode = issue.item_kind_code || issue.itemKindCode || '';
              const kindLabel = kindCode === 'N' ? '缺失' : kindCode === 'O' ? '觀察' : kindCode === 'R' ? '建議' : '';
              return (
                <div
                  key={issue.id}
                  onClick={() => handleSelectIssue(issue)}
                  style={{
                    padding: 16,
                    borderBottom: index < issueList.length - 1 ? '1px solid #e2e8f0' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 15 }}>{issue.number || '-'}</span>
                        {kindLabel && (
                          <span
                            className="badge"
                            style={{
                              background: kindCode === 'N' ? '#fef2f2' : kindCode === 'O' ? '#fef9c3' : '#ecfdf5',
                              border: `1px solid ${kindCode === 'N' ? '#fecaca' : kindCode === 'O' ? '#fde68a' : '#a7f3d0'}`,
                              color: kindCode === 'N' ? '#dc2626' : kindCode === 'O' ? '#92400e' : '#047857',
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          >
                            {kindLabel}
                          </span>
                        )}
                        <span
                          className="badge"
                          style={{
                            background: issue.status === '持續列管' ? '#eff6ff' : issue.status === '解除列管' ? '#f0fdf4' : '#fef3c7',
                            border: `1px solid ${issue.status === '持續列管' ? '#bfdbfe' : issue.status === '解除列管' ? '#bbf7d0' : '#fde68a'}`,
                            color: issue.status === '持續列管' ? '#1d4ed8' : issue.status === '解除列管' ? '#15803d' : '#92400e',
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          {issue.status || '持續列管'}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                        {contentPreview || '（無內容）'}
                        {contentPreview.length >= 150 ? '...' : ''}
                      </div>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: 14 }}>→</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <DetailDrawer
        open={drawerOpen}
        issue={selectedIssue}
        onClose={handleCloseDrawer}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
