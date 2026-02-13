/**
 * 開立事項建檔 - 完整 React 改寫
 * 功能、版型、顏色、字體、字型與原版一致
 */
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { parseItemNumber, ORG_MAP, DIVISION_MAP, INSPECTION_MAP } from '../../utils/parseItemNumber';
import { parsePlanValue } from '../../utils/helpers';
import ConfirmModal from '../../components/common/ConfirmModal';
import BatchHandlingModal from '../../components/import/BatchHandlingModal';

const DIVISION_OPTIONS = ['', '運務', '工務', '機務', '電務', '安全', '審核', '災防', '運轉', '土木', '機電', '土建', '安全管理', '營運', '其他'];
const INSPECTION_OPTIONS = ['', '定期檢查', '例行性檢查', '特別檢查', '臨時檢查'];
const KIND_OPTIONS = [
  { value: '', label: '-' },
  { value: 'N', label: '缺失' },
  { value: 'O', label: '觀察' },
  { value: 'R', label: '建議' },
];
const STATUS_OPTIONS = ['持續列管', '解除列管', '自行列管'];

const emptyRow = () => ({
  number: '',
  content: '',
  year: '',
  unit: '',
  division: '',
  inspection: '',
  kind: '',
  status: '持續列管',
});

export default function IssuesCreateTab() {
  const showToast = useToast();
  const { user: currentUser } = useAuth();
  const [planOptions, setPlanOptions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [planValue, setPlanValue] = useState('');
  const [ownerGroupIds, setOwnerGroupIds] = useState([]);
  const [issueDate, setIssueDate] = useState('');
  const [rows, setRows] = useState([emptyRow()]);
  const [batchHandlingData, setBatchHandlingData] = useState({});
  const [handlingModalOpen, setHandlingModalOpen] = useState(false);
  const [handlingModalRowIndex, setHandlingModalRowIndex] = useState(-1);
  const [continuousMode, setContinuousMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({});

  const loadPlanOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/options/plans?t=' + Date.now(), { credentials: 'include' });
      if (!res.ok) return;
      const j = await res.json();
      const data = j.data || [];
      const yearGroups = new Map();
      data.forEach((p) => {
        const planName = (p.name || '').trim();
        const planYear = (p.year || '').trim();
        const planVal = planName + '|||' + planYear;
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

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups?_t=' + Date.now(), { credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.data) {
        const dataGroups = j.data.filter((g) => !(g.is_admin_group === true || g.isAdminGroup === true));
        const myGroupIds = (currentUser?.groupIds || []).map((x) => parseInt(x, 10)).filter(Number.isFinite);
        const allowed = currentUser?.isAdmin === true ? dataGroups : dataGroups.filter((g) => myGroupIds.includes(parseInt(g.id, 10)));
        setGroups(allowed);
      }
    } catch (e) {
      console.error('Load groups failed', e);
    }
  }, [currentUser]);

  useEffect(() => {
    loadPlanOptions();
    loadGroups();
  }, [loadPlanOptions, loadGroups]);

  const toggleGroup = (gid) => {
    setOwnerGroupIds((prev) => {
      const id = parseInt(gid, 10);
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const handleNumberChange = (idx, val) => {
    const info = val.trim() ? parseItemNumber(val) : null;
    const { year: planYear } = parsePlanValue(planValue);
    setRows((prev) => {
      const next = [...prev];
      let updates = { number: val };
      if (info) {
        if (planYear) updates.year = String(planYear);
        else if (info.yearRoc) updates.year = String(info.yearRoc);
        if (info.orgCode && info.orgCode !== '?') {
          const name = ORG_MAP[info.orgCode] || info.orgCode;
          if (name && name !== '?') updates.unit = name;
        }
        if (info.divCode && info.divCode !== '?') {
          const divName = DIVISION_MAP[info.divCode];
          if (divName) updates.division = divName;
        }
        if (info.inspectCode && info.inspectCode !== '?') {
          const inspectName = INSPECTION_MAP[info.inspectCode];
          if (inspectName) updates.inspection = inspectName;
        }
        if (info.kindCode && info.kindCode !== '?') updates.kind = info.kindCode;
      }
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const updateRow = (idx, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (idx) => {
    if (rows.length <= 1) return showToast('至少需保留一列', 'error');
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setBatchHandlingData((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k, 10);
        if (ki < idx) next[ki] = v;
        else if (ki > idx) next[ki - 1] = v;
      });
      return next;
    });
  };

  const openHandlingModal = (idx) => {
    if (!rows[idx]?.number?.trim()) return showToast('請先填寫編號', 'error');
    setHandlingModalRowIndex(idx);
    setHandlingModalOpen(true);
  };

  const handlingRounds = handlingModalRowIndex >= 0 ? (batchHandlingData[handlingModalRowIndex] || []).map((r, i) => ({ ...r, round: i + 1 })) : [];

  const addHandlingRound = () => {
    if (handlingModalRowIndex < 0) return;
    setBatchHandlingData((prev) => {
      const rounds = prev[handlingModalRowIndex] || [];
      const next = { ...prev };
      next[handlingModalRowIndex] = [...rounds, { handling: '', replyDate: '' }];
      return next;
    });
  };

  const removeHandlingRound = (index) => {
    if (handlingModalRowIndex < 0) return;
    setBatchHandlingData((prev) => {
      const rounds = (prev[handlingModalRowIndex] || []).filter((_, i) => i !== index);
      const next = { ...prev };
      next[handlingModalRowIndex] = rounds;
      return next;
    });
  };

  const updateHandlingRound = (index, field, value) => {
    if (handlingModalRowIndex < 0) return;
    setBatchHandlingData((prev) => {
      const rounds = [...(prev[handlingModalRowIndex] || [])];
      if (rounds[index]) rounds[index] = { ...rounds[index], [field]: value };
      const next = { ...prev };
      next[handlingModalRowIndex] = rounds;
      return next;
    });
  };

  const saveHandlingRounds = () => {
    showToast('辦理情形已儲存（將在批次新增時一併保存）', 'success');
    setHandlingModalOpen(false);
    setHandlingModalRowIndex(-1);
  };

  const resetGrid = () => {
    setRows([emptyRow()]);
    setBatchHandlingData({});
  };

  const saveItems = async () => {
    if (!planValue) return showToast('請選擇檢查計畫', 'error');
    const { name: planName, year: planYear } = parsePlanValue(planValue);
    if (!issueDate.trim()) return showToast('請填寫初次發函日期', 'error');
    if (ownerGroupIds.length === 0) return showToast('請至少選擇一個適用群組', 'error');

    const items = [];
    let hasError = false;
    rows.forEach((r, idx) => {
      if (!r.number?.trim() && !r.content?.trim()) return;
      if (!r.number?.trim()) {
        showToast(`第 ${idx + 1} 列缺少編號`, 'error');
        hasError = true;
        return;
      }
      let year = r.year?.trim();
      if (planYear && year !== planYear) year = planYear;
      if (!year || !r.unit?.trim()) {
        showToast(`第 ${idx + 1} 列的年度或機構未能自動判別，請確認編號格式或選擇有年度的檢查計畫`, 'error');
        hasError = true;
        return;
      }
      const handlingRounds = batchHandlingData[idx] || [];
      const firstHandling = handlingRounds[0] || { handling: '', replyDate: '' };
      items.push({
        number: r.number.trim(),
        year,
        unit: r.unit.trim(),
        content: r.content?.trim() || '',
        status: r.status,
        itemKindCode: r.kind || '',
        divisionName: r.division || '',
        inspectionCategoryName: r.inspection || '',
        planName,
        issueDate: issueDate.trim(),
        handling: firstHandling.handling?.trim() || '',
        replyDate: firstHandling.replyDate?.trim() || '',
        scheme: 'BATCH',
        handlingRounds,
      });
    });

    if (hasError) return;
    if (items.length === 0) return showToast('請至少輸入一筆有效資料', 'error');

    const numberSet = new Set();
    const dup = items.filter((item) => {
      if (numberSet.has(item.number)) return true;
      numberSet.add(item.number);
      return false;
    });
    if (dup.length > 0) {
      showToast('發現重複編號，請修正後再儲存', 'error');
      return;
    }

    setConfirmConfig({
      message: `確定要批次新增 ${items.length} 筆資料嗎？\n\n計畫：${planName}`,
      confirmText: '確定新增',
      onConfirm: async () => {
        try {
          const itemsForImport = items.map(({ handlingRounds, ...item }) => item);
          const res = await apiFetch('/api/issues/import', {
            method: 'POST',
            body: JSON.stringify({
              data: itemsForImport,
              round: 1,
              reviewDate: '',
              replyDate: '',
              ownerGroupIds,
            }),
          });

          if (res.ok) {
            const result = await res.json();
            if (result.newCount > 0 || result.updateCount > 0) {
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const rounds = item.handlingRounds || [];
                if (rounds.length > 1) {
                  const verifyRes = await fetch(`/api/issues?page=1&pageSize=100&q=${encodeURIComponent(item.number)}&_t=${Date.now()}`, { credentials: 'include' });
                  if (verifyRes.ok) {
                    const verifyData = await verifyRes.json();
                    const exactMatch = verifyData.data?.find((issue) => String(issue.number) === String(item.number));
                    if (exactMatch) {
                      for (let j = 1; j < rounds.length; j++) {
                        const roundData = rounds[j];
                        if (roundData.handling?.trim()) {
                          await apiFetch(`/api/issues/${exactMatch.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                              status: item.status,
                              round: j + 1,
                              handling: roundData.handling.trim(),
                              review: '',
                              replyDate: roundData.replyDate?.trim() || null,
                              responseDate: null,
                            }),
                          });
                        }
                      }
                    }
                  }
                }
              }
              showToast('批次新增成功！', 'success');
            } else {
              showToast('批次新增成功！', 'success');
            }

            if (continuousMode) {
              setRows((prev) =>
                prev.map((r, i) => (i < items.length ? { ...r, number: '', content: '', kind: '' } : r))
              );
              setBatchHandlingData((prev) => {
                const next = { ...prev };
                items.forEach((_, i) => delete next[i]);
                return next;
              });
            } else {
              resetGrid();
              setPlanValue('');
              setIssueDate('');
            }
            loadPlanOptions();
          } else {
            const j = await res.json().catch(() => ({}));
            showToast('新增失敗: ' + (j.error || '不明錯誤'), 'error');
          }
        } catch (e) {
          showToast('Error: ' + e.message, 'error');
        }
        setConfirmOpen(false);
      },
      onCancel: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

  const getHandlingStatus = (idx) => {
    const rounds = batchHandlingData[idx] || [];
    const hasHandling = rounds.length > 0 && rounds.some((r) => r.handling?.trim());
    return hasHandling ? `已填寫 (${rounds.filter((r) => r.handling?.trim()).length}次)` : '新增辦理情形';
  };

  return (
    <div className="main-card" style={{ width: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: 18, color: '#334155' }}>📝 開立事項建檔</h3>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          選擇計畫後，可連續輸入多筆事項。系統會自動根據編號判斷年度、機構與分組。可同時新增事項內容及多次辦理情形。
        </p>
      </div>

      <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: 2, minWidth: 300 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#475569' }}>
              檢查計畫名稱 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select className="filter-select" value={planValue} onChange={(e) => setPlanValue(e.target.value)}>
              <option value="">請選擇計畫</option>
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
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#475569' }}>
              適用群組（可多選）<span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', padding: '10px 0', minHeight: 40 }}>
              {groups.length === 0 ? (
                <span style={{ color: '#94a3b8', fontSize: 13 }}>載入中…</span>
              ) : (
                groups.map((g) => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#334155' }}>
                    <input type="checkbox" checked={ownerGroupIds.includes(parseInt(g.id, 10))} onChange={() => toggleGroup(g.id)} style={{ width: 16, height: 16 }} />
                    <span>{g.name || '群組 ' + g.id}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#475569' }}>
              初次發函日期 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input type="text" className="filter-input" placeholder="例如: 1130501" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', color: '#64748b', fontSize: 13 }}>
          💡 提示：輸入編號後，按下 Enter 或 離開欄位，系統會自動帶入相關欄位。可為每筆事項新增辦理情形。
        </div>
        <button className="btn btn-outline" onClick={resetGrid} style={{ padding: '8px 16px' }}>
          重置表格
        </button>
      </div>

      <div className="main-card" style={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}>
        <div className="data-container" style={{ overflowX: 'auto' }}>
          <table className="user-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>項次</th>
                <th style={{ width: 180 }}>編號</th>
                <th style={{ minWidth: 250 }}>事項內容</th>
                <th style={{ width: 90 }}>年度</th>
                <th style={{ width: 120 }}>機構</th>
                <th style={{ width: 100 }}>分組</th>
                <th style={{ width: 120 }}>檢查種類</th>
                <th style={{ width: 100 }}>類型</th>
                <th style={{ width: 110 }}>狀態</th>
                <th style={{ width: 120 }}>辦理情形</th>
                <th style={{ width: 60 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="編號..."
                      style={{ fontFamily: 'monospace' }}
                      value={r.number}
                      onChange={(e) => handleNumberChange(idx, e.target.value)}
                      onBlur={(e) => handleNumberChange(idx, e.target.value)}
                    />
                  </td>
                  <td style={{ position: 'relative' }}>
                    <textarea
                      className="filter-input"
                      rows={3}
                      placeholder="請輸入事項內容..."
                      style={{ resize: 'vertical', minHeight: 60, maxHeight: 120, fontSize: 13, lineHeight: 1.6, padding: '8px 10px' }}
                      value={r.content}
                      onChange={(e) => updateRow(idx, 'content', e.target.value)}
                    />
                  </td>
                  <td>
                    <input type="text" className="filter-input" style={{ background: '#f1f5f9', color: '#64748b' }} readOnly value={r.year} />
                  </td>
                  <td>
                    <input type="text" className="filter-input" style={{ background: '#f1f5f9', color: '#64748b' }} readOnly value={r.unit} />
                  </td>
                  <td>
                    <select className="filter-select" value={r.division} onChange={(e) => updateRow(idx, 'division', e.target.value)}>
                      {DIVISION_OPTIONS.map((d) => (
                        <option key={d || 'empty'} value={d}>
                          {d || '-'}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="filter-select" value={r.inspection} onChange={(e) => updateRow(idx, 'inspection', e.target.value)}>
                      {INSPECTION_OPTIONS.map((opt) => (
                        <option key={opt || 'empty'} value={opt}>
                          {opt || '-'}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="filter-select" value={r.kind} onChange={(e) => updateRow(idx, 'kind', e.target.value)}>
                      {KIND_OPTIONS.map((k) => (
                        <option key={k.value || 'empty'} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="filter-select" value={r.status} onChange={(e) => updateRow(idx, 'status', e.target.value)}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => openHandlingModal(idx)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        width: '100%',
                        backgroundColor: (batchHandlingData[idx] || []).some((x) => x.handling?.trim()) ? '#ecfdf5' : '',
                        borderColor: (batchHandlingData[idx] || []).some((x) => x.handling?.trim()) ? '#10b981' : '',
                        color: (batchHandlingData[idx] || []).some((x) => x.handling?.trim()) ? '#047857' : '',
                      }}
                    >
                      {getHandlingStatus(idx)}
                    </button>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-danger btn-sm" onClick={() => removeRow(idx)} style={{ padding: '4px 8px' }}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
          <button className="btn btn-outline" style={{ width: '100%', borderStyle: 'dashed' }} onClick={addRow}>
            新增一列
          </button>
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, background: '#f8fafc', borderRadius: 8 }}>
          <label style={{ fontSize: 13, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={continuousMode} onChange={(e) => setContinuousMode(e.target.checked)} />
            連續新增模式 (儲存後自動新增新列，保留計畫與機構)
          </label>
        </div>
        <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={saveItems}>
          💾 上傳至資料庫
        </button>
      </div>

      <BatchHandlingModal
        open={handlingModalOpen}
        number={handlingModalRowIndex >= 0 ? rows[handlingModalRowIndex]?.number : ''}
        rounds={handlingRounds}
        onAddRound={addHandlingRound}
        onRemoveRound={removeHandlingRound}
        onUpdateRound={updateHandlingRound}
        onSave={saveHandlingRounds}
        onClose={() => { setHandlingModalOpen(false); setHandlingModalRowIndex(-1); }}
      />

      <ConfirmModal open={confirmOpen} {...confirmConfig} />
    </div>
  );
}
