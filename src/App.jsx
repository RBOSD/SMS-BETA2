import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/layout/Layout';
import LoginPage from './views/LoginPage';
import ChangePasswordModal from './components/common/ChangePasswordModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

function ProtectedRoute({ children }) {
  const { user, loading, logout } = useAuth();
  const [showChangePwd, setShowChangePwd] = useState(false);

  useEffect(() => {
    if (user && sessionStorage.getItem('mustChangePassword') === 'true') {
      setShowChangePwd(true);
    }
  }, [user]);

  const handleChangePwdSuccess = async () => {
    sessionStorage.removeItem('mustChangePassword');
    setShowChangePwd(false);
    await logout();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ color: '#64748b', fontSize: 16 }}>載入中...</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <>
      {children}
      {showChangePwd && <ChangePasswordModal open onSuccess={handleChangePwdSuccess} />}
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
