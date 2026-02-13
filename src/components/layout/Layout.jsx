import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import SearchView from '../../views/SearchView';
import CalendarView from '../../views/CalendarView';
import EmbedView from '../../views/EmbedView';
import UsersView from '../../views/UsersView';
import ImportView from '../../views/ImportView';

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
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/import" element={<Navigate to="/import/batch" replace />} />
            <Route path="/import/:sub" element={<ImportView />} />
            <Route path="/users" element={<Navigate to="/users/list" replace />} />
            <Route path="/users/:tab" element={<UsersView />} />
          </Routes>
        </main>
      </div>
    </>
  );
}
