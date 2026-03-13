import { useState, useEffect } from 'react';
import { utils, writeFileXLSX } from 'xlsx';
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
  const [exportFormat, setExportFormat] = useState('json');
  const planTemplateRef = useState(null)[0];
  const userTemplateRef = useState(null)[0];
  const [importing, setImporting] = useState(false);

  const isAdmin = user?.isAdmin === true;
  const canManage = isAdmin || user?.role === 'manager';
  const { aiEnabled, refreshAuth } = useAuth();
  const [aiEnabledLocal, setAiEnabledLocal] = useState(true);
  const [aiSettingLoading, setAiSettingLoading] = useState(false);

  useEffect(() => {
    setAiEnabledLocal(aiEnabled !== false);
  }, [aiEnabled]);

  const toggleAiEnabled = async () => {
    if (!isAdmin) return;
    const nextVal = !aiEnabledLocal;
    setAiSettingLoading(true);
    setAiEnabledLocal(nextVal);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ aiEnabled: nextVal }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        refreshAuth?.();
        showToast(nextVal ? 'AI 審查功能已開啟' : 'AI 審查功能已關閉', 'success');
      } else {
        setAiEnabledLocal(!nextVal);
        showToast(j.error || '更新失敗', 'error');
      }
    } catch (e) {
      setAiEnabledLocal(!nextVal);
      showToast('更新失敗: ' + (e.message || ''), 'error');
    } finally {
      setAiSettingLoading(false);
    }
  };

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

      const dateStr = new Date().toISOString().slice(0, 10);

      if (exportFormat === 'json') {
        const exportData = {};
        if (exportDataType === 'issues' || exportDataType === 'both') exportData.issues = issuesData;
        if (exportDataType === 'plans' || exportDataType === 'both') exportData.plans = planSchedulesData;
        if (exportDataType === 'users') exportData.users = usersData;
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const label = exportDataType === 'issues' ? 'Issues' : exportDataType === 'plans' ? 'Plans' : exportDataType === 'users' ? 'Users' : 'All';
        link.download = `SMS_Backup_${label}_${dateStr}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('JSON 匯出完成', 'success');
      } else {
        const wb = utils.book_new();
        if (exportDataType === 'issues' || exportDataType === 'both') {
          let maxRound = 1;
          if (exportScope === 'full') {
            issuesData.forEach((r) => {
              for (const k of Object.keys(r || {})) {
                const m = k.match(/^handling(\d+)$/) || k.match(/^review(\d+)$/);
                if (m) maxRound = Math.max(maxRound, parseInt(m[1], 10));
              }
            });
          }
          const rows = issuesData.map((r) => {
            const base = {
              編號: r.number,
              年度: r.year,
              機構: r.unit,
              事項內容: r.content,
              列管狀態: r.status,
              類型: r.item_kind_code,
              分組: r.division_name,
              檢查類別: r.inspection_category_name,
              檢查計畫: r.plan_name,
              開立日期: r.issue_date,
              辦理情形: r.handling,
              審查意見: r.review,
              機構回復日期: r.reply_date_r1,
              機關函復日期: r.response_date_r1,
            };
            if (exportScope === 'full' && maxRound >= 2) {
              for (let i = 2; i <= maxRound; i++) {
                base[`辦理情形${i}`] = r[`handling${i}`] ?? '';
                base[`審查意見${i}`] = r[`review${i}`] ?? '';
                base[`機構回復日期${i}`] = r[`reply_date_r${i}`] ?? '';
                base[`機關函復日期${i}`] = r[`response_date_r${i}`] ?? '';
              }
            }
            return base;
          });
          const ws = utils.json_to_sheet(rows);
          utils.book_append_sheet(wb, ws, '開立事項');
        }
        if (exportDataType === 'plans' || exportDataType === 'both') {
          const planRows = planSchedulesData.map((r) => ({
            計畫名稱: r.plan_name,
            年度: r.year,
            鐵路機構: r.railway,
            檢查類別: r.inspection_type,
            業務類型: r.business,
            規劃檢查次數: r.planned_count,
          }));
          const planWs = utils.json_to_sheet(planRows);
          utils.book_append_sheet(wb, planWs, '檢查計畫');
        }
        if (exportDataType === 'users') {
          const userRows = usersData.map((r) => ({
            姓名: r.name,
            帳號: r.username,
            權限: r.role,
          }));
          const userWs = utils.json_to_sheet(userRows);
          utils.book_append_sheet(wb, userWs, '帳號');
        }
        const label = exportDataType === 'issues' ? '開立事項' : exportDataType === 'plans' ? '檢查計畫' : exportDataType === 'users' ? '帳號' : '系統備份';
        writeFileXLSX(wb, `SMS_${label}_${dateStr}.xlsx`);
        showToast('Excel 匯出完成', 'success');
      }
    } catch (e) {
      showToast('匯出失敗: ' + (e.message || ''), 'error');
    }
  };

  const handleImport = async () => {
    const input = document.getElementById('systemImportFile');
    const file = input?.files?.[0];
    if (!file) {
      showToast('請選擇要匯入的 JSON 檔案', 'error');
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        showToast('JSON 格式錯誤，請確認檔案內容', 'error');
        setImporting(false);
        return;
      }
      let issues = data.issues;
      let plans = data.plans;
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (first && 'number' in first) {
          issues = data;
          plans = plans || [];
        } else if (first && ('plan_name' in first || 'planName' in first)) {
          plans = data;
          issues = issues || [];
        }
      }
      const hasIssues = Array.isArray(issues) && issues.length > 0;
      const hasPlans = Array.isArray(plans) && plans.length > 0;
      if (!hasIssues && !hasPlans) {
        showToast('JSON 中沒有可匯入的資料（需包含 issues 或 plans 陣列）', 'error');
        setImporting(false);
        return;
      }
      const res = await apiFetch('/api/admin/system-import', {
        method: 'POST',
        body: JSON.stringify({
          issues: hasIssues ? issues : undefined,
          plans: hasPlans ? plans : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.success) {
        const r = j.results || {};
        const parts = [];
        if (r.plans?.success > 0) parts.push(`檢查計畫 ${r.plans.success} 筆`);
        if (r.issues?.success > 0) parts.push(`開立事項 ${r.issues.success} 筆`);
        showToast('匯入完成：' + (parts.join('、') || '無新增'), 'success');
        if (input) input.value = '';
      } else {
        showToast(j.error || '匯入失敗', 'error');
      }
    } catch (e) {
      showToast('匯入失敗: ' + (e.message || ''), 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="main-card">
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
          AI 審查開關、匯入範例檔管理、系統資料備份與還原。
        </p>
      </div>

      {isAdmin && (
        <div className="detail-card" style={{ marginBottom: 30 }}>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#334155', fontSize: 16 }}>🤖 AI 審查功能</h4>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>開啟後，審查事項時可顯示「AI 智能分析」按鈕；關閉後，其他模組將不顯示此功能。</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <input
                type="checkbox"
                checked={aiEnabledLocal}
                onChange={toggleAiEnabled}
                disabled={aiSettingLoading}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontWeight: 500, color: '#334155' }}>{aiEnabledLocal ? '已開啟' : '已關閉'}</span>
            </label>
            {aiSettingLoading && <span style={{ fontSize: 13, color: '#64748b' }}>更新中...</span>}
          </div>
        </div>
      )}

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
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#334155', fontSize: 16 }}>📦 系統資料備份與還原</h4>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>匯出 JSON 或 Excel 備份檔，或上傳 JSON 備份檔還原開立事項與檢查計畫。</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'start' }}>
          <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, color: '#334155', marginBottom: 16, fontSize: 15 }}>📤 匯出</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>資料類型</div>
              <select className="filter-select" value={exportDataType} onChange={(e) => setExportDataType(e.target.value)} style={{ width: '100%' }}>
                <option value="issues">僅開立事項</option>
                <option value="plans">僅檢查計畫</option>
                <option value="both">開立事項＋檢查計畫</option>
                <option value="users">僅帳號</option>
              </select>
            </div>
            {(exportDataType === 'issues' || exportDataType === 'both') && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>開立事項範圍</div>
                <select className="filter-select" value={exportScope} onChange={(e) => setExportScope(e.target.value)} style={{ width: '100%' }}>
                  <option value="latest">僅最新進度</option>
                  <option value="full">完整歷程</option>
                </select>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>格式</div>
              <select className="filter-select" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={{ width: '100%' }}>
                <option value="json">JSON（備份用）</option>
                <option value="excel">Excel (.xlsx)</option>
              </select>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: '10px 16px' }} onClick={handleExport}>
              📥 執行匯出
            </button>
          </div>
          {canManage && (
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, color: '#334155', marginBottom: 16, fontSize: 15 }}>📥 匯入</div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>上傳 JSON 備份檔（含 issues 或 plans）。</p>
              <input
                type="file"
                id="systemImportFile"
                accept=".json"
                style={{ display: 'block', marginBottom: 12, fontSize: 12, width: '100%' }}
              />
              <button
                className="btn btn-outline"
                style={{ width: '100%', padding: '10px 16px' }}
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? '匯入中...' : '📤 執行匯入'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
