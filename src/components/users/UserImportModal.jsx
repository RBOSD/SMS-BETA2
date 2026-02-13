import { useRef } from 'react';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';

const ROLE_MAP = {
  admin: 'manager',
  manager: 'manager',
  editor: 'manager',
  viewer: 'viewer',
  系統管理員: 'manager',
  資料管理者: 'manager',
  審查人員: 'manager',
  檢視人員: 'viewer',
};

function parseCSVSimple(csv) {
  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { validData: [], invalidRows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const nameIdx = headers.indexOf('姓名') >= 0 ? headers.indexOf('姓名') : headers.indexOf('name');
  const userIdx = headers.findIndex((h) => ['帳號', 'username', 'email'].includes(h));
  const roleIdx = headers.findIndex((h) => ['權限', 'role'].includes(h));
  const pwdIdx = headers.findIndex((h) => ['密碼', 'password'].includes(h));
  const validData = [];
  const invalidRows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    const name = (nameIdx >= 0 ? parts[nameIdx] : '') || '';
    const username = (userIdx >= 0 ? parts[userIdx] : '') || '';
    const role = (roleIdx >= 0 ? parts[roleIdx] : '') || '';
    const password = (pwdIdx >= 0 ? parts[pwdIdx] : '') || '';
    if (!name || !username || !role) {
      invalidRows.push({ row: i + 2 });
      continue;
    }
    const normalizedRole = ROLE_MAP[role] || ROLE_MAP[role.toLowerCase()];
    if (!normalizedRole) {
      invalidRows.push({ row: i + 2, error: `無效的權限值：${role}` });
      continue;
    }
    validData.push({ name, username, role: normalizedRole, password });
  }
  return { validData, invalidRows };
}

export default function UserImportModal({ open, onClose, onSuccess }) {
  const showToast = useToast();
  const fileInputRef = useRef(null);

  const parseCSV = (csv) => parseCSVSimple(csv);

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      showToast('請選擇 CSV 檔案', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { validData, invalidRows } = parseCSV(e.target.result);
        if (validData.length === 0) {
          showToast(invalidRows.length > 0 ? `CSV 中沒有有效資料（${invalidRows.length} 筆格式錯誤）` : 'CSV 檔案中沒有有效的資料', 'error');
          return;
        }
        const res = await apiFetch('/api/users/import', {
          method: 'POST',
          body: JSON.stringify({ data: validData }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.success === true) {
          const successCount = j.successCount || 0;
          let msg = `匯入完成：成功 ${successCount} 筆`;
          if (j.failed > 0) {
            msg += `，失敗 ${j.failed} 筆`;
            if (j.errors?.length > 0) msg += '\n' + j.errors.slice(0, 3).join('\n');
          }
          showToast(msg, 'success');
          onClose();
          onSuccess?.();
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          showToast(j.error || '匯入失敗', 'error');
        }
      } catch (e) {
        showToast('匯入失敗: ' + (e.message || '請稍後再試'), 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDownloadTemplate = async () => {
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

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box" style={{ maxWidth: 600 }}>
        <h3 style={{ marginTop: 0 }}>整批匯入帳號（CSV）</h3>
        <div className="form-group">
          <label>選擇匯入檔案（.csv）</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="filter-input"
          />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleImport}>
            📥 執行匯入
          </button>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>
            取消
          </button>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleDownloadTemplate}>
            📥 下載匯入範例
          </button>
        </div>
      </div>
    </div>
  );
}
