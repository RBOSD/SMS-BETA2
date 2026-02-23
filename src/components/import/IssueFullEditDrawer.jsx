/**
 * 事項修正專用 - 完整編輯視窗
 * 可編輯事項的全部內容：編號、事項內容、年度、機構、分組、類型、狀態、檢查計畫、開立日期，
 * 以及所有輪次的辦理情形、審查意見、機構回復日期、機關函復日期。
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../api/api';
import { stripHtml } from '../../utils/helpers';
import ConfirmModal from '../common/ConfirmModal';

const DIVISION_OPTIONS = ['', '運務', '工務', '機務', '電務', '安全', '審核', '災防', '運轉', '土木', '機電', '土建', '安全管理', '營運', '其他'];
const INSPECTION_OPTIONS = ['', '定期檢查', '例行性檢查', '特別檢查', '臨時檢查', '調查'];
const KIND_OPTIONS = [
  { value: '', label: '-' },
  { value: 'N', label: '缺失' },
  { value: 'O', label: '觀察' },
  { value: 'R', label: '建議' },
];
const STATUS_OPTIONS = ['持續列管', '解除列管', '自行列管'];

function getRoundsWithData(issue) {
  const rounds = [];
  for (let i = 1; i <= 30; i++) {
    const s = i === 1 ? '' : i;
    const ha = issue['handling' + s];
    const re = issue['review' + s];
    const reply = issue['reply_date_r' + i];
    const resp = issue['response_date_r' + i];
    if (ha?.trim() || re?.trim() || reply || resp) rounds.push(i);
  }
  return rounds.length > 0 ? rounds : [1];
}

export default function IssueFullEditDrawer({ open, issue, onClose, onRefresh }) {
  const { user } = useAuth();
  const showToast = useToast();
  const canEdit = user && (user.isAdmin === true || user.role === 'manager');
  const canDelete = canEdit;

  const [planOptions, setPlanOptions] = useState([]);
  const [number, setNumber] = useState('');
  const [content, setContent] = useState('');
  const [year, setYear] = useState('');
  const [unit, setUnit] = useState('');
  const [divisionName, setDivisionName] = useState('');
  const [inspectionCategoryName, setInspectionCategoryName] = useState('');
  const [itemKindCode, setItemKindCode] = useState('');
  const [status, setStatus] = useState('持續列管');
  const [planValue, setPlanValue] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [roundsData, setRoundsData] = useState({}); // { 1: { handling, review, replyDate, responseDate }, ... }
  const [expandedRounds, setExpandedRounds] = useState(new Set([1]));
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addRoundNum, setAddRoundNum] = useState(2);

  const loadPlanOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/options/plans?withIssues=true&t=' + Date.now(), { credentials: 'include' });
      if (!res.ok) return;
      const j = await res.json();
      const data = j.data || [];
      const yearGroups = new Map();
      data.forEach((p) => {
        const planName = (p.name || '').trim();
        const planYear = (p.year || '').trim();
        const planVal = p.value || planName + '|||' + planYear;
        const groupKey = planYear || '未分類';
        if (!yearGroups.has(groupKey)) yearGroups.set(groupKey, []);
        yearGroups.get(groupKey).push({ value: planVal, display: planName });
      });
      const sorted = Array.from(yearGroups.entries()).sort((a, b) =>
        a[0] === '未分類' ? 1 : b[0] === '未分類' ? -1 : (parseInt(b[0]) || 0) - (parseInt(a[0]) || 0)
      );
      setPlanOptions(sorted);
    } catch (e) {
      console.error('Load plans failed', e);
    }
  }, []);

  useEffect(() => {
    loadPlanOptions();
  }, [loadPlanOptions]);

  useEffect(() => {
    if (issue && open) {
      setNumber(issue.number || '');
      setContent(stripHtml(issue.content || ''));
      setYear(issue.year || '');
      setUnit(issue.unit || '');
      setDivisionName(issue.division_name || issue.divisionName || '');
      setInspectionCategoryName(issue.inspection_category_name || issue.inspectionCategoryName || '');
      setItemKindCode(issue.item_kind_code || issue.itemKindCode || '');
      setStatus(issue.status || '持續列管');
      const pn = issue.plan_name || issue.planName || '';
      const py = issue.year || '';
      setPlanValue(pn && py ? pn + '|||' + py : '');
      const id = issue.issue_date || issue.issueDate || '';
      setIssueDate(typeof id === 'string' ? id : id ? String(id).slice(0, 10).replace(/-/g, '') : '');

      const rounds = getRoundsWithData(issue);
      const data = {};
      for (const r of rounds) {
        const s = r === 1 ? '' : r;
        data[r] = {
          handling: issue['handling' + s] || '',
          review: issue['review' + s] || '',
          replyDate: issue['reply_date_r' + r] || '',
          responseDate: issue['response_date_r' + r] || '',
        };
      }
      setRoundsData(data);
      setExpandedRounds(new Set(rounds));
      setAddRoundNum(Math.max(...rounds, 1) + 1);
    }
  }, [issue, open]);

  const updateRound = (r, field, value) => {
    setRoundsData((prev) => ({
      ...prev,
      [r]: { ...(prev[r] || { handling: '', review: '', replyDate: '', responseDate: '' }), [field]: value },
    }));
  };

  const addRound = () => {
    const r = addRoundNum;
    setRoundsData((prev) => ({ ...prev, [r]: { handling: '', review: '', replyDate: '', responseDate: '' } }));
    setExpandedRounds((prev) => new Set([...prev, r]));
    setAddRoundNum(r + 1);
  };

  const removeRound = (r) => {
    if (r === 1) return showToast('第 1 次無法刪除', 'error');
    setRoundsData((prev) => {
      const next = { ...prev };
      delete next[r];
      return next;
    });
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      next.delete(r);
      return next;
    });
  };

  const toggleRound = (r) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const handleSave = async () => {
    if (!issue || !canEdit) return;
    if (!number?.trim()) {
      showToast('請輸入編號', 'error');
      return;
    }
    if (!content?.trim()) {
      showToast('請輸入事項內容', 'error');
      return;
    }

    const rounds = Object.keys(roundsData)
      .map(Number)
      .filter((r) => r >= 1)
      .sort((a, b) => a - b);

    setSaveLoading(true);
    try {
      const [planName, planYear] = planValue ? planValue.split('|||') : ['', ''];
      const firstRound = roundsData[1] || { handling: '', review: '', replyDate: '', responseDate: '' };

      const firstPayload = {
        number: number.trim(),
        content: content.trim(),
        year: year.trim() || undefined,
        unit: unit.trim() || undefined,
        divisionName: divisionName.trim() || undefined,
        inspectionCategoryName: inspectionCategoryName.trim() || undefined,
        itemKindCode: itemKindCode || undefined,
        status,
        planName: planName?.trim() || undefined,
        issueDate: issueDate?.trim() || undefined,
        round: 1,
        handling: firstRound.handling || '',
        review: firstRound.review || '',
        replyDate: firstRound.replyDate || null,
        responseDate: firstRound.responseDate || null,
      };

      const res1 = await apiFetch(`/api/issues/${issue.id}`, {
        method: 'PUT',
        body: JSON.stringify(firstPayload),
      });
      const j1 = await res1.json();
      if (!res1.ok || !j1.success) {
        showToast(j1.error || '儲存失敗', 'error');
        setSaveLoading(false);
        return;
      }

      for (const r of rounds) {
        if (r === 1) continue;
        const rd = roundsData[r] || { handling: '', review: '', replyDate: '', responseDate: '' };
        const res = await apiFetch(`/api/issues/${issue.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            status,
            round: r,
            handling: rd.handling || '',
            review: rd.review || '',
            replyDate: rd.replyDate || null,
            responseDate: rd.responseDate || null,
          }),
        });
        const j = await res.json();
        if (!res.ok || !j.success) {
          showToast(`第 ${r} 次儲存失敗: ${j.error || '不明錯誤'}`, 'error');
          setSaveLoading(false);
          return;
        }
      }

      showToast('儲存成功！', 'success');
      onRefresh?.();
      onClose();
    } catch (e) {
      showToast('儲存失敗: ' + (e.message || '不明錯誤'), 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteClick = () => setDeleteConfirmOpen(true);

  const handleDeleteConfirm = async () => {
    setDeleteConfirmOpen(false);
    if (!issue || !canDelete) return;
    try {
      const res = await apiFetch(`/api/issues/${issue.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('刪除成功', 'success');
        onRefresh?.();
        onClose();
      } else {
        const data = await res.json();
        showToast(data.error || '刪除失敗', 'error');
      }
    } catch (e) {
      showToast('刪除失敗: ' + (e.message || ''), 'error');
    }
  };

  if (!issue) return null;

  const rounds = Object.keys(roundsData)
    .map(Number)
    .filter((r) => r >= 1)
    .sort((a, b) => a - b);

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'open' : ''}`} style={{ display: open ? 'flex' : 'none' }} onClick={onClose} />
      <div className={`drawer ${open ? 'open' : ''}`} style={{ maxWidth: 720 }}>
        <div className="drawer-header">
          <div style={{ fontWeight: 700, fontSize: 18 }}>✏️ 事項修正 - 完整編輯</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, color: '#64748b', cursor: 'pointer' }} aria-label="關閉">
            &times;
          </button>
        </div>
        <div className="drawer-body" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {canEdit ? (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase' }}>基本資料</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>編號 <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="filter-input" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="例如: 24T13-A02-N01" style={{ width: '100%', fontFamily: 'monospace' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>事項內容 <span style={{ color: '#ef4444' }}>*</span></label>
                    <textarea
                      className="filter-input"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="請輸入事項內容..."
                      style={{ width: '100%', minHeight: 120, resize: 'vertical', lineHeight: 1.6, padding: 12 }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>年度</label>
                      <input type="text" className="filter-input" value={year} onChange={(e) => setYear(e.target.value)} placeholder="114" style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>機構</label>
                      <input type="text" className="filter-input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="臺鐵、高鐵..." style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>開立日期</label>
                      <input type="text" className="filter-input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} placeholder="1130501" style={{ width: '100%' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>分組</label>
                      <select className="filter-select" value={divisionName} onChange={(e) => setDivisionName(e.target.value)} style={{ width: '100%' }}>
                        {DIVISION_OPTIONS.map((d) => (
                          <option key={d || 'empty'} value={d}>
                            {d || '-'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>檢查種類</label>
                      <select className="filter-select" value={inspectionCategoryName} onChange={(e) => setInspectionCategoryName(e.target.value)} style={{ width: '100%' }}>
                        {INSPECTION_OPTIONS.map((opt) => (
                          <option key={opt || 'empty'} value={opt}>
                            {opt || '-'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>類型</label>
                      <select className="filter-select" value={itemKindCode} onChange={(e) => setItemKindCode(e.target.value)} style={{ width: '100%' }}>
                        {KIND_OPTIONS.map((k) => (
                          <option key={k.value || 'empty'} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>狀態</label>
                      <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>檢查計畫</label>
                    <select className="filter-select" value={planValue} onChange={(e) => setPlanValue(e.target.value)} style={{ width: '100%' }}>
                      <option value="">請選擇</option>
                      {planOptions.map(([yr, plans]) => (
                        <optgroup key={yr} label={yr === '未分類' ? '未分類' : yr + ' 年度'}>
                          {plans.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.display}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>歷程紀錄（辦理情形與審查）</div>
                  <button type="button" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={addRound}>
                    + 新增第 {addRoundNum} 次
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {rounds.map((r) => {
                    const rd = roundsData[r] || { handling: '', review: '', replyDate: '', responseDate: '' };
                    const isExpanded = expandedRounds.has(r);
                    return (
                      <div key={r} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                        <div
                          style={{
                            padding: '12px 16px',
                            background: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                          }}
                          onClick={() => toggleRound(r)}
                        >
                          <span style={{ fontWeight: 600, color: '#334155' }}>第 {r} 次辦理情形</span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                            {r > 1 && (
                              <button type="button" className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => removeRound(r)}>
                                刪除
                              </button>
                            )}
                            <span style={{ fontSize: 18, color: '#94a3b8' }}>{isExpanded ? '▼' : '▶'}</span>
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>機構辦理情形</label>
                              <textarea
                                className="filter-input"
                                value={rd.handling}
                                onChange={(e) => updateRound(r, 'handling', e.target.value)}
                                placeholder="請輸入機構辦理情形..."
                                style={{ width: '100%', minHeight: 80, resize: 'vertical', fontSize: 14, lineHeight: 1.5 }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>審查意見</label>
                              <textarea
                                className="filter-input"
                                value={rd.review}
                                onChange={(e) => updateRound(r, 'review', e.target.value)}
                                placeholder="請輸入審查意見..."
                                style={{ width: '100%', minHeight: 80, resize: 'vertical', fontSize: 14, lineHeight: 1.5 }}
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>機構回復日期</label>
                                <input type="text" className="filter-input" value={rd.replyDate} onChange={(e) => updateRound(r, 'replyDate', e.target.value)} placeholder="例: 1130601" style={{ width: '100%' }} />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>機關函復日期</label>
                                <input type="text" className="filter-input" value={rd.responseDate} onChange={(e) => updateRound(r, 'responseDate', e.target.value)} placeholder="例: 1130615" style={{ width: '100%' }} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>無編輯權限</div>
          )}
        </div>
        {canEdit && (
          <div
            style={{
              flexShrink: 0,
              padding: '20px 32px',
              borderTop: '1px solid var(--border)',
              background: '#fff',
              display: 'flex',
              gap: 12,
            }}
          >
            <button className="btn btn-primary" style={{ flex: 1, padding: 12 }} onClick={handleSave} disabled={saveLoading}>
              {saveLoading ? '儲存中...' : '💾 儲存全部'}
            </button>
            {canDelete && (
              <button className="btn btn-danger" style={{ padding: 12 }} onClick={handleDeleteClick}>
                🗑️ 刪除
              </button>
            )}
          </div>
        )}
      </div>
      <ConfirmModal
        open={deleteConfirmOpen}
        message={`確定要刪除事項「${issue.number || 'ID:' + issue.id}」嗎？\n\n此操作無法復原。`}
        confirmText="確定刪除"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
}
