import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) {
        sessionStorage.removeItem('currentView');
        sessionStorage.removeItem('currentDataTab');
        sessionStorage.removeItem('currentUsersTab');
        if (result.mustChangePassword) {
          sessionStorage.setItem('mustChangePassword', 'true');
        } else {
          sessionStorage.removeItem('mustChangePassword');
        }
        navigate('/', { replace: true });
      } else {
        setError(result.message || '登入失敗');
      }
    } catch (err) {
      setError('連線錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="login-header">
          <div className="login-icon">🚄</div>
          <h1 className="login-title">系統登入</h1>
          <p className="login-subtitle">SMS開立事項查詢與AI審查系統</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>使用者名稱</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="請輸入使用者名稱"
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label>密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
              {error}
            </div>
          )}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
}
