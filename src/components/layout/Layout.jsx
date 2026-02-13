import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import SearchView from '../../views/SearchView';
import EmbedView from '../../views/EmbedView';

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
            <Route path="/calendar" element={<EmbedView view="planCalendarView" />} />
            <Route path="/import" element={<Navigate to="/import/batch" replace />} />
            <Route path="/import/batch" element={<EmbedView view="importView" tab="issues" sub="import" />} />
            <Route path="/import/create" element={<EmbedView view="importView" tab="issues" sub="create" />} />
            <Route path="/import/year-edit" element={<EmbedView view="importView" tab="issues" sub="year-edit" />} />
            <Route path="/import/schedule" element={<EmbedView view="importView" tab="plans" sub="schedule" />} />
            <Route path="/import/manage" element={<EmbedView view="importView" tab="plans" sub="manage" />} />
            <Route path="/users" element={<Navigate to="/users/list" replace />} />
            <Route path="/users/list" element={<EmbedView view="usersView" tab="users" />} />
            <Route path="/users/logs" element={<EmbedView view="usersView" tab="logs" />} />
            <Route path="/users/actions" element={<EmbedView view="usersView" tab="actions" />} />
            <Route path="/users/system" element={<EmbedView view="usersView" tab="system" />} />
          </Routes>
        </main>
      </div>
    </>
  );
}
