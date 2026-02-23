import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const IMPORT_ROUTES = [
  { path: '/import/batch', label: '批次匯入' },
  { path: '/import/create', label: '開立事項建檔' },
  { path: '/import/year-edit', label: '事項修正' },
  { path: '/import/schedule', label: '行程規劃' },
  { path: '/import/manage', label: '計畫管理' },
];

const USERS_ROUTES = [
  { path: '/users/list', label: '帳號列表' },
  { path: '/users/logs', label: '登入紀錄' },
  { path: '/users/actions', label: '操作歷程' },
  { path: '/users/system', label: '系統維護' },
];

export default function AppSidebar({ open, onClose }) {
  const location = useLocation();
  const { user } = useAuth();

  const isAdmin = user?.isAdmin === true || user?.is_admin === true;
  const canManage = user && (isAdmin || user.role === 'manager');
  const canAdmin = user && isAdmin;

  const linkClass = (path) => {
    const isActive = location.pathname === path || (path === '/' && (location.pathname === '/' || location.pathname === '/search'));
    return `sidebar-btn ${isActive ? 'active' : ''}`;
  };

  const subLinkClass = (path) => {
    const isActive = location.pathname === path;
    return `sidebar-sub-btn ${isActive ? 'active' : ''}`;
  };

  return (
    <aside className={`filters-panel ${open ? 'open' : ''}`} id="filtersPanel">
      <div className="sidebar-header">
        <div className="sidebar-title">功能選單</div>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="關閉選單">
          ×
        </button>
      </div>
      <nav className="sidebar-nav">
        <Link to="/" className={linkClass('/')} onClick={onClose}>
          開立事項檢索
        </Link>
        <Link to="/calendar" className={linkClass('/calendar')} onClick={onClose}>
          檢查行程檢索
        </Link>
        {canManage && (
          <div className="sidebar-group expanded" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className={`sidebar-btn sidebar-btn-parent ${location.pathname.startsWith('/import') ? 'active' : ''}`}>
              資料管理
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 12, paddingLeft: 12, borderLeft: '2px solid #e2e8f0' }}>
              {IMPORT_ROUTES.map((r) => (
                <Link key={r.path} to={r.path} className={subLinkClass(r.path)} onClick={onClose} style={{ display: 'block', padding: '10px 14px' }}>
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
        )}
        {canAdmin && (
          <div className="sidebar-group expanded" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className={`sidebar-btn sidebar-btn-parent ${location.pathname.startsWith('/users') ? 'active' : ''}`}>
              後台管理
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 12, paddingLeft: 12, borderLeft: '2px solid #e2e8f0' }}>
              {USERS_ROUTES.map((r) => (
                <Link key={r.path} to={r.path} className={subLinkClass(r.path)} onClick={onClose} style={{ display: 'block', padding: '10px 14px' }}>
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
