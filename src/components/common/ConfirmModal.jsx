import { useEffect } from 'react';

export default function ConfirmModal({ open, message, confirmText, cancelText, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
    >
      <div className="modal-box" style={{ maxWidth: 500, width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: '#334155' }}>確認操作</h3>
          <button
            onClick={onCancel}
            style={{ border: 'none', background: 'none', fontSize: 24, color: '#64748b', cursor: 'pointer' }}
            aria-label="關閉"
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: '#475569', marginBottom: 24, whiteSpace: 'pre-line' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="btn btn-primary" style={{ flex: 1, padding: 12 }} onClick={onConfirm}>
            {confirmText || '確認'}
          </button>
          <button className="btn btn-outline" style={{ flex: 1, padding: 12 }} onClick={onCancel}>
            {cancelText || '取消'}
          </button>
        </div>
      </div>
    </div>
  );
}
