/**
 * 使用者新增/編輯 - 全頁表單（與檢查計畫相同方式，避免 modal 閃爍）
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { validatePasswordFrontend } from '../../utils/helpers';

const ROLE_OPTIONS = [
  { value: 'manager', label: '資料管理者' },
  { value: 'viewer', label: '檢視人員' },
];

export default function UserFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action'); // 'new' | 'edit'
  const userId = searchParams.get('id');

  const showToast = useToast();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [role, setRole] = useState('viewer');
  const [groupIds, setGroupIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const isCreate = action === 'new';
  const isEdit = action === 'edit' && userId;

  useEffect(() => {
    if (isEdit && userId) {
      (async () => {
        setLoading(true);
        try {
          const res = await apiFetch('/api/users/' + userId);
          if (res.ok) {
            const j = await res.json();
            const u = j.data || j;
            setUser(u);
          } else {
            showToast('載入使用者失敗', 'error');
            navigate('/users/list');
          }
        } catch (e) {
          showToast('載入失敗', 'error');
          navigate('/users/list');
        } finally {
          setLoading(false);
        }
      })();
    } else if (isCreate) {
      setLoading(false);
    } else {
      navigate('/users/list');
    }
  }, [isEdit, isCreate, userId, navigate, showToast]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setPassword('');
      setPasswordConfirm('');
      setRole(user.role || 'viewer');
      setGroupIds(new Set((user.groupIds || []).map((id) => parseInt(id, 10)).filter(Number.isFinite)));
    } else if (isCreate) {
      setName('');
      setUsername('');
      setPassword('');
      setPasswordConfirm('');
      setRole('viewer');
      setGroupIds(new Set());
    }
  }, [user, isCreate]);

  useEffect(() => {
    if (!isCreate && !isEdit) return;
    const loadGroups = async () => {
      try {
        const res = await apiFetch('/api/groups?_t=' + Date.now());
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.data) {
          const dataGroups = j.data.filter((g) => !(g.is_admin_group === true || g.isAdminGroup === true));
          const myGroupIds = (currentUser?.groupIds || []).map((x) => parseInt(x, 10)).filter(Number.isFinite);
          const allowed = currentUser?.isAdmin === true ? dataGroups : dataGroups.filter((g) => myGroupIds.includes(parseInt(g.id, 10)));
          setGroups(allowed);
        }
      } catch (e) {}
    };
    loadGroups();
  }, [isCreate, isEdit, currentUser]);

  const toggleGroup = (gid, checked) => {
    setGroupIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(gid);
      else next.delete(gid);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!username.trim()) return showToast('請輸入帳號', 'error');
    const gids = Array.from(groupIds);
    if (isCreate) {
      if (password) {
        if (password !== passwordConfirm) return showToast('密碼與確認密碼不符', 'error');
        const validation = validatePasswordFrontend(password);
        if (!validation.valid) return showToast(validation.message || '密碼不符合規定', 'error');
      }
    } else {
      if (password) {
        if (password !== passwordConfirm) return showToast('密碼與確認密碼不符', 'error');
        const validation = validatePasswordFrontend(password);
        if (!validation.valid) return showToast(validation.message || '密碼不符合規定', 'error');
      }
    }

    setSaving(true);
    try {
      if (isCreate) {
        const payload = { username: username.trim(), name: name.trim(), role, groupIds: gids };
        if (password) payload.password = password;
        const res = await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(payload) });
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast('新增成功', 'success');
          navigate('/users/list');
        } else {
          showToast(j.error || '新增失敗', 'error');
        }
      } else {
        const payload = { name: name.trim(), username: username.trim(), role, groupIds: gids };
        if (password) payload.password = password;
        const res = await apiFetch('/api/users/' + userId, { method: 'PUT', body: JSON.stringify(payload) });
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast('更新成功', 'success');
          navigate('/users/list');
        } else {
          showToast(j.error || '更新失敗', 'error');
        }
      }
    } catch (e) {
      showToast('操作失敗: ' + (e.message || '連線錯誤'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="main-card" style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
        載入中...
      </div>
    );
  }

  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 };
  const groupBoxStyle = { border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: '#f8fafc', maxHeight: 180, overflow: 'auto' };

  return (
    <div className="main-card form-card-unified">
      <div className="form-section">
        <div className="form-section-title">帳號資訊</div>
        <div className="form-grid">
          <div className="form-group">
            <label style={labelStyle}>姓名 <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="text" className="filter-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <label style={labelStyle}>帳號 <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="filter-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              readOnly={isEdit}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">密碼設定</div>
        <div className="form-grid">
          <div className="form-group">
            <label style={labelStyle}>密碼 {isCreate ? <span style={{ fontWeight: 400, color: '#64748b', fontSize: 12 }}>(選填)</span> : <span style={{ fontWeight: 400, color: '#64748b', fontSize: 12 }}>(留空不改)</span>}</label>
            <div className="pwd-wrapper">
              <input
                type="password"
                className="filter-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isCreate ? '選填，留空則使用 Aa123456' : ''}
                autoComplete={isCreate ? 'new-password' : 'off'}
                style={{ width: '100%' }}
              />
              <button type="button" className="pwd-toggle" onClick={() => {}} aria-label="顯示/隱藏密碼">👁️</button>
            </div>
          </div>
          <div className="form-group">
            <label style={labelStyle}>確認密碼</label>
            <div className="pwd-wrapper">
              <input
                type="password"
                className="filter-input"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                style={{ width: '100%' }}
              />
              <button type="button" className="pwd-toggle" onClick={() => {}} aria-label="顯示/隱藏確認密碼">👁️</button>
            </div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">權限與群組</div>
        <div className="form-grid">
          <div className="form-group">
            <label style={labelStyle}>權限</label>
            <select className="filter-select" value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%' }}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>適用群組（可多選）</label>
            <div style={groupBoxStyle}>
              {groups.length === 0 ? (
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
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? '儲存中...' : '儲存'}
        </button>
        <button className="btn btn-outline" onClick={() => navigate('/users/list')}>
          取消
        </button>
      </div>
    </div>
  );
}
