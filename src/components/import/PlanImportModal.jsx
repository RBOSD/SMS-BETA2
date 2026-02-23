/**
 * 檢查計畫整批匯入 Modal（Excel .xlsx）
 */
import { useRef, useEffect } from 'react';
import { read, utils, writeFileXLSX } from 'xlsx';
import { apiFetch } from '../../api/api';
import { useToast } from '../../context/ToastContext';

function parsePlansImportRows(rows) {
  const validData = [];
  const invalidRows = [];
  (rows || []).forEach((row, index) => {
    const isEmptyRow = !row || Object.values(row).every((val) => !val || String(val).trim() === '');
    if (isEmptyRow) return;

    let name = '',
      year = '',
      railwayRaw = '',
      inspectionRaw = '',
      businessRaw = '',
      planned_count = '';
    for (const key in row) {
      const cleanKey = String(key || '').trim();
      if (cleanKey === '計畫名稱' || cleanKey === 'name' || cleanKey === 'planName' || cleanKey === '計劃名稱') {
        name = String(row[key] || '').trim();
      } else if (cleanKey === '年度' || cleanKey === 'year') {
        year = String(row[key] || '').trim();
      } else if (cleanKey === '鐵路機構' || cleanKey === 'railway') {
        railwayRaw = String(row[key] || '').trim();
      } else if (cleanKey === '檢查類別' || cleanKey === 'inspection_type' || cleanKey === 'inspectionType') {
        inspectionRaw = String(row[key] || '').trim();
      } else if (cleanKey === '業務類型' || cleanKey === '業務類別' || cleanKey === 'business') {
        businessRaw = String(row[key] || '').trim();
      } else if (cleanKey === '規劃檢查幾次' || cleanKey === '規劃檢查次數' || cleanKey === 'planned_count' || cleanKey === 'plannedCount') {
        planned_count = String(row[key] || '').trim();
      }
    }

    const yearStr = String(year || '').replace(/\D/g, '').slice(-3).padStart(3, '0');
    const railwayMap = {
      臺鐵: 'T', 台鐵: 'T', T: 'T',
      高鐵: 'H', H: 'H',
      林鐵: 'A', A: 'A',
      糖鐵: 'S', S: 'S',
    };
    const inspectionMap = {
      年度定期檢查: '1', 1: '1',
      特別檢查: '2', 2: '2',
      例行性檢查: '3', 3: '3',
      臨時檢查: '4', 4: '4',
    };
    const businessMap = {
      運轉: 'OP', OP: 'OP',
      土建: 'CV', CV: 'CV',
      機務: 'ME', ME: 'ME',
      電務: 'EL', EL: 'EL',
      安全管理: 'SM', SM: 'SM',
      '營運／災防審核': 'AD', '營運/災防審核': 'AD', 營運: 'AD', AD: 'AD',
      '其他／產管規劃': 'OT', '其他/產管規劃': 'OT', 其他: 'OT', OT: 'OT',
    };
    const railway = railwayMap[String(railwayRaw || '').trim()] || '';
    const inspection_type = inspectionMap[String(inspectionRaw || '').trim()] || '';
    const business = businessMap[String(businessRaw || '').trim()] || null;
    const plannedCountVal = planned_count !== '' ? parseInt(planned_count, 10) : null;

    const missing = [];
    if (!name) missing.push('計畫名稱');
    if (!yearStr) missing.push('年度');
    if (!railway) missing.push('鐵路機構');
    if (!inspection_type) missing.push('檢查類別');
    if (plannedCountVal != null && (Number.isNaN(plannedCountVal) || plannedCountVal < 0)) missing.push('規劃檢查幾次(需為>=0數字)');

    if (missing.length === 0) {
      validData.push({
        name,
        year: yearStr,
        railway,
        inspection_type,
        business,
        planned_count: plannedCountVal,
      });
    } else {
      invalidRows.push({
        row: index + 2,
        name: name || '(空白)',
        year: year || '(空白)',
        railway: railwayRaw || '(空白)',
        inspection_type: inspectionRaw || '(空白)',
        planned_count: planned_count || '(空白)',
        missing,
        rawRow: row,
      });
    }
  });
  return { validData, invalidRows };
}

export default function PlanImportModal({ open, onClose, onSuccess }) {
  const showToast = useToast();
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open && fileInputRef.current) fileInputRef.current.value = '';
  }, [open]);

  const handleImport = async () => {
    const fileInput = fileInputRef.current;
    if (!fileInput) return showToast('找不到檔案選擇器', 'error');
    const file = fileInput.files?.[0];
    if (!file) return showToast('請選擇匯入檔案', 'error');

    const filename = String(file.name || '').toLowerCase();
    if (!filename.endsWith('.xlsx')) return showToast('僅支援 .xlsx', 'error');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buf = e.target.result;
        const wb = read(buf, { type: 'array' });
        const sheetName = wb.SheetNames.includes('匯入') ? '匯入' : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = utils.sheet_to_json(ws, { defval: '' });

        const { validData, invalidRows } = parsePlansImportRows(rows);
        if (validData.length === 0) {
          let errorMsg = '匯入檔案中沒有有效的資料';
          if (invalidRows.length > 0) {
            errorMsg += `\n發現 ${invalidRows.length} 筆資料缺少必要欄位（計畫名稱、年度、鐵路機構、檢查類別）`;
          }
          return showToast(errorMsg, 'error');
        }

        const res = await apiFetch('/api/plans/import', {
          method: 'POST',
          body: JSON.stringify({ data: validData }),
        });

        if (res.status === 401) return showToast('匯入錯誤：請先登入系統', 'error');
        if (res.status === 403) return showToast('匯入錯誤：您沒有權限執行此操作', 'error');

        let j;
        try {
          const text = await res.text();
          j = JSON.parse(text);
        } catch (parseError) {
          if (res.ok) {
            showToast('匯入可能已完成，但無法解析伺服器回應。請重新整理頁面確認結果。', 'warning');
            onClose();
            onSuccess?.();
            return;
          }
          return showToast('匯入錯誤：伺服器回應格式錯誤（狀態碼：' + res.status + '）', 'error');
        }

        if (res.ok && j.success === true) {
          const successCount = j.successCount || 0;
          let msg = `匯入完成：成功 ${successCount} 筆`;
          if (j.skipped > 0) msg += `，跳過空行 ${j.skipped} 筆`;
          if (j.failed > 0) msg += `，失敗 ${j.failed} 筆`;
          showToast(msg, j.failed > 0 ? 'warning' : 'success');
          onClose();
          onSuccess?.();
        } else {
          showToast(j.error || '匯入失敗', 'error');
        }
      } catch (e) {
        if (e.name === 'TypeError' && (e.message?.includes('text') || e.message?.includes('already been read'))) return;
        if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
          showToast('匯入錯誤：網路連線失敗', 'error');
        } else {
          showToast('讀取檔案錯誤：' + (e.message || '未知錯誤'), 'error');
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/templates/plans-import-xlsx?t=' + Date.now(), { credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        const cd = res.headers.get('content-disposition') || '';
        let filename = '檢查計畫匯入範例.xlsx';
        const m = cd.match(/filename\*\=UTF-8''([^;]+)/i);
        if (m?.[1]) filename = decodeURIComponent(m[1]);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        showToast('已下載範例檔', 'success');
        return;
      }
    } catch (e) {
      /* 忽略，改用預設範例 */
    }
    try {
      const wb = utils.book_new();
      const sheet1 = [
        ['年度', '計畫名稱', '鐵路機構', '檢查類別', '業務類型', '規劃檢查幾次'],
        ['113', '上半年定期檢查', '臺鐵', '年度定期檢查', '運轉', '2'],
        ['113', '特別檢查', '高鐵', '特別檢查', '營運／災防審核', '1'],
      ];
      const ws = utils.aoa_to_sheet(sheet1);
      utils.book_append_sheet(wb, ws, '匯入');
      writeFileXLSX(wb, '檢查計畫匯入範例.xlsx');
      showToast('已下載範例檔', 'success');
    } catch (e) {
      showToast('下載範例檔失敗：' + (e.message || '未知錯誤'), 'error');
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 600, width: '95%' }}>
        <h3 style={{ marginTop: 0 }}>整批匯入檢查計畫（Excel）</h3>
        <div className="form-group">
          <label>選擇匯入檔案（.xlsx）</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="filter-input"
            onChange={() => {}}
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
            📥 下載 Excel 範例
          </button>
        </div>
      </div>
    </div>
  );
}
