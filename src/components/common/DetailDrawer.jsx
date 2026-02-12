import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../api/api';
import { stripHtml, getKindLabel, extractKindCodeFromNumber, escapeHtml } from '../../utils/helpers';
import ConfirmModal from './ConfirmModal';

function getStatusBadge(status) {
  if (!status || status === 'Open') return null;
  const stClass = status === '持續列管' ? 'active' : status === '解除列管' ? 'resolved' : 'self';
  return <span className={`badge ${stClass}`}>{status}</span>;
}

/** 計算當前應編輯的審查輪次（有 handling 的最高輪次） */
function getEditRound(issue) {
  for (let i = 200; i >= 1; i--) {
    const suffix = i === 1 ? '' : i;
    if (issue['handling' + suffix] && String(issue['handling' + suffix]).trim()) return i;
  }
  return 1;
}

export default function DetailDrawer({ open, issue, onClose, onRefresh }) {
  const { user } = useAuth();
  const showToast = useToast();
  const canEdit = user && (user.isAdmin === true || user.role === 'manager');
  const canDelete = canEdit;

  const [editMode, setEditMode] = useState(false);
  const [round, setRound] = useState(1);
  const [status, setStatus] = useState('');
  const [review, setReview] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [viewRound, setViewRound] = useState('latest');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (issue) {
      const editR = getEditRound(issue);
      setRound(editR);
      const suffix = editR === 1 ? '' : editR;
      setReview(issue['review' + suffix] || '');
      setStatus(issue.status || '持續列管');
      setViewRound('latest');
      setAiResult(null);
    }
  }, [issue]);

  useEffect(() => {
    if (!open) setEditMode(false);
  }, [open]);

  if (!issue) return null;

  const k = issue.item_kind_code || issue.itemKindCode || extractKindCodeFromNumber(issue.number);
  const kindInfo = getKindLabel(k);
  const statusBadge = getStatusBadge(issue.status);
  const suffix = round === 1 ? '' : round;
  const currentHandling = issue['handling' + suffix] || '';

  const roundsWithData = [];
  for (let i = 200; i >= 1; i--) {
    const s = i === 1 ? '' : i;
    if ((issue['handling' + s] && issue['handling' + s].trim()) || (issue['review' + s] && issue['review' + s].trim())) {
      roundsWithData.push(i);
    }
  }

  let viewHandling = null;
  let viewReview = null;
  let viewRoundNum = 0;
  if (viewRound === 'latest') {
    for (let k = 200; k >= 1; k--) {
      const s = k === 1 ? '' : k;
      const ha = issue['handling' + s]?.trim();
      const re = issue['review' + s]?.trim();
      if (ha && re) {
        viewHandling = ha;
        viewReview = re;
        viewRoundNum = k;
        break;
      }
    }
  } else {
    const r = parseInt(viewRound, 10);
    const s = r === 1 ? '' : r;
    viewHandling = issue['handling' + s]?.trim() || null;
    viewReview = issue['review' + s]?.trim() || null;
    viewRoundNum = r;
  }

  async function handleSave() {
    if (!review.trim()) {
      showToast('請輸入審查意見', 'error');
      return;
    }
    if (!currentHandling.trim()) {
      showToast(`第 ${round} 次審查時，必須先有第 ${round} 次機構辦理情形。請至「資料管理」頁面新增辦理情形後，再進行審查。`, 'error');
      return;
    }
    setSaveLoading(true);
    try {
      const res = await apiFetch(`/api/issues/${issue.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          round,
          handling: currentHandling,
          review: review.trim(),
          replyDate: issue['reply_date_r' + round] || null,
          responseDate: null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('儲存成功！');
        setEditMode(false);
        onClose();
        onRefresh?.();
      } else {
        showToast(json.error || '儲存失敗', 'error');
      }
    } catch (e) {
      showToast('儲存時發生錯誤: ' + (e.message || ''), 'error');
    } finally {
      setSaveLoading(false);
    }
  }

  function handleDeleteClick() {
    setDeleteConfirmOpen(true);
  }

  async function handleDeleteConfirm() {
    setDeleteConfirmOpen(false);
    try {
      const res = await apiFetch(`/api/issues/${issue.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('刪除成功');
        setEditMode(false);
        onClose();
        onRefresh?.();
      } else {
        const data = await res.json();
        showToast(data.error || '刪除失敗', 'error');
      }
    } catch (e) {
      showToast('刪除失敗: ' + (e.message || ''), 'error');
    }
  }

  async function runAi() {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: stripHtml(issue.content || ''),
          rounds: [{ handling: currentHandling, review: '(待審查)' }],
        }),
      });
      const j = await res.json();
      if (res.ok && (j.result || j.reason)) {
        setAiResult({ result: j.result || j.reason || '', fulfill: j.fulfill || '' });
      } else {
        showToast('AI 分析失敗', 'error');
      }
    } catch (e) {
      showToast('AI Error: ' + (e.message || ''), 'error');
    } finally {
      setAiLoading(false);
    }
  }

  const timelineItems = [];
  let firstRecord = true;
  for (let i = 200; i >= 1; i--) {
    const sf = i === 1 ? '' : i;
    const ha = issue['handling' + sf];
    const re = issue['review' + sf];
    const replyDate = issue['reply_date_r' + i];
    const responseDate = issue['response_date_r' + i];
    if (ha || re) {
      const latestBadge = firstRecord ? <span className="badge new" style={{ marginLeft: 8, fontSize: 11 }}>最新進度</span> : null;
      timelineItems.push(
        <div className="timeline-item" key={i}>
          <div className="timeline-dot" />
          <div className="timeline-title">第 {i} 次辦理情形 {latestBadge}</div>
          {(replyDate || responseDate) && (
            <div style={{ marginBottom: 12 }}>
              {replyDate && <span className="timeline-date-tag">🏢 機構回復: {replyDate}</span>}
              {responseDate && <span className="timeline-date-tag">🏛️ 機關函復: {responseDate}</span>}
            </div>
          )}
          {ha && (
            <div style={{ background: '#ecfdf5', padding: 16, borderRadius: 8, fontSize: 14, lineHeight: 1.6, color: '#047857', border: '1px solid #a7f3d0', marginBottom: 12, whiteSpace: 'pre-wrap' }}>
              <strong>📝 機構辦理情形：</strong><br />{ha}
            </div>
          )}
          {re && (
            <div style={{ background: '#fff', padding: 16, borderRadius: 8, fontSize: 14, lineHeight: 1.6, color: '#334155', border: '1px solid #e2e8f0', borderLeft: '3px solid var(--primary)', whiteSpace: 'pre-wrap' }}>
              <strong>👀 審查意見：</strong><br />{re}
            </div>
          )}
        </div>
      );
      firstRecord = false;
    }
  }

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'open' : ''}`} style={{ display: open ? 'flex' : 'none' }} onClick={onClose} />
      <div className={`drawer ${open ? 'open' : ''}`}>
        <div className="drawer-header">
          <div style={{ fontWeight: 700, fontSize: 18 }}>{editMode ? '審查事項' : '詳細資料'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, color: '#64748b', cursor: 'pointer' }} aria-label="關閉">&times;</button>
        </div>
        <div className="drawer-body">
          {!editMode ? (
            <div id="viewModeContent">
              <div className="detail-card">
                <div className="detail-header-row">
                  <span className="detail-number">{issue.number || ''}</span>
                  <span className="separator">|</span>
                  <span style={{ fontWeight: 500 }}>{issue.plan_name || issue.planName || '(未設定)'}</span>
                  <span className="separator">|</span>
                  <span style={{ color: '#64748b' }}>{issue.inspection_category_name || issue.inspectionCategoryName || '-'}</span>
                  <span className="separator">|</span>
                  <span>
                    {kindInfo && <span className={`kind-tag ${kindInfo.tag}`}>{kindInfo.label}</span>}
                    {statusBadge}
                    {!kindInfo && !statusBadge && '(未設定)'}
                  </span>
                  <span className="separator">|</span>
                  <span style={{ color: '#64748b' }}>{issue.division_name || issue.divisionName || '-'}</span>
                  <span className="separator">|</span>
                  <span style={{ color: '#64748b' }}>發函: <span style={{ color: '#334155', fontWeight: 500 }}>{issue.issue_date || issue.issueDate || '(未設定)'}</span></span>
                </div>
                <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>事項內容</div>
                <div className="content-text" dangerouslySetInnerHTML={{ __html: escapeHtml(issue.content || '') }} />
              </div>
              <div style={{ fontWeight: 700, margin: '24px 0 20px', fontSize: 18, color: '#0f172a' }}>歷程紀錄</div>
              <div style={{ position: 'relative' }}>
                <div className="timeline-line" />
                {timelineItems.length > 0 ? timelineItems : <div style={{ color: '#999', paddingLeft: 20 }}>無歷程紀錄</div>}
              </div>
              <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {canEdit && (
                  <button className="btn btn-primary" style={{ width: '100%', padding: 14, fontSize: 15 }} onClick={() => setEditMode(true)}>
                    ✏️ 審查
                  </button>
                )}
                {canDelete && (
                  <button className="btn btn-danger" style={{ width: '100%', padding: 14, fontSize: 15 }} onClick={handleDeleteClick}>
                    🗑️ 刪除此項目
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div id="editModeContent" className="review-grid">
              <div className="review-left">
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, fontWeight: 700, textTransform: 'uppercase' }}>📋 參考資料</div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: 600 }}>開立事項內容</div>
                    <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, fontSize: 14, lineHeight: 1.6, border: '1px solid #e2e8f0', maxHeight: 250, overflowY: 'auto' }}>
                      {stripHtml(issue.content || '')}
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: 600 }}>選擇查看內容</div>
                    <select className="filter-select" value={viewRound} onChange={(e) => setViewRound(e.target.value)} style={{ fontSize: 14, padding: 6 }}>
                      <option value="latest">最新進度</option>
                      {roundsWithData.map((r) => (
                        <option key={r} value={r}>第 {r} 次</option>
                      ))}
                    </select>
                  </div>
                  {viewHandling && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>📝 第{viewRoundNum}次機構辦理情形：</div>
                      <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 8, fontSize: 14, color: '#047857', border: '1px solid #a7f3d0', maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{viewHandling}</div>
                    </div>
                  )}
                  {viewReview && (
                    <div style={{ marginBottom: 0 }}>
                      <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 700 }}>👀 第{viewRoundNum}次審查意見：</div>
                      <div style={{ background: '#eef2ff', padding: 12, borderRadius: 8, fontSize: 14, color: '#4338ca', border: '1px solid #c7d2fe', maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{viewReview}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="review-right">
                <div style={{ marginBottom: 24, background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase' }}>📋 參考資料</div>
                  <div style={{ fontSize: 13, color: '#475569', marginBottom: 8, fontWeight: 600 }}>第 {round} 次機構辦理情形</div>
                  <div style={{ background: '#fff', padding: 12, borderRadius: 8, fontSize: 14, color: currentHandling ? '#047857' : '#94a3b8', border: '1px solid #cbd5e1', minHeight: 80, maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {currentHandling || '（尚未有機構辦理情形）'}
                  </div>
                </div>
                <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: '#1e293b', marginBottom: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '2px solid #f1f5f9' }}>
                    ✍️ 審查作業 <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 400 }}>(必填)</span>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: 600 }}>審查輪次</div>
                    <span style={{ display: 'inline-block', padding: '10px 14px', background: '#f1f5f9', borderRadius: 8, border: '1px solid #e2e8f0', color: '#334155', fontWeight: 500, fontSize: 13 }}>第 {round} 次</span>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: 600 }}>審查結果</div>
                    <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%', padding: 10 }}>
                      <option value="持續列管">🔴 持續列管</option>
                      <option value="解除列管">🟢 解除列管</option>
                      <option value="自行列管">🟠 自行列管</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>審查意見</div>
                      <button type="button" className="btn btn-ai" style={{ padding: '4px 10px', fontSize: 11 }} onClick={runAi} disabled={aiLoading}>
                        {aiLoading ? 'AI 分析中...' : '🤖 AI 智能分析'}
                      </button>
                    </div>
                    {aiResult && (
                      <div style={{ background: '#f0f9ff', padding: 16, borderRadius: 8, border: '1px solid #bae6fd', marginBottom: 16 }}>
                        <div style={{ fontSize: 13, marginBottom: 8, fontWeight: 'bold', color: '#0369a1' }}>💡 AI 分析建議：</div>
                        <div style={{ background: 'white', padding: 12, border: '1px solid #e0f2fe', borderRadius: 6, fontSize: 14, marginBottom: 12, lineHeight: 1.6, color: '#334155' }}>{aiResult.result}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13 }}>{aiResult.fulfill && (aiResult.fulfill.includes('是') || aiResult.fulfill.includes('Yes')) ? <span className="ai-tag yes">✅ 符合</span> : <span className="ai-tag no">⚠️ 需注意</span>}</span>
                          <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => { setReview(aiResult.result); setAiResult(null); }}>
                            ⬇️ 帶入此意見
                          </button>
                        </div>
                      </div>
                    )}
                    <textarea
                      value={review}
                      onChange={(e) => setReview(e.target.value)}
                      className="filter-input"
                      style={{ flex: 1, resize: 'vertical', lineHeight: 1.6, minHeight: 200, padding: 12, fontSize: 14 }}
                      placeholder="請輸入審查意見..."
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 'auto', paddingTop: 16 }}>
                  <button className="btn btn-primary" style={{ flex: 1, padding: 12 }} onClick={handleSave} disabled={saveLoading}>
                    {saveLoading ? '儲存中...' : '💾 上傳至資料庫'}
                  </button>
                  <button className="btn btn-outline" style={{ flex: 1, padding: 12 }} onClick={() => setEditMode(false)}>
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
