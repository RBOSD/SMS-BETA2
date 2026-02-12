export default function PlaceholderView({ title }) {
  return (
    <div className="view-section active">
      <div className="content-header">
        <div className="content-title">{title}</div>
      </div>
      <div className="main-card">
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          此功能將於 Phase 2–3 遷移（{title}）
        </div>
      </div>
    </div>
  );
}
