import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../api/api';
import { validatePasswordFrontend } from '../../utils/helpers';

/** @param {Object} props
 *  @param {boolean} props.open - 是否顯示
 *  @param {() => void} [props.onSuccess] - 成功回調
 *  @param {'firstLogin'|'personal'} [props.mode] - firstLogin=首次登入強制修改, personal=個人設定自願修改
 */
export default function ChangePasswordModal({ open, onSuccess, mode = 'firstLogin' }) {
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const showToast = useToast();
  const isPersonal = mode === 'personal';

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
        showToast(isPersonal ? '密碼已更新' : '密碼更新成功，請重新登入', 'success');
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
    <div className="modal-overlay" style={{ display: 'flex', zIndex: 10000 }} onClick={(e) => isPersonal && e.target === e.currentTarget && onSuccess?.()}>
      <div className="modal-box" style={{ maxWidth: 500, width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: isPersonal ? '#1e293b' : '#dc2626' }}>
          {isPersonal ? '⚙️ 修改密碼' : '⚠️ 首次登入，請更新密碼'}
        </h3>
        <div style={{ background: isPersonal ? '#f8fafc' : '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 20, border: `1px solid ${isPersonal ? '#e2e8f0' : '#fecaca'}` }}>
          <div style={{ fontSize: 14, color: isPersonal ? '#475569' : '#991b1b' }}>
            {isPersonal ? '請設定新密碼。密碼必須符合以下要求：' : '為了您的帳號安全，請設定一個新的密碼。密碼必須符合以下要求：'}
          </div>
          <ul style={{ margin: '8px 0 0 20px', fontSize: 13, color: isPersonal ? '#64748b' : '#7f1d1d' }}>
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
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, minWidth: 120 }} disabled={loading}>
              {loading ? '更新中...' : '更新密碼'}
            </button>
            {isPersonal && (
              <button type="button" className="btn btn-outline" onClick={onSuccess} disabled={loading}>
                取消
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
