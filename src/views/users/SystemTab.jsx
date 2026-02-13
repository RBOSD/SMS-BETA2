import { useState } from 'react';
import { apiFetch } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

function arrayBufferToBase64(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default function SystemTab() {
  const { user } = useAuth();
  const showToast = useToast();
  const [exportDataType, setExportDataType] = useState('issues');
  const [exportScope, setExportScope] = useState('latest');
  const [exportFormat, setExportFormat] = useState('excel');
  const planTemplateRef = useState(null)[0];
  const userTemplateRef = useState(null)[0];

  const isAdmin = user?.isAdmin === true;

  const downloadPlanTemplate = async () => {
    try {
      const res = await fetch('/api/templates/plans-import-xlsx?t=' + Date.now(), { credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        const cd = res.headers.get('content-disposition') || '';
        let filename = '檢查計畫匯入範例.xlsx';
        const m = cd.match(/filename\*\=UTF-8''([^;]+)/i);
        if (m && m[1]) filename = decodeURIComponent(m[1]);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('下載完成', 'success');
      } else {
        showToast('範例檔尚未設定', 'error');
      }
    } catch (e) {
      showToast('下載失敗', 'error');
    }
  };

  const uploadPlanTemplate = async () => {
    const input = document.getElementById('planTemplateFile');
    if (!input) return;
    const file = input.files?.[0];
    if (!file) {
      showToast('請選擇檔案', 'error');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const dataBase64 = arrayBufferToBase64(buf);
      const res = await apiFetch('/api/templates/plans-import-xlsx', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name || '檢查計畫匯入範例.xlsx', dataBase64 }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('已設為檢查計畫匯入範例檔', 'success');
      } else showToast(j.error || '上傳失敗', 'error');
    } catch (e) {
      showToast('上傳失敗: ' + (e.message || ''), 'error');
    }
    input.value = '';
  };

  const downloadUserTemplate = async () => {
    try {
      const res = await fetch('/api/templates/users-import-csv?t=' + Date.now(), { credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        const cd = res.headers.get('content-disposition') || '';
        let filename = '帳號匯入範例.csv';
        const m = cd.match(/filename\*\=UTF-8''([^;]+)/i);
        if (m && m[1]) filename = decodeURIComponent(m[1]);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('下載完成', 'success');
      } else {
        const csv = '\uFEFF姓名,帳號,權限,密碼\n張三,zhang@example.com,manager,password123\n李四,li@example.com,viewer,';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = '帳號匯入範例.csv';
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('下載預設範例完成', 'success');
      }
    } catch (e) {
      showToast('下載失敗', 'error');
    }
  };

  const uploadUserTemplate = async () => {
    const input = document.getElementById('userTemplateFile');
    if (!input) return;
    const file = input.files?.[0];
    if (!file) {
      showToast('請選擇檔案', 'error');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const dataBase64 = arrayBufferToBase64(buf);
      const res = await apiFetch('/api/templates/users-import-csv', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name || '帳號匯入範例.csv', dataBase64 }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('已設為帳號匯入範例檔', 'success');
      } else showToast(j.error || '上傳失敗', 'error');
    } catch (e) {
      showToast('上傳失敗: ' + (e.message || ''), 'error');
    }
    input.value = '';
  };

  const handleExport = async () => {
    showToast('準備匯出中，請稍候...', 'info');
    try {
      let issuesData = [];
      let planSchedulesData = [];
      let usersData = [];

      if (exportDataType === 'issues' || exportDataType === 'both') {
        const res = await fetch('/api/issues?page=1&pageSize=10000&sortField=created_at&sortDir=desc', { credentials: 'include' });
        if (!res.ok) throw new Error('取得開立事項資料失敗');
        const json = await res.json();
        issuesData = json.data || [];
      }
      if (exportDataType === 'users') {
        const res = await fetch('/api/users?page=1&pageSize=10000', { credentials: 'include' });
        if (!res.ok) throw new Error('取得帳號資料失敗');
        const json = await res.json();
        usersData = json.data || [];
      }
      if (exportDataType === 'plans' || exportDataType === 'both') {
        const res = await fetch('/api/plan-schedule/all', { credentials: 'include' });
        if (!res.ok) throw new Error('取得檢查計畫資料失敗');
        const json = await res.json();
        planSchedulesData = json.data || [];
      }

      if (exportDataType === 'issues' && issuesData.length === 0) return showToast('無開立事項資料可匯出', 'error');
      if (exportDataType === 'users' && usersData.length === 0) return showToast('無帳號資料可匯出', 'error');
      if (exportDataType === 'plans' && planSchedulesData.length === 0) return showToast('無檢查計畫資料可匯出', 'error');
      if (exportDataType === 'both' && issuesData.length === 0 && planSchedulesData.length === 0) return showToast('無資料可匯出', 'error');

      if (exportFormat === 'json') {
        const exportData = {};
        if (exportDataType === 'issues' || exportDataType === 'both') exportData.issues = issuesData;
        if (exportDataType === 'plans' || exportDataType === 'both') exportData.plans = planSchedulesData;
        if (exportDataType === 'users') exportData.users = usersData;
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const label = exportDataType === 'issues' ? 'Issues' : exportDataType === 'plans' ? 'Plans' : exportDataType === 'users' ? 'Users' : 'All';
        link.download = `SMS_Backup_${label}_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('JSON 匯出完成', 'success');
      } else {
        showToast('Excel 匯出請改用 JSON 格式，或使用嵌入版', 'info');
      }
    } catch (e) {
      showToast('匯出失敗: ' + (e.message || ''), 'error');
    }
  };

  return (
    <div className="main-card">
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: 18, color: '#334155' }}>系統維護</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
          提供系統資料匯出、匯入範例檔管理。
        </p>
      </div>

      <div className="detail-card" style={{ marginBottom: 30 }}>
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#334155', fontSize: 16 }}>📄 匯入範例檔管理</h4>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>可上傳並設為系統範例檔；未設定時會使用系統預設範例。</p>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280, border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, color: '#334155', marginBottom: 10 }}>檢查計畫（Excel）</div>
            <input type="file" id="planTemplateFile" accept=".xlsx" style={{ display: 'none' }} onChange={() => uploadPlanTemplate()} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={downloadPlanTemplate}>📥 下載 Excel 範例</button>
              <button className="btn btn-primary" onClick={() => document.getElementById('planTemplateFile')?.click()}>📤 上傳並設為範例</button>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 280, border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, color: '#334155', marginBottom: 10 }}>帳號（CSV）</div>
            <input type="file" id="userTemplateFile" accept=".csv" style={{ display: 'none' }} onChange={() => uploadUserTemplate()} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={downloadUserTemplate}>📥 下載匯入範例</button>
              <button className="btn btn-primary" onClick={() => document.getElementById('userTemplateFile')?.click()}>📤 上傳並設為範例</button>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-card" style={{ marginBottom: 30 }}>
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#334155', fontSize: 16 }}>📤 系統資料匯出</h4>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>將系統中的資料匯出為 JSON 格式（適合備份與還原）。</p>
        </div>
        <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>1</div>
            <label style={{ fontWeight: 600, color: '#475569', fontSize: 14, margin: 0 }}>選擇匯出資料類型</label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginLeft: 36 }}>
            {[
              { value: 'issues', label: '僅匯出開立事項', sub: '匯出所有開立事項的資料' },
              { value: 'plans', label: '僅匯出檢查計畫', sub: '匯出所有檢查計畫的資料' },
              { value: 'both', label: '匯出開立事項與檢查計畫（合併）', sub: '同時匯出開立事項和檢查計畫' },
              { value: 'users', label: '僅匯出帳號', sub: '匯出系統帳號（不含密碼）' },
            ].map((opt) => (
              <label key={opt.value} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'white', borderRadius: 8, border: `2px solid ${exportDataType === opt.value ? '#2563eb' : '#e2e8f0'}` }}>
                <input type="radio" name="exportDataType" value={opt.value} checked={exportDataType === opt.value} onChange={() => setExportDataType(opt.value)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{opt.sub}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        {(exportDataType === 'issues' || exportDataType === 'both') && (
          <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 20, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>2</div>
              <label style={{ fontWeight: 600, color: '#475569', fontSize: 14, margin: 0 }}>選擇匯出內容（開立事項）</label>
            </div>
            <div style={{ display: 'flex', gap: 16, marginLeft: 36, flexWrap: 'wrap' }}>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: 'white', borderRadius: 8, border: `2px solid ${exportScope === 'latest' ? '#2563eb' : '#e2e8f0'}` }}>
                <input type="radio" name="exportScope" value="latest" checked={exportScope === 'latest'} onChange={() => setExportScope('latest')} />
                <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>僅匯出最新進度</div>
              </label>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: 'white', borderRadius: 8, border: `2px solid ${exportScope === 'full' ? '#2563eb' : '#e2e8f0'}` }}>
                <input type="radio" name="exportScope" value="full" checked={exportScope === 'full'} onChange={() => setExportScope('full')} />
                <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>匯出完整歷程</div>
              </label>
            </div>
          </div>
        )}
        <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>3</div>
            <label style={{ fontWeight: 600, color: '#475569', fontSize: 14, margin: 0 }}>選擇檔案格式</label>
          </div>
          <div style={{ display: 'flex', gap: 16, marginLeft: 36, flexWrap: 'wrap' }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: 'white', borderRadius: 8, border: `2px solid ${exportFormat === 'excel' ? '#2563eb' : '#e2e8f0'}` }}>
              <input type="radio" name="exportFormat" value="excel" checked={exportFormat === 'excel'} onChange={() => setExportFormat('excel')} />
              <div>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>Excel (.xlsx)</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>需使用嵌入版</div>
              </div>
            </label>
            {isAdmin && (
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: 'white', borderRadius: 8, border: `2px solid ${exportFormat === 'json' ? '#2563eb' : '#e2e8f0'}` }}>
                <input type="radio" name="exportFormat" value="json" checked={exportFormat === 'json'} onChange={() => setExportFormat('json')} />
                <div>
                  <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>JSON (備份用)</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>適合系統備份與還原</div>
                </div>
              </label>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
          <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={handleExport}>
            📥 執行匯出
          </button>
        </div>
      </div>
    </div>
  );
}
