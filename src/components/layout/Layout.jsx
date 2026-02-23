import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import LoadingSpinner from '../common/LoadingSpinner';
import BackToTop from '../common/BackToTop';

const SIDEBAR_STORAGE_KEY = 'sms-sidebar-open';

const SearchView = lazy(() => import('../../views/SearchView'));
const CalendarView = lazy(() => import('../../views/CalendarView'));
const UsersView = lazy(() => import('../../views/UsersView'));
const ImportView = lazy(() => import('../../views/ImportView'));

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen));
    } catch (_) {}
  }, [sidebarOpen]);

  return (
    <>
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className={`app-body ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
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
          <Suspense fallback={<div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><LoadingSpinner size={40} /></div>}>
            <Routes>
              <Route path="/" element={<SearchView />} />
              <Route path="/search" element={<SearchView />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/import" element={<Navigate to="/import/batch" replace />} />
              <Route path="/import/:sub" element={<ImportView />} />
              <Route path="/users" element={<Navigate to="/users/list" replace />} />
              <Route path="/users/:tab" element={<UsersView />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <BackToTop />
    </>
  );
}
