import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from '../common/ChangePasswordModal';

export default function AppHeader({ sidebarOpen, onToggleSidebar }) {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    logout();
  }

  const roleLabel = user?.role === 'manager' ? '資料管理者' : user?.role === 'admin' ? '系統管理員' : '檢視人員';

  return (
    <header className="app-header">
      <div className="brand" onClick={() => {}} title="回到開立事項檢索">
        <button
          className="filter-toggle-btn"
          onClick={(e) => { e.stopPropagation(); onToggleSidebar(); }}
          title={sidebarOpen ? '收合選單' : '展開選單'}
          aria-label={sidebarOpen ? '收合選單' : '展開選單'}
        >
          ☰
        </button>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none', color: 'inherit' }}>
          <div className="brand-icon">🚄</div>
          <div className="brand-title">SMS開立事項查詢與AI審查系統</div>
        </Link>
      </div>
      <div className="user-menu-container">
        <div
          className="user-capsule"
          onClick={() => setDropdownOpen((o) => !o)}
          role="button"
          tabIndex={0}
          aria-label="使用者選單"
        >
          <div className="user-name">{user?.name || user?.username || '...'}</div>
          <div className="user-role">{roleLabel}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>▼</div>
        </div>
        {dropdownOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 105 }}
              onClick={() => setDropdownOpen(false)}
              aria-hidden="true"
            />
            <div className="user-dropdown show" id="userDropdown" onClick={(e) => e.stopPropagation()}>
              <button className="dropdown-item" onClick={() => { setDropdownOpen(false); setShowPasswordModal(true); }}>
                ⚙️ 個人設定
              </button>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item"
                style={{ color: '#ef4444' }}
                onClick={() => { setDropdownOpen(false); handleLogout(); }}
              >
                登出系統
              </button>
            </div>
          </>
        )}
      </div>
      <ChangePasswordModal
        open={showPasswordModal}
        mode="personal"
        onSuccess={() => setShowPasswordModal(false)}
      />
    </header>
  );
}
