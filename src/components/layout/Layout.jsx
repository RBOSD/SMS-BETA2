import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import SearchView from '../../views/SearchView';
import PlaceholderView from '../../views/PlaceholderView';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <AppHeader onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className="app-body">
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div
          id="filterBackdrop"
          className={sidebarOpen ? 'visible' : ''}
          style={{ display: sidebarOpen ? 'block' : 'none' }}
          onClick={() => setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="關閉選單"
        />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<SearchView />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/calendar" element={<PlaceholderView title="檢查行程檢索" />} />
            <Route path="/import" element={<PlaceholderView title="資料管理" />} />
            <Route path="/users" element={<PlaceholderView title="後台管理" />} />
          </Routes>
        </main>
      </div>
    </>
  );
}
