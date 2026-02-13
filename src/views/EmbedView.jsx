/**
 * 嵌入 public 版頁面（用於資料管理、後台管理、行程檢索等尚未完全遷移至 React 的功能）
 * 透過 iframe 載入 /embed 並傳遞 view/tab/sub 參數
 */
export default function EmbedView({ view, tab, sub }) {
  const params = new URLSearchParams();
  params.set('embed', '1');
  if (view) params.set('view', view);
  if (tab) params.set('tab', tab);
  if (sub) params.set('sub', sub);
  const src = `/embed?${params.toString()}`;

  return (
    <div className="view-section active" style={{ height: '100%', minHeight: 'calc(100vh - 120px)' }}>
      <iframe
        src={src}
        title={view || '嵌入頁面'}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 'calc(100vh - 120px)',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
}
