/**
 * 檢查計畫新增/編輯 Modal
 */
import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const RAILWAY_OPTIONS = [
  { value: '', label: '請選擇' },
  { value: 'T', label: '臺鐵' },
  { value: 'H', label: '高鐵' },
  { value: 'A', label: '林鐵' },
  { value: 'S', label: '糖鐵' },
];

const INSPECTION_OPTIONS = [
  { value: '', label: '請選擇' },
  { value: '1', label: '年度定期檢查' },
  { value: '2', label: '特別檢查' },
  { value: '3', label: '例行性檢查' },
  { value: '4', label: '臨時檢查' },
];

const BUSINESS_OPTIONS = [
  { value: '', label: '請選擇' },
  { value: 'OP', label: '運轉' },
  { value: 'CV', label: '土建' },
  { value: 'ME', label: '機務' },
  { value: 'EL', label: '電務' },
  { value: 'SM', label: '安全管理' },
  { value: 'AD', label: '營運／災防審核' },
  { value: 'OT', label: '其他／產管規劃' },
];

export default function PlanModal({ open, mode, planId, plan, onClose, onSuccess }) {
  const showToast = useToast();
  const { user: currentUser } = useAuth();
  const [groups, setGroups] = useState([]);
  const [ownerGroupIds, setOwnerGroupIds] = useState([]);
  const [year, setYear] = useState('');
  const [name, setName] = useState('');
  const [railway, setRailway] = useState('');
  const [inspectionType, setInspectionType] = useState('');
  const [business, setBusiness] = useState('');
  const [plannedCount, setPlannedCount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const loadGroups = async () => {
      try {
        const res = await fetch('/api/groups?_t=' + Date.now(), { credentials: 'include' });
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
  }, [open, currentUser]);

  useEffect(() => {
    if (mode === 'edit' && plan) {
      setYear(plan.year || '');
      setName(plan.name || '');
      setRailway(plan.railway || '');
      setInspectionType(plan.inspection_type || '');
      setBusiness(plan.business || '');
      setPlannedCount(plan.planned_count != null ? String(plan.planned_count) : '');
      const gids = plan.owner_group_ids || plan.ownerGroupIds || [];
      setOwnerGroupIds(gids.map((x) => parseInt(x, 10)).filter(Number.isFinite));
    } else {
      setYear('');
      setName('');
      setRailway('');
      setInspectionType('');
      setBusiness('');
      setPlannedCount('');
      setOwnerGroupIds([]);
    }
  }, [mode, plan]);

  const toggleGroup = (gid) => {
    const id = parseInt(gid, 10);
    setOwnerGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (!name?.trim()) return showToast('請填寫計畫名稱', 'error');
    if (!year?.trim()) return showToast('請填寫年度', 'error');
    if (mode === 'create') {
      if (!railway) return showToast('請選擇鐵路機構', 'error');
      if (!inspectionType) return showToast('請選擇檢查類別', 'error');
      if (ownerGroupIds.length === 0) return showToast('請至少選擇一個適用群組', 'error');
    }
    const pc = plannedCount !== '' ? parseInt(plannedCount, 10) : null;
    if (pc != null && (isNaN(pc) || pc < 0)) return showToast('規劃檢查次數需為大於等於 0 的數字', 'error');

    setSaving(true);
    try {
      if (mode === 'create') {
        const res = await apiFetch('/api/plans', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            year: year.trim(),
            railway,
            inspection_type: inspectionType,
            business: business || null,
            planned_count: pc,
            ownerGroupIds,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast('新增成功', 'success');
          onClose();
          onSuccess?.();
        } else {
          showToast(j.error || '新增失敗', 'error');
        }
      } else {
        const res = await apiFetch('/api/plans/' + planId, {
          method: 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            year: year.trim(),
            business: business || null,
            planned_count: pc,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast('儲存成功', 'success');
          onClose();
          onSuccess?.();
        } else {
          showToast(j.error || '儲存失敗', 'error');
        }
      }
    } catch (e) {
      showToast('操作失敗: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" style={{ display: 'flex', zIndex: 10000 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box plan-edit-modal" style={{ maxWidth: 600, width: '95%' }}>
        <div className="plan-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>{mode === 'create' ? '新增檢查計畫' : '編輯檢查計畫'}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, color: '#64748b', cursor: 'pointer' }} aria-label="關閉">
            ×
          </button>
        </div>
        <div className="plan-modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label>年度（民國） <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" className="filter-input" placeholder="例如: 113" value={year} onChange={(e) => setYear(e.target.value)} disabled={mode === 'edit'} />
            </div>
            <div className="form-group">
              <label>計畫名稱 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" className="filter-input" placeholder="例如: 上半年定期檢查" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>適用群組（可多選）<span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', padding: '10px 0' }}>
              {groups.map((g) => (
                <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={ownerGroupIds.includes(parseInt(g.id, 10))} onChange={() => toggleGroup(g.id)} disabled={mode === 'edit'} />
                  <span>{g.name || '群組 ' + g.id}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label>鐵路機構 <span style={{ color: '#ef4444' }}>*</span></label>
              <select className="filter-select" value={railway} onChange={(e) => setRailway(e.target.value)} disabled={mode === 'edit'}>
                {RAILWAY_OPTIONS.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>檢查類別 <span style={{ color: '#ef4444' }}>*</span></label>
              <select className="filter-select" value={inspectionType} onChange={(e) => setInspectionType(e.target.value)} disabled={mode === 'edit'}>
                {INSPECTION_OPTIONS.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label>業務類型</label>
              <select className="filter-select" value={business} onChange={(e) => setBusiness(e.target.value)}>
                {BUSINESS_OPTIONS.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>規劃檢查幾次</label>
              <input type="number" className="filter-input" min={0} placeholder="僅填數字" value={plannedCount} onChange={(e) => setPlannedCount(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="plan-modal-footer" style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? '儲存中...' : '儲存'}
          </button>
          <button className="btn btn-outline" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
