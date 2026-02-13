/**
 * 共用載入中元件
 */
export default function LoadingSpinner({ size = 32, label = '載入中...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
      <div
        style={{
          width: size,
          height: size,
          border: `3px solid #e2e8f0`,
          borderTopColor: 'var(--primary, #2563eb)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {label && <span style={{ fontSize: 14, color: '#64748b' }}>{label}</span>}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
