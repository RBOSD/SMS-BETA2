/**
 * 批次辦理情形管理 Modal
 */
export default function BatchHandlingModal({ open, number, rounds, onAddRound, onRemoveRound, onUpdateRound, onSave, onClose }) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box" style={{ maxWidth: 900, width: '95%', maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>管理辦理情形 - {number || '未命名'}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, color: '#64748b', cursor: 'pointer' }} aria-label="關閉">
            ×
          </button>
        </div>
        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>💡 可為此筆事項新增多次辦理情形（選填）</div>
        </div>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={onAddRound} style={{ padding: '8px 16px', fontSize: 13 }}>
            ➕ 新增辦理情形
          </button>
        </div>
        <div style={{ marginBottom: 20 }}>
          {rounds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>尚未新增辦理情形，點擊「新增辦理情形」開始新增</div>
          ) : (
            rounds.map((roundData, index) => (
              <div
                key={index}
                style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: '#334155', fontSize: 14 }}>第 {roundData.round} 次機構辦理情形</div>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => onRemoveRound(index)} style={{ padding: '4px 12px', fontSize: 12 }}>
                    刪除
                  </button>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontWeight: 600, color: '#475569', fontSize: 13, marginBottom: 6 }}>辦理情形</label>
                  <textarea
                    className="filter-input"
                    placeholder="請輸入機構辦理情形..."
                    style={{ width: '100%', minHeight: 120, padding: 12, fontSize: 14, lineHeight: 1.6, resize: 'vertical', background: 'white' }}
                    value={roundData.handling}
                    onChange={(e) => onUpdateRound(index, 'handling', e.target.value)}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
          <button className="btn btn-primary" onClick={onSave} style={{ flex: 1, padding: 12 }}>
            💾 儲存辦理情形
          </button>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1, padding: 12 }}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
