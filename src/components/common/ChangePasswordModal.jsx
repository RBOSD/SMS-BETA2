import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../api/api';
import { validatePasswordFrontend } from '../../utils/helpers';

export default function ChangePasswordModal({ open, onSuccess }) {
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const showToast = useToast();

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!newPwd || !confirmPwd) {
      setError('請輸入新密碼和確認密碼');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('兩次輸入的密碼不一致');
      return;
    }
    const validation = validatePasswordFrontend(newPwd);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ password: newPwd }),
      });
      if (res.ok) {
        showToast('密碼更新成功，請重新登入', 'success');
        setNewPwd('');
        setConfirmPwd('');
        onSuccess?.();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || '密碼更新失敗');
      }
    } catch (e) {
      setError('連線錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" style={{ display: 'flex', zIndex: 10000 }}>
      <div className="modal-box" style={{ maxWidth: 500, width: '90%' }}>
        <h3 style={{ marginTop: 0, color: '#dc2626' }}>⚠️ 首次登入，請更新密碼</h3>
        <div style={{ background: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 20, border: '1px solid #fecaca' }}>
          <div style={{ fontSize: 14, color: '#991b1b' }}>為了您的帳號安全，請設定一個新的密碼。密碼必須符合以下要求：</div>
          <ul style={{ margin: '8px 0 0 20px', fontSize: 13, color: '#7f1d1d' }}>
            <li>至少 8 個字元</li>
            <li>包含至少一個大寫字母</li>
            <li>包含至少一個小寫字母</li>
            <li>包含至少一個數字</li>
          </ul>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>新密碼</label>
            <div className="pwd-wrapper">
              <input
                type={showNewPwd ? 'text' : 'password'}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="filter-input"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="pwd-toggle"
                onClick={() => setShowNewPwd((s) => !s)}
                aria-label="顯示/隱藏密碼"
              >
                {showNewPwd ? '🚫' : '👁️'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>確認新密碼</label>
            <div className="pwd-wrapper">
              <input
                type={showConfirmPwd ? 'text' : 'password'}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="filter-input"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="pwd-toggle"
                onClick={() => setShowConfirmPwd((s) => !s)}
                aria-label="顯示/隱藏確認密碼"
              >
                {showConfirmPwd ? '🚫' : '👁️'}
              </button>
            </div>
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? '更新中...' : '更新密碼'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
