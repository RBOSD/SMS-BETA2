/**
 * 共用 Modal：showPreview、closePreview、showConfirmModal、closeConfirmModal、closeDrawer、協作編修
 * 依賴：core.js (apiFetch, showToast), utils.js (escapeHtml, getRoleName)
 */
(function () {
    'use strict';

    var confirmModalResolve = null;
    var editorsAllUsersCache = null;
    var editorsSelectedSet = new Set();
    var editorsModalLoadedFor = null;
    var confirmModalHandler = null;

    function showPreview(html, title) {
        var titleEl = document.getElementById('previewTitle');
        var contentEl = document.getElementById('previewContent');
        if (titleEl) titleEl.innerText = title || '內容預覽';
        if (contentEl) contentEl.innerHTML = html || '(無內容)';
        var modal = document.getElementById('previewModal');
        if (modal) modal.classList.add('open');
    }
    window.showPreview = showPreview;

    function closePreview() {
        var modal = document.getElementById('previewModal');
        if (modal) modal.classList.remove('open');
    }
    window.closePreview = closePreview;

    function showConfirmModal(message, confirmText, cancelText) {
        confirmText = confirmText || '確認';
        cancelText = cancelText || '取消';
        return new Promise(function (resolve) {
            var modal = document.getElementById('confirmModal');
            var messageEl = document.getElementById('confirmModalMessage');
            var confirmBtn = document.getElementById('confirmModalConfirmBtn');
            if (!modal || !messageEl || !confirmBtn) {
                resolve(confirm(message));
                return;
            }
            if (confirmModalHandler && confirmBtn) {
                confirmBtn.removeEventListener('click', confirmModalHandler);
            }
            confirmModalResolve = resolve;
            messageEl.textContent = message;
            confirmBtn.textContent = confirmText;
            confirmModalHandler = function () {
                modal.style.display = 'none';
                if (confirmModalResolve) {
                    confirmModalResolve(true);
                    confirmModalResolve = null;
                }
            };
            confirmBtn.addEventListener('click', confirmModalHandler);
            modal.style.display = 'flex';
        });
    }
    window.showConfirmModal = showConfirmModal;

    function closeConfirmModal() {
        var modal = document.getElementById('confirmModal');
        if (modal) {
            modal.style.display = 'none';
            if (confirmModalResolve) {
                confirmModalResolve(false);
                confirmModalResolve = null;
            }
        }
    }
    window.closeConfirmModal = closeConfirmModal;

    function closeDrawer() {
        var backdrop = document.getElementById('drawerBackdrop');
        var drawer = document.getElementById('detailDrawer');
        if (backdrop) backdrop.classList.remove('open');
        if (drawer) drawer.classList.remove('open');
    }
    window.closeDrawer = closeDrawer;

    // --- 協作編修人員（開立事項 / 檢查計畫） ---
    async function ensureEditorsUsersLoaded(force) {
        if (editorsAllUsersCache && !force) return editorsAllUsersCache;
        var res = await window.apiFetch('/api/users/lookup?limit=5000&_t=' + Date.now());
        var j = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(j.error || '載入使用者清單失敗');
        editorsAllUsersCache = Array.isArray(j.data) ? j.data : [];
        return editorsAllUsersCache;
    }

    function closeEditorsModal() {
        var m = document.getElementById('editorsModal');
        if (m) m.classList.remove('open');
        editorsSelectedSet = new Set();
        editorsModalLoadedFor = null;
        var q = document.getElementById('editorsUserSearch');
        if (q) q.value = '';
    }
    window.closeEditorsModal = closeEditorsModal;

    async function openEditorsModal(type, id, subtitle) {
        var m = document.getElementById('editorsModal');
        var titleEl = document.getElementById('editorsModalTitle');
        var subEl = document.getElementById('editorsModalSubtitle');
        var box = document.getElementById('editorsUsersBox');
        if (!m || !box) return;
        document.getElementById('editorsTargetType').value = String(type || '');
        document.getElementById('editorsTargetId').value = String(id || '');
        editorsSelectedSet = new Set();
        editorsModalLoadedFor = { type: String(type || ''), id: Number(id) };
        if (titleEl) titleEl.textContent = '協作編修人員';
        if (subEl) subEl.textContent = subtitle ? String(subtitle) : '';
        box.innerHTML = '<div style="color:#64748b;font-size:13px;">（載入中…）</div>';
        m.classList.add('open');
        try {
            await ensureEditorsUsersLoaded(false);
            var endpoint = type === 'plan' ? '/api/plans/' + id + '/editors' : '/api/issues/' + id + '/editors';
            var res = await window.apiFetch(endpoint + '?_t=' + Date.now());
            var j = await res.json().catch(function () { return {}; });
            if (!res.ok) {
                window.showToast(j.error || '載入失敗', 'error');
                closeEditorsModal();
                return;
            }
            var existing = Array.isArray(j.data) ? j.data : [];
            editorsSelectedSet = new Set(existing.map(function (x) { return parseInt(x.id, 10); }).filter(function (n) { return Number.isFinite(n); }));
            renderEditorsUserList();
        } catch (e) {
            window.showToast(e.message || '載入失敗', 'error');
            closeEditorsModal();
        }
    }
    window.openEditorsModal = openEditorsModal;

    function renderEditorsUserList() {
        var box = document.getElementById('editorsUsersBox');
        if (!box) return;
        var q = String((document.getElementById('editorsUserSearch') || {}).value || '').trim().toLowerCase();
        var users = Array.isArray(editorsAllUsersCache) ? editorsAllUsersCache : [];
        var candidates = users.filter(function (u) { return u && (u.isAdmin === true || u.role === 'manager'); });
        var filtered = candidates.filter(function (u) {
            if (!q) return true;
            var hay = ((u.name || '') + ' ' + (u.username || '')).toLowerCase();
            return hay.indexOf(q) >= 0;
        });
        if (filtered.length === 0) {
            box.innerHTML = '<div style="color:#64748b;font-size:13px;">查無使用者</div>';
            return;
        }
        var escape = window.escapeHtml || function (x) { return String(x); };
        var getRole = window.getRoleName || function (r) { return r || ''; };
        box.innerHTML = filtered.map(function (u) {
            var uid = parseInt(u.id, 10);
            var checked = editorsSelectedSet.has(uid);
            var displayName = u.name || u.username || '-';
            var sub = (u.username || '-') + ' · ' + (u.isAdmin === true ? '系統管理員' : getRole(u.role));
            return '<label style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border-radius:12px; background:' + (checked ? '#eff6ff' : '#ffffff') + '; border:1px solid ' + (checked ? '#bfdbfe' : '#e2e8f0') + '; margin-bottom:10px; cursor:pointer;">' +
                '<input type="checkbox" style="margin-top:3px; width:16px; height:16px; cursor:pointer;" ' + (checked ? 'checked' : '') + ' onchange="toggleEditorsUser(' + uid + ', this.checked)">' +
                '<div style="min-width:0;">' +
                '<div style="font-weight:800; color:#334155; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escape(displayName) + '</div>' +
                '<div style="color:#64748b; font-size:12px; margin-top:2px;">' + escape(sub) + '</div>' +
                '</div></label>';
        }).join('');
    }

    function toggleEditorsUser(userId, checked) {
        var uid = parseInt(userId, 10);
        if (!Number.isFinite(uid)) return;
        if (checked) editorsSelectedSet.add(uid);
        else editorsSelectedSet.delete(uid);
    }
    window.toggleEditorsUser = toggleEditorsUser;

    async function saveEditorsSelection() {
        var type = String((document.getElementById('editorsTargetType') || {}).value || '');
        var id = parseInt(String((document.getElementById('editorsTargetId') || {}).value || ''), 10);
        if (!type || !Number.isFinite(id)) return window.showToast('資料不完整', 'error');
        try {
            var editorUserIds = Array.from(editorsSelectedSet.values()).filter(function (n) { return Number.isFinite(n); });
            var endpoint = type === 'plan' ? '/api/plans/' + id + '/editors' : '/api/issues/' + id + '/editors';
            var res = await window.apiFetch(endpoint, {
                method: 'PUT',
                body: JSON.stringify({ editorUserIds: editorUserIds })
            });
            var j = await res.json().catch(function () { return {}; });
            if (!res.ok) return window.showToast(j.error || '儲存失敗', 'error');
            window.showToast('已更新協作編修人員', 'success');
            closeEditorsModal();
        } catch (e) {
            window.showToast('儲存失敗：' + (e.message || 'error'), 'error');
        }
    }
    window.saveEditorsSelection = saveEditorsSelection;

    function openIssueEditorsModalFromDrawer() {
        var currentEditItem = window.currentEditItem;
        if (!currentEditItem) return window.showToast('找不到當前資料', 'error');
        var id = currentEditItem.id;
        var number = currentEditItem.number || 'ID:' + id;
        openEditorsModal('issue', id, '開立事項：' + number);
    }
    window.openIssueEditorsModalFromDrawer = openIssueEditorsModalFromDrawer;

    function openPlanEditorsModal() {
        var id = parseInt(String((document.getElementById('targetPlanId') || {}).value || ''), 10);
        if (!Number.isFinite(id)) return window.showToast('請先選擇既有計畫再設定協作人員', 'error');
        var name = String((document.getElementById('planName') || {}).value || '').trim();
        var year = String((document.getElementById('planYear') || {}).value || '').trim();
        openEditorsModal('plan', id, ('檢查計畫：' + (name || '') + (year ? ' (' + year + ')' : '')).trim());
    }
    window.openPlanEditorsModal = openPlanEditorsModal;

    // --- 批次編輯 Modal（開關邏輯） ---
    function closeBatchContentModal() {
        // 已改為直接在表格中輸入，此函數保留以供 HTML onclick 呼叫
    }
    window.closeBatchContentModal = closeBatchContentModal;

    function saveBatchContent() {
        // 已改為直接在表格中輸入，此函數保留以供 HTML onclick 呼叫
    }
    window.saveBatchContent = saveBatchContent;

    function initBatchContentModal() {
        var modal = document.getElementById('batchContentModal');
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) closeBatchContentModal();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        initBatchContentModal();
        var confirmModal = document.getElementById('confirmModal');
        if (confirmModal) {
            confirmModal.addEventListener('click', function (e) {
                if (e.target === confirmModal) {
                    closeConfirmModal();
                }
            });
        }
    });
})();
