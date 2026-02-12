import { Link, useLocation } from 'react-router-dom';

export default function AppSidebar({ open, onClose }) {
  const location = useLocation();
  const linkClass = (path) => {
    const isActive = location.pathname === path || (path === '/' && location.pathname === '/search');
    return `sidebar-btn ${isActive ? 'active' : ''}`;
  };

  return (
    <aside className={`filters-panel ${open ? 'open' : ''}`} id="filtersPanel">
      <div className="sidebar-header">
        <div className="sidebar-title">功能選單</div>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="關閉選單">
          ×
        </button>
      </div>
      <Link to="/" className={linkClass('/')} onClick={onClose}>
        開立事項檢索
      </Link>
      <Link to="/calendar" className={linkClass('/calendar')} onClick={onClose}>
        檢查行程檢索
      </Link>
      <Link to="/import" className={linkClass('/import')} onClick={onClose}>
        資料管理
      </Link>
      <Link to="/users" className={linkClass('/users')} onClick={onClose}>
        後台管理
      </Link>
    </aside>
  );
}
