import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';

export default function GroupRenameModal({ open, groupId, groupName, onClose, onSuccess }) {
  const showToast = useToast();
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      setName(groupName || '');
    }
  }, [open, groupId, groupName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('群組名稱不可為空', 'error');
      return;
    }
    try {
      const res = await apiFetch('/api/groups/' + groupId, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('更新群組成功', 'success');
        onClose();
        onSuccess?.();
      } else {
        showToast(j.error || '更新群組失敗', 'error');
      }
    } catch (e) {
      showToast('更新群組失敗: ' + e.message, 'error');
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <h3 style={{ marginTop: 0 }}>群組更名</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>群組名稱</label>
            <input type="text" className="filter-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>儲存</button>
            <button type="button" className="btn btn-outline" style={{ width: '100%' }} onClick={onClose}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}
