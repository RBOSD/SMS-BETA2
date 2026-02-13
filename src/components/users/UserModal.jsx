import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import { validatePasswordFrontend } from '../../utils/helpers';

const ROLE_OPTIONS = [
  { value: 'manager', label: '資料管理者' },
  { value: 'viewer', label: '檢視人員' },
];

export default function UserModal({ open, mode, user, groups, onClose, onSuccess }) {
  const showToast = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [role, setRole] = useState('viewer');
  const [groupIds, setGroupIds] = useState(new Set());

  useEffect(() => {
    if (open) {
      if (mode === 'create') {
        setName('');
        setUsername('');
        setPassword('');
        setPasswordConfirm('');
        setRole('viewer');
        setGroupIds(new Set());
      } else if (user) {
        setName(user.name || '');
        setUsername(user.username || '');
        setPassword('');
        setPasswordConfirm('');
        setRole(user.role || 'viewer');
        setGroupIds(new Set((user.groupIds || []).map((id) => parseInt(id, 10)).filter(Number.isFinite)));
      }
    }
  }, [open, mode, user]);

  const toggleGroup = (gid, checked) => {
    setGroupIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(gid);
      else next.delete(gid);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      showToast('請輸入帳號', 'error');
      return;
    }
    const gids = Array.from(groupIds);
    if (mode === 'create') {
      // 密碼選填：留空則使用預設密碼 Aa123456，使用者首次登入後須自行更改
      if (password) {
        if (password !== passwordConfirm) {
          showToast('密碼與確認密碼不符', 'error');
          return;
        }
        const validation = validatePasswordFrontend(password);
        if (!validation.valid) {
          showToast(validation.message || '密碼不符合規定', 'error');
          return;
        }
      }
      try {
        const payload = {
          username: username.trim(),
          name: name.trim(),
          role,
          groupIds: gids,
        };
        if (password) payload.password = password;
        const res = await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast('新增成功', 'success');
          onClose();
          onSuccess?.();
        } else {
          showToast(j.error || '新增失敗', 'error');
        }
      } catch (e) {
        showToast('新增失敗: ' + (e.message || '連線錯誤'), 'error');
      }
    } else {
      const payload = { name: name.trim(), username: username.trim(), role, groupIds: gids };
      if (password) {
        if (password !== passwordConfirm) {
          showToast('密碼與確認密碼不符', 'error');
          return;
        }
        const validation = validatePasswordFrontend(password);
        if (!validation.valid) {
          showToast(validation.message || '密碼不符合規定', 'error');
          return;
        }
        payload.password = password;
      }
      try {
        const res = await apiFetch('/api/users/' + user.id, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast('更新成功', 'success');
          onClose();
          onSuccess?.();
        } else {
          showToast(j.error || '更新失敗', 'error');
        }
      } catch (e) {
        showToast('更新失敗: ' + (e.message || '連線錯誤'), 'error');
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box">
        <h3 style={{ marginTop: 0 }}>{mode === 'create' ? '新增' : '編輯'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>姓名</label>
            <input type="text" className="filter-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </div>
          <div className="form-group">
            <label>帳號 (Username)</label>
            <input
              type="text"
              className="filter-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              readOnly={mode === 'edit'}
            />
          </div>
          <div className="form-group">
            <label>密碼 {mode === 'create' ? <span style={{ fontWeight: 400, color: '#666', fontSize: 12 }}>(選填，留空則使用預設密碼 Aa123456)</span> : <span style={{ fontWeight: 400, color: '#666', fontSize: 12 }}>(留空不改)</span>}</label>
            <div className="pwd-wrapper">
              <input
                type="password"
                className="filter-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'create' ? 'new-password' : 'off'}
              />
              <button type="button" className="pwd-toggle" onClick={() => {}} aria-label="顯示/隱藏密碼">👁️</button>
            </div>
          </div>
          <div className="form-group">
            <label>確認密碼</label>
            <div className="pwd-wrapper">
              <input
                type="password"
                className="filter-input"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
              />
              <button type="button" className="pwd-toggle" onClick={() => {}} aria-label="顯示/隱藏確認密碼">👁️</button>
            </div>
          </div>
          <div className="form-group">
            <label>權限</label>
            <select className="filter-select" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>適用群組（可多選）</label>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: '#f8fafc', maxHeight: 180, overflow: 'auto' }}>
              {!groups || groups.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 13 }}>尚無群組</div>
              ) : (
                groups.map((g) => (
                  <label
                    key={g.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: groupIds.has(parseInt(g.id, 10)) ? '#eff6ff' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={groupIds.has(parseInt(g.id, 10))}
                      onChange={(e) => toggleGroup(parseInt(g.id, 10), e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 14, color: '#334155' }}>{g.name || '群組 ' + g.id}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>送出</button>
            <button type="button" className="btn btn-outline" style={{ width: '100%' }} onClick={onClose}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}
