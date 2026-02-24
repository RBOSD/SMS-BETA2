import { escapeHtml } from '../../utils/helpers';

export default function PreviewModal({ open, title, content, onClose }) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="modal-box" id="previewBox" style={{ maxWidth: 800, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="previewTitle">{title || '內容預覽'}</h3>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: 20 }}
            aria-label="關閉"
          >
            ×
          </button>
        </div>
        <div id="previewContent" style={{ marginTop: 12 }} dangerouslySetInnerHTML={{ __html: escapeHtml(content || '(無內容)') }} />
      </div>
    </div>
  );
}
