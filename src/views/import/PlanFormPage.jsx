/**
 * 檢查計畫新增/編輯 - 全頁表單（避免 modal 互動問題）
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

export default function PlanFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action'); // 'new' | 'edit'
  const planId = searchParams.get('id');

  const showToast = useToast();
  const { user: currentUser } = useAuth();
  const [plan, setPlan] = useState(null);
  const [groups, setGroups] = useState([]);
  const [ownerGroupIds, setOwnerGroupIds] = useState([]);
  const [year, setYear] = useState('');
  const [name, setName] = useState('');
  const [railway, setRailway] = useState('');
  const [inspectionType, setInspectionType] = useState('');
  const [business, setBusiness] = useState('');
  const [plannedCount, setPlannedCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const isCreate = action === 'new';
  const isEdit = action === 'edit' && planId;

  useEffect(() => {
    if (isEdit && planId) {
      (async () => {
        setLoading(true);
        try {
          const res = await apiFetch('/api/plans/' + planId);
          if (res.ok) {
            const j = await res.json();
            setPlan(j.data || j);
          } else {
            showToast('載入計畫失敗', 'error');
            navigate('/import/manage');
          }
        } catch (e) {
          showToast('載入失敗', 'error');
          navigate('/import/manage');
        } finally {
          setLoading(false);
        }
      })();
    } else if (isCreate) {
      setLoading(false);
    } else {
      navigate('/import/manage');
    }
  }, [isEdit, isCreate, planId, navigate, showToast]);

  useEffect(() => {
    if (!isCreate && !plan) return;
    if (plan) {
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
  }, [plan, isCreate]);

  useEffect(() => {
    if (!isCreate && !isEdit) return;
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
  }, [isCreate, isEdit, currentUser]);

  const toggleGroup = (gid) => {
    const id = parseInt(gid, 10);
    setOwnerGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (!name?.trim()) return showToast('請填寫計畫名稱', 'error');
    if (!year?.trim()) return showToast('請填寫年度', 'error');
    if (isCreate) {
      if (!railway) return showToast('請選擇鐵路機構', 'error');
      if (!inspectionType) return showToast('請選擇檢查類別', 'error');
      if (ownerGroupIds.length === 0) return showToast('請至少選擇一個適用群組', 'error');
    }
    const pc = plannedCount !== '' ? parseInt(plannedCount, 10) : null;
    if (pc != null && (isNaN(pc) || pc < 0)) return showToast('規劃檢查次數需為大於等於 0 的數字', 'error');

    setSaving(true);
    try {
      if (isCreate) {
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
          navigate('/import/manage');
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
          navigate('/import/manage');
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
      {/* 基本資訊 */}
      <div className="form-section">
        <div className="form-section-title">基本資訊</div>
        <div className="form-grid">
          <div className="form-group">
            <label style={labelStyle}>年度（民國） <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="filter-input"
              placeholder="例如: 113"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={isEdit}
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-group">
            <label style={labelStyle}>計畫名稱 <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="filter-input"
              placeholder="例如: 上半年定期檢查"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* 適用群組 */}
      <div className="form-section">
        <div className="form-section-title">適用群組（可多選）<span style={{ color: '#ef4444' }}>*</span></div>
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
                  cursor: isEdit ? 'default' : 'pointer',
                  background: ownerGroupIds.includes(parseInt(g.id, 10)) ? '#eff6ff' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={ownerGroupIds.includes(parseInt(g.id, 10))}
                  onChange={() => toggleGroup(g.id)}
                  disabled={isEdit}
                  style={{ width: 16, height: 16, cursor: isEdit ? 'default' : 'pointer' }}
                />
                <span style={{ fontSize: 14, color: '#334155' }}>{g.name || '群組 ' + g.id}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* 檢查設定 */}
      <div className="form-section">
        <div className="form-section-title">檢查設定</div>
        <div className="form-grid">
          <div className="form-group">
            <label style={labelStyle}>鐵路機構 <span style={{ color: '#ef4444' }}>*</span></label>
            <select
              className="filter-select"
              value={railway}
              onChange={(e) => setRailway(e.target.value)}
              disabled={isEdit}
              style={{ width: '100%' }}
            >
              {RAILWAY_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label style={labelStyle}>檢查類別 <span style={{ color: '#ef4444' }}>*</span></label>
            <select
              className="filter-select"
              value={inspectionType}
              onChange={(e) => setInspectionType(e.target.value)}
              disabled={isEdit}
              style={{ width: '100%' }}
            >
              {INSPECTION_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label style={labelStyle}>業務類型</label>
            <select className="filter-select" value={business} onChange={(e) => setBusiness(e.target.value)} style={{ width: '100%' }}>
              {BUSINESS_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label style={labelStyle}>規劃檢查幾次</label>
            <input
              type="number"
              className="filter-input"
              min={0}
              placeholder="僅填數字"
              value={plannedCount}
              onChange={(e) => setPlannedCount(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? '儲存中...' : '儲存'}
        </button>
        <button className="btn btn-outline" onClick={() => navigate('/import/manage')}>
          取消
        </button>
      </div>
    </div>
  );
}
