import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { escapeHtml } from '../../utils/helpers';
import ConfirmModal from '../../components/common/ConfirmModal';
import PaginationBar from '../../components/users/PaginationBar';
import GroupRenameModal from '../../components/users/GroupRenameModal';
import UserImportModal from '../../components/users/UserImportModal';

const ROLE_NAMES = { manager: '資料管理者', viewer: '檢視人員' };

export default function UsersTab() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const showToast = useToast();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [groupRenameOpen, setGroupRenameOpen] = useState(false);
  const [groupRenameId, setGroupRenameId] = useState(null);
  const [groupRenameName, setGroupRenameName] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({});
  const newGroupNameRef = useRef(null);

  const loadUsers = useCallback(async (pageNum = 1) => {
    try {
      const params = new URLSearchParams({
        page: pageNum,
        pageSize,
        q: search,
        sortField,
        sortDir,
        _t: Date.now(),
      });
      const res = await apiFetch('/api/users?' + params.toString());
      if (!res.ok) {
        showToast('載入使用者失敗', 'error');
        return;
      }
      const j = await res.json();
      setUsers(j.data || []);
      setTotal(j.total || 0);
      setPages(j.pages || 1);
      setPage(j.page || 1);
    } catch (e) {
      showToast('載入使用者錯誤', 'error');
    }
  }, [pageSize, search, sortField, sortDir, showToast]);

  const loadGroups = useCallback(async () => {
    try {
      const res = await apiFetch('/api/groups?_t=' + Date.now());
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.data) {
        setGroups(j.data);
        if (!selectedGroupId && j.data.length > 0) {
          setSelectedGroupId(j.data[0].id);
        }
      }
    } catch (e) {
      showToast('載入群組失敗', 'error');
    }
  }, [selectedGroupId]);

  const loadAllUsers = useCallback(async (force = false) => {
    try {
      const params = new URLSearchParams({ page: 1, pageSize: 10000, q: '', sortField: 'id', sortDir: 'asc', _t: Date.now() });
      const res = await apiFetch('/api/users?' + params.toString());
      if (!res.ok) throw new Error('載入失敗');
      const j = await res.json();
      setAllUsers(j.data || []);
      return j.data || [];
    } catch (e) {
      return [];
    }
  }, []);

  useEffect(() => {
    loadUsers(page);
  }, [loadUsers, page]);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) loadAllUsers();
  }, [selectedGroupId]);

  const handleSort = (field) => {
    setSortDir((prev) => (sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortField(field);
    setPage(1);
  };

  const openUserCreate = () => {
    navigate('/users/list?action=new');
  };

  const openUserEdit = (u) => {
    navigate('/users/list?action=edit&id=' + u.id);
  };

  const toggleUserDisable = async (u) => {
    const action = u.isDisabled === true ? '啟用' : '停用';
    setConfirmConfig({
      message: `確定要${action}此帳號嗎？`,
      confirmText: `確定${action}`,
      onConfirm: async () => {
        try {
          const res = await apiFetch('/api/users/' + u.id + '/disable', { method: 'PATCH' });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            showToast(`${action}成功`, 'success');
            loadUsers(page);
          } else showToast(data.error || `${action}失敗`, 'error');
        } catch (e) {
          showToast('連線錯誤', 'error');
        }
        setConfirmOpen(false);
      },
      onCancel: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

  const deleteUser = async (u) => {
    setConfirmConfig({
      message: '確定要刪除此帳號嗎？\n\n此操作無法復原！',
      confirmText: '確定刪除',
      onConfirm: async () => {
        try {
          const res = await apiFetch('/api/users/' + u.id, { method: 'DELETE' });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            showToast('刪除成功', 'success');
            loadUsers(1);
          } else showToast(data.error || '刪除失敗', 'error');
        } catch (e) {
          showToast('刪除失敗: ' + e.message, 'error');
        }
        setConfirmOpen(false);
      },
      onCancel: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

  const resetUserPassword = async (u) => {
    const info = (u.name || '-') + '（' + (u.username || '-') + '）';
    setConfirmConfig({
      message: `確定要將使用者「${info}」的密碼重置為初始密碼 Aa123456 嗎？\n\n該使用者下次登入時須修改密碼。`,
      confirmText: '確定重置',
      onConfirm: async () => {
        try {
          const res = await apiFetch('/api/admin/users/' + u.id + '/reset-password', { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          if (res.ok) showToast('密碼已重置為 Aa123456', 'success');
          else showToast(data.error || '重置失敗', 'error');
        } catch (e) {
          showToast('重置失敗: ' + e.message, 'error');
        }
        setConfirmOpen(false);
      },
      onCancel: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

  const createGroup = async () => {
    const name = newGroupNameRef.current?.value?.trim();
    if (!name) {
      showToast('請輸入群組名稱', 'error');
      return;
    }
    try {
      const res = await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('新增群組成功', 'success');
        if (newGroupNameRef.current) newGroupNameRef.current.value = '';
        loadGroups();
      } else showToast(j.error || '新增群組失敗', 'error');
    } catch (e) {
      showToast('新增群組失敗: ' + e.message, 'error');
    }
  };

  const deleteGroup = async () => {
    const g = groups.find((x) => parseInt(x.id, 10) === parseInt(selectedGroupId, 10));
    if (!g) return showToast('請先選擇群組', 'error');
    if (g.is_admin_group === true || g.isAdminGroup === true) return showToast('無法刪除系統管理群組', 'error');
    setConfirmConfig({
      message: `確定要刪除群組「${escapeHtml(g.name || '')}」嗎？\n\n此操作無法復原。`,
      confirmText: '確定刪除',
      onConfirm: async () => {
        try {
          const res = await apiFetch('/api/groups/' + selectedGroupId, { method: 'DELETE' });
          const j = await res.json().catch(() => ({}));
          if (res.ok) {
            showToast('刪除成功', 'success');
            setSelectedGroupId(null);
            loadGroups();
            loadUsers(page);
          } else showToast(j.error || '刪除失敗', 'error');
        } catch (e) {
          showToast('刪除失敗: ' + e.message, 'error');
        }
        setConfirmOpen(false);
      },
      onCancel: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

  const openRenameGroup = () => {
    const g = groups.find((x) => parseInt(x.id, 10) === parseInt(selectedGroupId, 10));
    if (!g) return showToast('請先選擇群組', 'error');
    setGroupRenameId(selectedGroupId);
    setGroupRenameName(g.name || '');
    setGroupRenameOpen(true);
  };

  const toggleUserInGroup = async (userId, checked) => {
    const gid = parseInt(selectedGroupId, 10);
    if (!gid) return showToast('請先選擇群組', 'error');
    const u = allUsers.find((x) => parseInt(x.id, 10) === parseInt(userId, 10));
    if (!u) return showToast('找不到使用者', 'error');
    const cur = Array.isArray(u.groupIds) ? u.groupIds.map((x) => parseInt(x, 10)).filter(Number.isFinite) : [];
    const next = checked ? [...new Set([...cur, gid])] : cur.filter((x) => x !== gid);
    try {
      const res = await apiFetch('/api/users/' + u.id, {
        method: 'PUT',
        body: JSON.stringify({ name: u.name, role: u.role, groupIds: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        loadAllUsers(true);
        loadUsers(page);
      } else showToast(j.error || '更新失敗', 'error');
    } catch (e) {
      showToast('更新失敗: ' + e.message, 'error');
    }
  };

  const selectedGroup = groups.find((g) => parseInt(g.id, 10) === parseInt(selectedGroupId, 10));
  const filteredMembers = allUsers.filter((u) => {
    if (!groupSearch) return true;
    const hay = ((u.name || '') + ' ' + (u.username || '')).toLowerCase();
    return hay.includes(groupSearch.toLowerCase());
  });

  return (
    <div className="main-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
            在同一頁面完成帳號、權限與群組管理。群組用於資料的「同群組可編輯」控管。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button className="btn btn-primary" onClick={openUserCreate}>➕ 新增使用者</button>
          <button className="btn btn-outline" onClick={() => setImportModalOpen(true)}>📥 整批匯入</button>
        </div>
      </div>

      <div className="admin-users-layout" id="adminUsersLayout">
        <div className="detail-card admin-users-left" style={{ margin: 0, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ fontWeight: 800, color: '#334155', fontSize: 16 }}>👤 使用者列表</div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>可編輯姓名、帳號、權限與群組隸屬。</div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', minWidth: 300, justifyContent: 'flex-end', flex: 1 }}>
              <input
                className="filter-input"
                placeholder="搜尋姓名、帳號..."
                style={{ maxWidth: 320 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (setPage(1), loadUsers(1))}
              />
              <select className="page-size-select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); loadUsers(1); }} style={{ width: 130 }}>
                <option value={10}>10 筆/頁</option>
                <option value={20}>20 筆/頁</option>
                <option value={50}>50 筆/頁</option>
              </select>
              <button className="btn btn-outline" onClick={() => loadUsers(1)}>搜尋</button>
            </div>
          </div>
          <div className="pagination-bar" style={{ padding: '12px 0 8px', justifyContent: 'flex-end' }}>
            <PaginationBar page={page} pages={pages} onPageChange={setPage} />
          </div>
          <div className="data-container">
            <table className="user-table">
              <thead>
                <tr>
                  <th style={{ padding: 16 }} onClick={() => handleSort('name')}>姓名</th>
                  <th onClick={() => handleSort('username')}>帳號</th>
                  <th style={{ minWidth: 220 }}>適用群組</th>
                  <th onClick={() => handleSort('role')}>權限</th>
                  <th onClick={() => handleSort('created_at')}>註冊時間</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const gids = Array.isArray(u.groupIds) ? u.groupIds : [];
                  const groupsMap = new Map(groups.map((g) => [parseInt(g.id, 10), g.name]));
                  const groupNames = gids.map((id) => groupsMap.get(parseInt(id, 10)) || '#' + id);
                  const myId = currentUser?.id;
                  const isSelf = myId && u.id === myId;
                  return (
                    <tr key={u.id} className={u.isDisabled === true ? 'user-row-disabled' : ''}>
                      <td data-label="姓名" style={{ padding: 12 }}>{escapeHtml(u.name || '-')}</td>
                      <td data-label="帳號">
                        {escapeHtml(u.username || '-')}
                        {u.isDisabled === true && (
                          <span className="badge" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontWeight: 700, marginLeft: 4 }}>已停用</span>
                        )}
                      </td>
                      <td data-label="群組" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 8px' }}>
                        {groupNames.length > 0
                          ? groupNames.map((n) => (
                              <span key={n} className="badge" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 700 }}>{escapeHtml(n)}</span>
                            ))
                          : <span style={{ color: '#94a3b8' }}>-</span>}
                      </td>
                      <td data-label="權限">{u.isAdmin === true ? '系統管理員' : ROLE_NAMES[u.role] || u.role || ''}</td>
                      <td data-label="註冊時間">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                      <td data-label="操作">
                        {isSelf ? '-' : (
                          <>
                            <button className="btn btn-outline" style={{ padding: '2px 6px', marginRight: 4 }} onClick={() => openUserEdit(u)} title="編輯">✏️</button>
                            <button className="btn btn-outline" style={{ padding: '2px 6px', marginRight: 4, fontSize: 12 }} onClick={() => toggleUserDisable(u)} title={u.isDisabled ? '啟用' : '停用'}>{u.isDisabled ? '啟用' : '停用'}</button>
                            <button className="btn btn-outline" style={{ padding: '2px 6px', marginRight: 4 }} onClick={() => resetUserPassword(u)} title="重置密碼">🔑</button>
                            <button className="btn btn-danger" style={{ padding: '2px 6px' }} onClick={() => deleteUser(u)} title="刪除">🗑️</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination-bar" style={{ padding: '12px 0 0', justifyContent: 'center' }}>
            <PaginationBar page={page} pages={pages} onPageChange={setPage} />
          </div>
        </div>

        <div className="detail-card admin-users-right" style={{ margin: 0, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 800, color: '#334155', fontSize: 16 }}>👥 適用群組</div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>點選群組後可新增/移除成員，或點「更名」修改群組名稱。</div>
            </div>
          </div>
          <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 12, background: '#ffffff', padding: 12 }}>
            <div style={{ fontWeight: 800, color: '#334155', fontSize: 13, marginBottom: 8 }}>新增適用群組</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input ref={newGroupNameRef} className="filter-input" placeholder="例如：工務組" style={{ flex: 1, minWidth: 220 }} onKeyDown={(e) => e.key === 'Enter' && createGroup()} />
              <button className="btn btn-primary btn-sm" onClick={createGroup}>➕ 建立</button>
            </div>
          </div>
          <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: '#ffffff' }}>
            <div style={{ padding: '10px 12px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 800, color: '#334155', fontSize: 13 }}>適用群組清單</div>
              <button className="btn btn-outline btn-sm" onClick={loadGroups} title="重新載入">⟳ 刷新</button>
            </div>
            <div style={{ maxHeight: 'var(--groups-list-max, 240px)', overflow: 'auto' }}>
              {groups.length === 0 ? (
                <div style={{ padding: 12, color: '#64748b', fontSize: 13 }}>尚無群組</div>
              ) : (
                groups.map((g) => {
                  const active = selectedGroupId != null && parseInt(g.id, 10) === parseInt(selectedGroupId, 10);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGroupId(g.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        background: active ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        padding: '10px 12px',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <span style={{ fontWeight: 800, color: active ? '#1d4ed8' : '#334155', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📁 {g.name || '群組 ' + g.id}</span>
                      <span className="badge" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}>ID {g.id}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: '#ffffff' }}>
            <div style={{ padding: '10px 12px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#334155', fontSize: 13 }}>所選群組</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{selectedGroup ? (selectedGroup.name || '群組 ' + selectedGroup.id) : '（請先選擇群組）'}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={openRenameGroup} title="更名">✏️ 更名</button>
              {selectedGroup && !(selectedGroup.is_admin_group || selectedGroup.isAdminGroup) && (
                <button className="btn btn-outline btn-sm" style={{ color: '#dc2626', borderColor: '#dc2626' }} onClick={deleteGroup} title="刪除">🗑️ 刪除</button>
              )}
            </div>
            <div style={{ padding: 12 }}>
              <input
                className="filter-input"
                placeholder="搜尋使用者（姓名/帳號）..."
                style={{ flex: 1, minWidth: 200, marginBottom: 10 }}
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
              />
              <div style={{ maxHeight: 'var(--group-members-max, 320px)', overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 8, background: '#f8fafc' }}>
                {!selectedGroupId ? (
                  <div style={{ padding: 8, color: '#64748b', fontSize: 13 }}>請先選擇群組</div>
                ) : filteredMembers.length === 0 ? (
                  <div style={{ padding: 8, color: '#64748b', fontSize: 13 }}>查無使用者</div>
                ) : (
                  filteredMembers.map((u) => {
                    const member = Array.isArray(u.groupIds) && u.groupIds.map((x) => parseInt(x, 10)).includes(parseInt(selectedGroupId, 10));
                    return (
                      <label
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: member ? '#eff6ff' : '#ffffff',
                          border: `1px solid ${member ? '#bfdbfe' : '#e2e8f0'}`,
                          marginBottom: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!member}
                          onChange={(e) => toggleUserInGroup(u.id, e.target.checked)}
                          style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: '#334155', fontSize: 13 }}>{escapeHtml(u.name || u.username || '-')}</div>
                          <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{escapeHtml(u.username || '-')} · {u.isAdmin ? '系統管理員' : ROLE_NAMES[u.role] || u.role || ''}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <GroupRenameModal open={groupRenameOpen} groupId={groupRenameId} groupName={groupRenameName} onClose={() => setGroupRenameOpen(false)} onSuccess={() => { loadGroups(); loadUsers(page); }} />
      <UserImportModal open={importModalOpen} onClose={() => setImportModalOpen(false)} onSuccess={() => loadUsers(1)} />
      <ConfirmModal open={confirmOpen} message={confirmConfig.message} confirmText={confirmConfig.confirmText} onConfirm={confirmConfig.onConfirm} onCancel={confirmConfig.onCancel} />
    </div>
  );
}
