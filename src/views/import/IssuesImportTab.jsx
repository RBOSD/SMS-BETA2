/**
 * 批次匯入 (Word 解析)
 * 使用 mammoth 解析 Word，簡化版表格解析
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { stripHtml, parsePlanValue } from '../../utils/helpers';
import ConfirmModal from '../../components/common/ConfirmModal';

function parseFromHTML(html) {
  const items = [];
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tables = doc.querySelectorAll('table');
    tables.forEach((table) => {
      const rows = table.querySelectorAll('tr');
      let headerRow = -1;
      let dataStart = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const t = (rows[i].innerText || rows[i].textContent || '').replace(/\s+/g, '');
        if ((/編號|項次|序號/).test(t) && (/內容|摘要/).test(t)) {
          headerRow = i;
          dataStart = i + 1;
          break;
        }
      }
      if (headerRow === -1) return;
      const headerCells = rows[headerRow].querySelectorAll('td,th');
      let colNumber = 0;
      let colContent = 1;
      headerCells.forEach((cell, idx) => {
        const text = (cell.innerText || cell.textContent || '').replace(/\s+/g, '');
        if ((/編號|項次|序號/).test(text)) colNumber = idx;
        else if ((/事項內容|缺失內容|觀察內容|內容/).test(text)) colContent = idx;
      });
      for (let r = dataStart; r < rows.length; r++) {
        const cells = rows[r].querySelectorAll('td,th');
        if (cells.length < 2) continue;
        const rawNum = (cells[colNumber]?.innerText || cells[colNumber]?.textContent || '').trim();
        const rawContent = (cells[colContent]?.innerHTML || cells[colContent]?.innerText || '').trim();
        if (!rawNum) continue;
        items.push({
          number: rawNum,
          content: rawContent,
          handling: '',
          status: '持續列管',
        });
      }
    });
  } catch (e) {
    console.error('Parse error:', e);
  }
  return items;
}

export default function IssuesImportTab() {
  const showToast = useToast();
  const { user: currentUser } = useAuth();
  const [planOptions, setPlanOptions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [stage, setStage] = useState('initial');
  const [round, setRound] = useState(1);
  const [planValue, setPlanValue] = useState('');
  const [ownerGroupIds, setOwnerGroupIds] = useState([]);
  const [issueDate, setIssueDate] = useState('');
  const [replyDate, setReplyDate] = useState('');
  const [responseDate, setResponseDate] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [stagedData, setStagedData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({});
  const wordInputRef = useRef(null);

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

  const canParse = stage === 'initial' ? !!issueDate.trim() : true;
  const parseReady = canParse && wordInputRef.current?.files?.[0];

  const handlePreview = async () => {
    const file = wordInputRef.current?.files?.[0];
    if (!file) return showToast('請先選擇 Word 檔案', 'error');
    setStatusMsg('Word 解析中...');
    try {
      const buf = await file.arrayBuffer();
      const { default: mammoth } = await import('mammoth');
      const result = await mammoth.convertToHtml({ arrayBuffer: buf });
      const items = parseFromHTML(result.value);
      if (items.length === 0) {
        setStatusMsg('錯誤：未解析到有效資料');
        return;
      }
      setStagedData(items.map((item) => ({ ...item, _importStatus: 'new' })));
      setShowPreview(true);
      setStatusMsg('');
    } catch (e) {
      setStatusMsg('Word 解析錯誤: ' + e.message);
      showToast('解析失敗', 'error');
    }
  };

  const cancelImport = () => {
    setStagedData([]);
    setShowPreview(false);
    if (wordInputRef.current) wordInputRef.current.value = '';
    setStatusMsg('');
  };

  const confirmImport = () => {
    if (stagedData.length === 0) return;
    if (!planValue) return showToast('請選擇檢查計畫', 'error');
    if (ownerGroupIds.length === 0) return showToast('請至少選擇一個適用群組', 'error');
    if (stage === 'initial' && !issueDate.trim()) return showToast('請填寫初次發函日期', 'error');

    const { name: planName, year: planYear } = parsePlanValue(planValue);
    const cleanData = stagedData.map(({ _importStatus, ...item }) => {
      if (!item.planName && planName) item.planName = planName;
      if (stage === 'initial' && !item.issueDate) item.issueDate = issueDate;
      return item;
    });

    setConfirmConfig({
      message: '確定要匯入 ' + cleanData.length + ' 筆資料嗎？',
      confirmText: '確認',
      onConfirm: async () => {
        try {
          const res = await apiFetch('/api/issues/import', {
            method: 'POST',
            body: JSON.stringify({
              data: cleanData,
              round: stage === 'initial' ? 1 : parseInt(round, 10),
              reviewDate: responseDate,
              replyDate: replyDate,
              mode: 'word',
              ownerGroupIds,
            }),
          });
          const j = await res.json().catch(() => ({}));
          if (res.ok) {
            showToast('匯入成功！', 'success');
            cancelImport();
            loadPlanOptions();
          } else {
            showToast(j.error || '匯入失敗', 'error');
          }
        } catch (e) {
          showToast('匯入錯誤: ' + e.message, 'error');
        }
        setConfirmOpen(false);
      },
      onCancel: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

  if (showPreview) {
    return (
      <div className="main-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: 18, color: '#334155' }}>
            解析結果預覽 ({stagedData.length} 筆) <span className="badge new" style={{ marginLeft: 8 }}>Word 匯入</span>
          </h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={cancelImport}>
              取消
            </button>
            <button className="btn btn-primary" onClick={confirmImport}>
              上傳至資料庫
            </button>
          </div>
        </div>
        <div className="data-container">
          <table className="preview-table">
            <thead>
              <tr>
                <th>操作</th>
                <th>編號</th>
                <th>機構</th>
                <th>事項內容</th>
                <th>辦理/審查內容</th>
              </tr>
            </thead>
            <tbody>
              {stagedData.map((item, i) => (
                <tr key={i}>
                  <td>
                    <span className="badge new">新增</span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{item.number}</td>
                  <td>{item.unit || '-'}</td>
                  <td>
                    <div className="preview-content-box">{stripHtml(item.content)}</div>
                  </td>
                  <td>
                    <div className="preview-content-box">
                      [審查] {item.review || '-'}
                      <br />
                      [辦理] {item.handling || '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ConfirmModal open={confirmOpen} {...confirmConfig} />
      </div>
    );
  }

  return (
    <div className="main-card" style={{ marginBottom: 30 }}>
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: 18, color: '#334155' }}>📝 例行作業區 (Word 解析)</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>用於新增新的審查紀錄。請選擇本次的作業階段。</p>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: 16, borderRadius: 8, marginBottom: 24 }}>
        <label style={{ fontWeight: 700, display: 'block', marginBottom: 12, color: 'var(--text-main)' }}>1. 設定整批匯入參數 (必填)</label>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>請選擇本次匯入的作業階段</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: '#f0f9ff', padding: '10px 16px', borderRadius: 8, border: '1px solid #bae6fd', color: '#0369a1', flex: 1 }}>
              <input type="radio" name="importStage" value="initial" checked={stage === 'initial'} onChange={() => setStage('initial')} />
              <span style={{ fontWeight: 700 }}>初次開立 (新案)</span>
            </label>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: '#fdf2f8', padding: '10px 16px', borderRadius: 8, border: '1px solid #fbcfe8', color: '#be185d', flex: 1 }}>
              <input type="radio" name="importStage" value="review" checked={stage === 'review'} onChange={() => setStage('review')} />
              <span style={{ fontWeight: 700 }}>後續審查 (第 N 次)</span>
            </label>
          </div>
        </div>

        {stage === 'review' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>這是第幾次審查？</div>
            <select className="filter-select" value={round} onChange={(e) => setRound(Number(e.target.value))}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  第 {n} 次審查
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
            檢查計畫名稱 <span style={{ color: '#ef4444' }}>*</span>
          </div>
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

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
            適用群組（可多選）<span style={{ color: '#ef4444' }}>*</span>
          </div>
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

        {stage === 'initial' && (
          <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: 13, color: '#0369a1', marginBottom: 4, fontWeight: 600 }}>📆 日期設定 (初次開立)</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>監理機關初次發函日期 (例如: 1130615)</div>
            <input type="text" className="filter-input" placeholder="必填" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
        )}
        {stage === 'review' && (
          <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: 13, color: '#be185d', marginBottom: 4, fontWeight: 600 }}>📆 日期設定 (審查階段)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>機構回復辦理情形日期</div>
                <input type="text" className="filter-input" placeholder="例如: 1130701" value={replyDate} onChange={(e) => setReplyDate(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>監理機關本次函復日期</div>
                <input type="text" className="filter-input" placeholder="例如: 1130715" value={responseDate} onChange={(e) => setResponseDate(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 700, display: 'block', marginBottom: 12, color: 'var(--text-main)' }}>2. 選擇 Word 檔案 (.docx)</label>
        <input ref={wordInputRef} type="file" className="filter-input" accept=".docx" style={{ padding: 8 }} onChange={() => setStatusMsg('')} />
      </div>
      <button className="btn btn-primary" style={{ width: '100%', padding: 12 }} onClick={handlePreview} disabled={!parseReady}>
        解析並預覽 Word
      </button>
      {statusMsg && <div style={{ marginTop: 12, color: '#64748b', fontSize: 13, textAlign: 'center' }}>{statusMsg}</div>}
    </div>
  );
}
