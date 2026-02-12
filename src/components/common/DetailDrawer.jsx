import { useAuth } from '../../context/AuthContext';
import { stripHtml, getKindLabel, extractKindCodeFromNumber, escapeHtml } from '../../utils/helpers';

function getStatusBadge(status) {
  if (!status || status === 'Open') return null;
  const stClass = status === '持續列管' ? 'active' : status === '解除列管' ? 'resolved' : 'self';
  return <span className={`badge ${stClass}`}>{status}</span>;
}

export default function DetailDrawer({ open, issue, onClose }) {
  const { user } = useAuth();
  const canEdit = user && (user.isAdmin === true || user.role === 'manager');
  const canDelete = canEdit;

  if (!issue) return null;

  const k = issue.item_kind_code || issue.itemKindCode || extractKindCodeFromNumber(issue.number);
  const kindInfo = getKindLabel(k);
  const statusBadge = getStatusBadge(issue.status);

  const timelineItems = [];
  let firstRecord = true;
  for (let i = 200; i >= 1; i--) {
    const suffix = i === 1 ? '' : i;
    const ha = issue['handling' + suffix];
    const re = issue['review' + suffix];
    const replyDate = issue['reply_date_r' + i];
    const responseDate = issue['response_date_r' + i];
    if (ha || re) {
      const latestBadge = firstRecord ? <span className="badge new" style={{ marginLeft: 8, fontSize: 11 }}>最新進度</span> : null;
      timelineItems.push(
        <div className="timeline-item" key={i}>
          <div className="timeline-dot" />
          <div className="timeline-title">
            第 {i} 次辦理情形 {latestBadge}
          </div>
          {(replyDate || responseDate) && (
            <div style={{ marginBottom: 12 }}>
              {replyDate && <span className="timeline-date-tag">🏢 機構回復: {replyDate}</span>}
              {responseDate && <span className="timeline-date-tag">🏛️ 機關函復: {responseDate}</span>}
            </div>
          )}
          {ha && (
            <div style={{ background: '#ecfdf5', padding: 16, borderRadius: 8, fontSize: 14, lineHeight: 1.6, color: '#047857', border: '1px solid #a7f3d0', marginBottom: 12, whiteSpace: 'pre-wrap' }}>
              <strong>📝 機構辦理情形：</strong>
              <br />
              {ha}
            </div>
          )}
          {re && (
            <div style={{ background: '#fff', padding: 16, borderRadius: 8, fontSize: 14, lineHeight: 1.6, color: '#334155', border: '1px solid #e2e8f0', borderLeft: '3px solid var(--primary)', whiteSpace: 'pre-wrap' }}>
              <strong>👀 審查意見：</strong>
              <br />
              {re}
            </div>
          )}
        </div>
      );
      firstRecord = false;
    }
  }

  return (
    <>
      <div
        className={`drawer-backdrop ${open ? 'open' : ''}`}
        style={{ display: open ? 'flex' : 'none' }}
        onClick={onClose}
      />
      <div className={`drawer ${open ? 'open' : ''}`}>
        <div className="drawer-header">
          <div style={{ fontWeight: 700, fontSize: 18 }}>詳細資料</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, color: '#64748b', cursor: 'pointer' }} aria-label="關閉">
            &times;
          </button>
        </div>
        <div className="drawer-body">
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
                <button className="btn btn-primary" style={{ width: '100%', padding: 14, fontSize: 15 }} disabled>
                  ✏️ 審查（將於後續遷移）
                </button>
              )}
              {canDelete && (
                <button className="btn btn-danger hidden" style={{ width: '100%', padding: 14, fontSize: 15 }}>
                  🗑️ 刪除此項目
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
