import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const refreshAuth = () => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.isLogin && data?.id) {
          const isAdmin = data.isAdmin === true || data.is_admin === true;
          setUser({
            id: data.id,
            username: data.username,
            name: data.name,
            role: data.role,
            isAdmin,
            groupIds: data.groupIds || [],
          });
          setAiEnabled(data.aiEnabled !== false);
        } else {
          setUser(null);
          setAiEnabled(true);
        }
      })
      .catch(() => { setUser(null); setAiEnabled(true); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.user);
      refreshAuth();
      return { success: true, mustChangePassword: data.mustChangePassword };
    }
    return { success: false, message: data.error || data.message || '登入失敗' };
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, aiEnabled, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
