import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const IMPORT_ROUTES = [
  { path: '/import/batch', label: '批次匯入', embed: 'import:issues:import' },
  { path: '/import/create', label: '開立事項建檔', embed: 'import:issues:create' },
  { path: '/import/year-edit', label: '事項修正', embed: 'import:issues:year-edit' },
  { path: '/import/schedule', label: '行程規劃', embed: 'import:plans:schedule' },
  { path: '/import/manage', label: '計畫管理', embed: 'import:plans:manage' },
];

const USERS_ROUTES = [
  { path: '/users/list', label: '帳號列表', embed: 'users:users' },
  { path: '/users/logs', label: '登入紀錄', embed: 'users:logs' },
  { path: '/users/actions', label: '操作歷程', embed: 'users:actions' },
  { path: '/users/system', label: '系統維護', embed: 'users:system' },
];

export default function AppSidebar({ open, onClose }) {
  const location = useLocation();
  const { user } = useAuth();

  const canManage = user && (user.isAdmin === true || user.role === 'manager');
  const canAdmin = user && user.isAdmin === true;

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
          <div className="sidebar-group expanded">
            <div className={`sidebar-btn sidebar-btn-parent ${location.pathname.startsWith('/import') ? 'active' : ''}`}>
              資料管理
            </div>
            <div className="sidebar-sub">
              {IMPORT_ROUTES.map((r) => (
                <Link
                  key={r.path}
                  to={r.path}
                  className={subLinkClass(r.path)}
                  onClick={onClose}
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
        )}
        {canAdmin && (
          <div className="sidebar-group expanded">
            <div className={`sidebar-btn sidebar-btn-parent ${location.pathname.startsWith('/users') ? 'active' : ''}`}>
              後台管理
            </div>
            <div className="sidebar-sub">
              {USERS_ROUTES.map((r) => (
                <Link
                  key={r.path}
                  to={r.path}
                  className={subLinkClass(r.path)}
                  onClick={onClose}
                >
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
