export default function PaginationBar({ page, pages, onPageChange }) {
  if (pages <= 0) return null;
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  return (
    <div className="pagination-bar">
      <button className="page-btn" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
        ◀
      </button>
      {Array.from({ length: Math.min(5, pages) }, (_, i) => {
        const p = start + i;
        if (p > pages) return null;
        return (
          <button
            key={p}
            className={`page-btn ${p === page ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        );
      })}
      <button className="page-btn" disabled={page >= pages} onClick={() => onPageChange(Math.min(pages, page + 1))}>
        ▶
      </button>
    </div>
  );
}
