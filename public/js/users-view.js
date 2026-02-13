/**
 * 後台管理：loadUsersPage、switchAdminTab、loadLogsPage、loadActionsPage、日誌
 * 依賴：core.js, utils.js, search-view.js (renderPagination), modals.js (showConfirmModal)
 */
(function () {
    'use strict';

    function saveUsersViewState() {
        var state = {
            search: (document.getElementById('userSearch') && document.getElementById('userSearch').value) || '',
            page: window.usersPage,
            pageSize: window.usersPageSize,
            sortField: window.usersSortField,
            sortDir: window.usersSortDir,
            tab: sessionStorage.getItem('currentUsersTab') || 'users'
        };
        sessionStorage.setItem('usersViewState', JSON.stringify(state));
    }

    function restoreUsersViewState() {
        var saved = sessionStorage.getItem('usersViewState');
        if (!saved) return;
        try {
            var state = JSON.parse(saved);
            if (document.getElementById('userSearch')) document.getElementById('userSearch').value = state.search || '';
            if (state.page) window.usersPage = state.page;
            if (state.pageSize) window.usersPageSize = state.pageSize;
            if (state.sortField) window.usersSortField = state.sortField;
            if (state.sortDir) window.usersSortDir = state.sortDir;
            if (state.tab) sessionStorage.setItem('currentUsersTab', state.tab);
        } catch (e) {}
    }
    window.saveUsersViewState = saveUsersViewState;
    window.restoreUsersViewState = restoreUsersViewState;

    async function loadUsersPage(page) {
        page = page || 1;
        var usersView = document.getElementById('usersView');
        if (!usersView || !usersView.classList.contains('active')) return;
        window.usersPage = page;
        var usersPageSizeEl = document.getElementById('usersPageSize');
        window.usersPageSize = usersPageSizeEl ? (parseInt(usersPageSizeEl.value, 10) || 20) : 20;
        var userSearchEl = document.getElementById('userSearch');
        var q = userSearchEl ? (userSearchEl.value || '') : '';
        saveUsersViewState();
        var params = new URLSearchParams({
            page: window.usersPage,
            pageSize: window.usersPageSize,
            q: q,
            sortField: window.usersSortField,
            sortDir: window.usersSortDir,
            _t: Date.now()
        });
        try {
            var res = await window.apiFetch('/api/users?' + params.toString());
            if (!res.ok) {
                window.showToast('載入使用者失敗', 'error');
                return;
            }
            var j = await res.json();
            window.userList = j.data || [];
            window.usersTotal = j.total || 0;
            window.usersPages = j.pages || 1;
            try {
                if (typeof window.ensureGroupsForUserModalLoaded === 'function') await window.ensureGroupsForUserModalLoaded();
            } catch (e) {}
            renderUsers();
            if (document.getElementById('usersPagination')) {
                if (typeof window.renderPagination === 'function') {
                    window.renderPagination('usersPagination', window.usersPage, window.usersPages, 'loadUsersPage');
                }
            }
        } catch (e) {
            window.showToast('載入使用者錯誤', 'error');
        }
    }
    window.loadUsersPage = loadUsersPage;

    function renderUsers() {
        var tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        var userList = window.userList || [];
        var groupsMap = new Map((window.cachedGroupsForModal || []).map(function (g) { return [parseInt(g.id, 10), g.name]; }));
        var myId = window.currentUser && window.currentUser.id;
        var escapeHtml = window.escapeHtml || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
        tbody.innerHTML = userList.map(function (u) {
            var gids = Array.isArray(u.groupIds) ? u.groupIds : [];
            var groupNames = gids.map(function (id) { return groupsMap.get(parseInt(id, 10)) || '#' + id; });
            var groupHtml = groupNames.length
                ? groupNames.map(function (n) { return '<span class="badge" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-weight:700;">' + escapeHtml(n) + '</span>'; }).join(' ')
                : '<span style="color:#94a3b8;">-</span>';
            var disabledBadge = (u.isDisabled === true) ? '<span class="badge" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-weight:700;margin-left:4px;">已停用</span>' : '';
            var opHtml = (myId && u.id === myId)
                ? '-'
                : '<button class="btn btn-outline" style="padding:2px 6px;margin-right:4px;" onclick="openUserModal(\'edit\', ' + u.id + ')" title="編輯">✏️</button><button class="btn btn-outline" style="padding:2px 6px;margin-right:4px;font-size:12px;" onclick="toggleUserDisable(' + u.id + ')" title="' + (u.isDisabled === true ? '啟用此帳號' : '停用此帳號') + '">' + (u.isDisabled === true ? '啟用' : '停用') + '</button><button class="btn btn-outline" style="padding:2px 6px;margin-right:4px;" onclick="resetUserPassword(' + u.id + ')" title="重置為初始密碼 Aa123456">🔑</button><button class="btn btn-danger" style="padding:2px 6px;" onclick="deleteUser(' + u.id + ')" title="刪除">🗑️</button>';
            return '<tr class="' + (u.isDisabled === true ? 'user-row-disabled' : '') + '"><td data-label="姓名" style="padding:12px;">' + escapeHtml(u.name || '-') + '</td><td data-label="帳號">' + escapeHtml(u.username || '-') + disabledBadge + '</td><td data-label="群組" style="display:flex; flex-wrap:wrap; gap:6px; padding:12px 8px;">' + groupHtml + '</td><td data-label="權限">' + escapeHtml(u.isAdmin === true ? '系統管理員' : (window.getRoleName ? window.getRoleName(u.role) : (u.role || ''))) + '</td><td data-label="註冊時間">' + (u.created_at ? new Date(u.created_at).toLocaleDateString() : '-') + '</td><td data-label="操作">' + opHtml + '</td></tr>';
        }).join('');
    }

    // --- 群組快取（供 user modal、import 等使用） ---
    var cachedGroupsForModal = null;
    window.cachedGroupsForModal = null;

    async function ensureGroupsForUserModalLoaded() {
        if (cachedGroupsForModal) return;
        try {
            var res = await window.apiFetch('/api/groups?_t=' + Date.now());
            var j = await res.json().catch(function () { return {}; });
            cachedGroupsForModal = res.ok && Array.isArray(j.data) ? j.data : [];
            window.cachedGroupsForModal = cachedGroupsForModal;
        } catch (e) {
            cachedGroupsForModal = [];
            window.cachedGroupsForModal = [];
        }
    }
    window.ensureGroupsForUserModalLoaded = ensureGroupsForUserModalLoaded;

    function renderUserGroupsCheckboxes(selectedGroupIds) {
        var box = document.getElementById('uGroupsBox');
        if (!box) return;
        var groups = Array.isArray(cachedGroupsForModal) ? cachedGroupsForModal : [];
        var selected = new Set((selectedGroupIds || []).map(function (x) { return parseInt(x, 10); }).filter(function (n) { return Number.isFinite(n); }));
        var escape = window.escapeHtml || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
        box.innerHTML = groups.map(function (g) {
            var id = g.id;
            var name = g.name || '群組 ' + id;
            var isSel = selected.has(parseInt(id, 10));
            return '<label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; cursor:pointer; background:' + (isSel ? '#eff6ff' : 'transparent') + ';">' +
                '<input type="checkbox" class="uGroupCheck" value="' + id + '" ' + (isSel ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;">' +
                '<span style="font-size:14px; color:#334155;">' + escape(name) + '</span></label>';
        }).join('');
    }

    // --- 群組管理 ---
    var adminSelectedGroupId = null;
    var adminAllUsersCache = null;

    async function loadAllUsersForAdmin(force) {
        if (adminAllUsersCache && !force) return adminAllUsersCache;
        var params = new URLSearchParams({ page: 1, pageSize: 10000, q: '', sortField: 'id', sortDir: 'asc', _t: Date.now() });
        var res = await window.apiFetch('/api/users?' + params.toString());
        if (!res.ok) {
            var j = await res.json().catch(function () { return {}; });
            throw new Error(j.error || '載入使用者失敗');
        }
        var j = await res.json();
        adminAllUsersCache = j.data || [];
        return adminAllUsersCache;
    }

    function renderGroupsFolderList() {
        var body = document.getElementById('groupsFolderListBody');
        if (!body) return;
        var groups = Array.isArray(cachedGroupsForModal) ? cachedGroupsForModal : [];
        if (groups.length === 0) {
            body.innerHTML = '<div style="padding:12px; color:#64748b; font-size:13px;">尚無群組</div>';
            return;
        }
        var selected = adminSelectedGroupId != null ? parseInt(adminSelectedGroupId, 10) : null;
        var escape = window.escapeHtml || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
        body.innerHTML = groups.map(function (g) {
            var id = parseInt(g.id, 10);
            var name = g.name || '群組 ' + id;
            var active = (selected != null && id === selected);
            return '<button type="button" onclick="selectGroupAdmin(' + id + ')" style="width:100%; text-align:left; border:none; background:' + (active ? '#eff6ff' : '#ffffff') + '; cursor:pointer; padding:10px 12px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between; gap:10px;">' +
                '<span style="font-weight:800; color:' + (active ? '#1d4ed8' : '#334155') + '; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📁 ' + escape(name) + '</span>' +
                '<span class="badge" style="background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;">ID ' + id + '</span></button>';
        }).join('');
    }

    async function loadGroupsAdmin() {
        var folderBody = document.getElementById('groupsFolderListBody');
        var membersBody = document.getElementById('groupMembersBody');
        if (folderBody) folderBody.innerHTML = '<div style="padding:12px; color:#64748b; font-size:13px;">載入中…</div>';
        if (membersBody) membersBody.innerHTML = '<div style="padding:8px; color:#64748b; font-size:13px;">載入中…</div>';
        try {
            var res = await window.apiFetch('/api/groups?_t=' + Date.now());
            if (!res.ok) {
                var j = await res.json().catch(function () { return {}; });
                if (folderBody) folderBody.innerHTML = '<div style="padding:12px; color:#ef4444; font-size:13px;">載入失敗：' + (window.escapeHtml ? window.escapeHtml(j.error || 'Denied') : (j.error || 'Denied')) + '</div>';
                return;
            }
            var j = await res.json();
            var groups = j.data || [];
            cachedGroupsForModal = groups;
            window.cachedGroupsForModal = groups;
            if (!adminSelectedGroupId && groups.length > 0) adminSelectedGroupId = groups[0].id;
            renderGroupsFolderList();
            try { renderUsers(); } catch (e) {}
            await renderSelectedGroupMembers();
        } catch (e) {
            if (folderBody) folderBody.innerHTML = '<div style="padding:12px; color:#ef4444; font-size:13px;">載入失敗：' + (window.escapeHtml ? window.escapeHtml(e.message || 'error') : (e.message || 'error')) + '</div>';
        }
    }
    window.loadGroupsAdmin = loadGroupsAdmin;

    function selectGroupAdmin(groupId) {
        adminSelectedGroupId = parseInt(groupId, 10);
        renderGroupsFolderList();
        renderSelectedGroupMembers();
    }
    window.selectGroupAdmin = selectGroupAdmin;

    function openRenameSelectedGroup() {
        if (!adminSelectedGroupId) return window.showToast('請先選擇群組', 'error');
        openRenameGroupModal(adminSelectedGroupId);
    }
    window.openRenameSelectedGroup = openRenameSelectedGroup;

    async function deleteSelectedGroup() {
        if (!adminSelectedGroupId) return window.showToast('請先選擇群組', 'error');
        var groups = Array.isArray(cachedGroupsForModal) ? cachedGroupsForModal : [];
        var g = groups.find(function (x) { return parseInt(x.id, 10) === parseInt(adminSelectedGroupId, 10); });
        var gname = g ? (g.name || '群組 ' + adminSelectedGroupId) : adminSelectedGroupId;
        if (g && (g.is_admin_group === true || g.isAdminGroup === true)) {
            return window.showToast('無法刪除系統管理群組', 'error');
        }
        var confirmed = await window.showConfirmModal('確定要刪除群組「' + (window.escapeHtml ? window.escapeHtml(gname) : gname) + '」嗎？\n\n此操作無法復原，且會一併移除該群組下所有成員的隸屬關係。', '確定刪除', '取消');
        if (!confirmed) return;
        try {
            var res = await window.apiFetch('/api/groups/' + adminSelectedGroupId, { method: 'DELETE' });
            var j = await res.json().catch(function () { return {}; });
            if (!res.ok) return window.showToast(j.error || '刪除失敗', 'error');
            window.showToast('刪除成功', 'success');
            cachedGroupsForModal = null;
            window.cachedGroupsForModal = null;
            adminSelectedGroupId = null;
            await loadGroupsAdmin();
        } catch (e) {
            window.showToast('刪除失敗: ' + (e.message || 'error'), 'error');
        }
    }
    window.deleteSelectedGroup = deleteSelectedGroup;

    async function renderSelectedGroupMembers() {
        var box = document.getElementById('groupMembersBody');
        var nameEl = document.getElementById('selectedGroupName');
        if (!box || !nameEl) return;
        var groups = Array.isArray(cachedGroupsForModal) ? cachedGroupsForModal : [];
        var gid = adminSelectedGroupId != null ? parseInt(adminSelectedGroupId, 10) : null;
        var group = gid != null ? groups.find(function (g) { return parseInt(g.id, 10) === gid; }) : null;
        nameEl.textContent = group ? (group.name || '群組 ' + group.id) : '（請先選擇群組）';
        var deleteBtn = document.getElementById('deleteGroupBtn');
        if (deleteBtn) {
            var isAdminGroup = group && (group.is_admin_group === true || group.isAdminGroup === true);
            deleteBtn.style.display = isAdminGroup ? 'none' : '';
        }
        if (!gid || !group) {
            box.innerHTML = '<div style="padding:8px; color:#64748b; font-size:13px;">請先選擇群組</div>';
            if (deleteBtn) deleteBtn.style.display = 'none';
            return;
        }
        var users;
        try {
            users = await loadAllUsersForAdmin(false);
        } catch (e) {
            box.innerHTML = '<div style="padding:8px; color:#ef4444; font-size:13px;">載入使用者失敗：' + (window.escapeHtml ? window.escapeHtml(e.message || 'error') : (e.message || 'error')) + '</div>';
            return;
        }
        var q = String((document.getElementById('groupUserSearch') || {}).value || '').trim().toLowerCase();
        var escape = window.escapeHtml || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
        var getRole = window.getRoleName || function (r) { return r || ''; };
        var rows = users.filter(function (u) {
            if (!q) return true;
            var hay = ((u.name || '') + ' ' + (u.username || '')).toLowerCase();
            return hay.indexOf(q) >= 0;
        }).map(function (u) {
            var member = Array.isArray(u.groupIds) && u.groupIds.map(function (x) { return parseInt(x, 10); }).indexOf(gid) >= 0;
            return '<label style="display:flex; align-items:flex-start; gap:10px; padding:8px 10px; border-radius:10px; background:' + (member ? '#eff6ff' : '#ffffff') + '; border:1px solid ' + (member ? '#bfdbfe' : '#e2e8f0') + '; margin-bottom:8px; cursor:pointer;">' +
                '<input type="checkbox" style="margin-top:3px; width:16px; height:16px; cursor:pointer;" ' + (member ? 'checked' : '') + ' onchange="toggleUserInSelectedGroup(' + u.id + ', this.checked)">' +
                '<div style="min-width:0;"><div style="font-weight:800; color:#334155; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escape(u.name || u.username || '-') + '</div>' +
                '<div style="color:#64748b; font-size:12px; margin-top:2px;">' + escape(u.username || '-') + ' · ' + escape(u.isAdmin === true ? '系統管理員' : getRole(u.role)) + '</div></div></label>';
        });
        box.innerHTML = rows.join('') || '<div style="padding:8px; color:#64748b; font-size:13px;">查無使用者</div>';
    }
    window.renderSelectedGroupMembers = renderSelectedGroupMembers;

    async function toggleUserInSelectedGroup(userId, checked) {
        var gid = adminSelectedGroupId != null ? parseInt(adminSelectedGroupId, 10) : null;
        if (!gid) return window.showToast('請先選擇群組', 'error');
        try {
            var users = await loadAllUsersForAdmin(false);
            var u = users.find(function (x) { return parseInt(x.id, 10) === parseInt(userId, 10); });
            if (!u) return window.showToast('找不到使用者', 'error');
            var cur = Array.isArray(u.groupIds) ? u.groupIds.map(function (x) { return parseInt(x, 10); }).filter(function (n) { return Number.isFinite(n); }) : [];
            var next = checked ? [...new Set([].concat(cur, [gid]))] : cur.filter(function (x) { return x !== gid; });
            var res = await window.apiFetch('/api/users/' + u.id, {
                method: 'PUT',
                body: JSON.stringify({ name: u.name, role: u.role, groupIds: next })
            });
            var j = await res.json().catch(function () { return {}; });
            if (!res.ok) {
                window.showToast(j.error || '更新失敗', 'error');
                await loadAllUsersForAdmin(true);
                await renderSelectedGroupMembers();
                return;
            }
            await loadAllUsersForAdmin(true);
            await loadUsersPage(window.usersPage || 1);
            await renderSelectedGroupMembers();
        } catch (e) {
            window.showToast('更新失敗: ' + (e.message || 'error'), 'error');
            try { await loadAllUsersForAdmin(true); } catch (_) {}
            try { await renderSelectedGroupMembers(); } catch (_) {}
        }
    }
    window.toggleUserInSelectedGroup = toggleUserInSelectedGroup;

    async function createGroupAdmin() {
        var input = document.getElementById('newGroupName');
        var name = String((input && input.value) || '').trim();
        if (!name) return window.showToast('請輸入群組名稱', 'error');
        try {
            var res = await window.apiFetch('/api/groups', {
                method: 'POST',
                body: JSON.stringify({ name: name })
            });
            var j = await res.json().catch(function () { return {}; });
            if (!res.ok) return window.showToast(j.error || '新增群組失敗', 'error');
            if (input) input.value = '';
            window.showToast('新增群組成功', 'success');
            cachedGroupsForModal = null;
            window.cachedGroupsForModal = null;
            await loadGroupsAdmin();
        } catch (e) {
            window.showToast('新增群組失敗: ' + e.message, 'error');
        }
    }
    window.createGroupAdmin = createGroupAdmin;

    function openRenameGroupModal(groupId) {
        var modal = document.getElementById('groupModal');
        var idEl = document.getElementById('targetGroupId');
        var nameEl = document.getElementById('groupNameInput');
        if (!modal || !idEl || !nameEl) return;
        var groups = Array.isArray(cachedGroupsForModal) ? cachedGroupsForModal : [];
        var g = groups.find(function (x) { return parseInt(x.id, 10) === parseInt(groupId, 10); });
        idEl.value = String(groupId);
        nameEl.value = g && g.name ? g.name : '';
        modal.classList.add('open');
        setTimeout(function () { nameEl.focus(); }, 50);
    }
    window.openRenameGroupModal = openRenameGroupModal;

    function closeGroupModal() {
        var modal = document.getElementById('groupModal');
        if (modal) modal.classList.remove('open');
    }
    window.closeGroupModal = closeGroupModal;

    async function submitGroupRename() {
        var idEl = document.getElementById('targetGroupId');
        var nameEl = document.getElementById('groupNameInput');
        var id = parseInt((idEl && idEl.value) || '', 10);
        var name = String((nameEl && nameEl.value) || '').trim();
        if (!id) return window.showToast('群組 ID 無效', 'error');
        if (!name) return window.showToast('群組名稱不可為空', 'error');
        try {
            var res = await window.apiFetch('/api/groups/' + id, {
                method: 'PUT',
                body: JSON.stringify({ name: name })
            });
            var j = await res.json().catch(function () { return {}; });
            if (!res.ok) return window.showToast(j.error || '更新群組失敗', 'error');
            window.showToast('更新群組成功', 'success');
            cachedGroupsForModal = null;
            window.cachedGroupsForModal = null;
            closeGroupModal();
            await loadGroupsAdmin();
        } catch (e) {
            window.showToast('更新群組失敗: ' + e.message, 'error');
        }
    }
    window.submitGroupRename = submitGroupRename;

    // --- 使用者 CRUD ---
    async function openUserModal(mode, id) {
        var m = document.getElementById('userModal');
        var t = document.getElementById('userModalTitle');
        var e = document.getElementById('uEmail');
        var groupIds = [];
        if (mode === 'create') {
            t.innerText = '新增';
            document.getElementById('targetUserId').value = '';
            document.getElementById('uName').value = '';
            e.value = '';
            e.disabled = false;
            document.getElementById('uPwd').value = '';
            document.getElementById('uPwdConfirm').value = '';
            document.getElementById('pwdStrength').innerText = '密碼強度: -';
            document.getElementById('pwdHint').innerText = '(選填，留空則使用預設密碼 Aa123456)';
            document.getElementById('uRole').value = 'viewer';
        } else {
            var userList = window.userList || [];
            var u = userList.find(function (x) { return x.id === id; }) || {};
            t.innerText = '編輯';
            document.getElementById('targetUserId').value = u.id || '';
            document.getElementById('uName').value = u.name || '';
            e.value = u.username || '';
            e.disabled = false;
            document.getElementById('uPwd').value = '';
            document.getElementById('uPwdConfirm').value = '';
            document.getElementById('pwdHint').innerText = '(留空不改)';
            document.getElementById('pwdStrength').innerText = '密碼強度: -';
            document.getElementById('uRole').value = u.role || 'viewer';
            if (Array.isArray(u.groupIds)) groupIds = groupIds.concat(u.groupIds);
        }
        await ensureGroupsForUserModalLoaded();
        renderUserGroupsCheckboxes(groupIds);
        m.classList.add('open');
    }
    window.openUserModal = openUserModal;

    async function submitUser() {
        var id = (document.getElementById('targetUserId') || {}).value;
        var name = (document.getElementById('uName') || {}).value;
        var email = (document.getElementById('uEmail') || {}).value;
        var pwd = (document.getElementById('uPwd') || {}).value;
        var pwdConfirm = (document.getElementById('uPwdConfirm') || {}).value;
        var role = (document.getElementById('uRole') || {}).value;
        var groupIds = Array.from(document.querySelectorAll('#uGroupsBox .uGroupCheck:checked'))
            .map(function (cb) { return parseInt(cb.value, 10); })
            .filter(function (n) { return Number.isFinite(n); });
        if (!id) {
            if (!email) return window.showToast('請輸入帳號', 'error');
            // 密碼選填：留空則使用預設密碼 Aa123456，使用者首次登入後須自行更改
            if (pwd) {
                if (pwd !== pwdConfirm) return window.showToast('密碼與確認密碼不符', 'error');
                var validation = window.validatePasswordFrontend ? window.validatePasswordFrontend(pwd) : { valid: true };
                if (!validation.valid) return window.showToast(validation.message || '密碼不符合規定', 'error');
            }
            var payload = { username: email, name: name, role: role, groupIds: groupIds };
            if (pwd) payload.password = pwd;
            var res = await window.apiFetch('/api/users', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            var j = await res.json().catch(function () { return {}; });
            if (res.ok) {
                window.showToast('新增成功');
                document.getElementById('userModal').classList.remove('open');
                loadUsersPage(1);
            } else {
                window.showToast(j.error || '新增失敗', 'error');
            }
        } else {
            if (!email) return window.showToast('請輸入帳號', 'error');
            var payload = { name: name, username: email, role: role, groupIds: groupIds };
            if (pwd) {
                if (pwd !== pwdConfirm) return window.showToast('密碼與確認密碼不符', 'error');
                var validation = window.validatePasswordFrontend ? window.validatePasswordFrontend(pwd) : { valid: true };
                if (!validation.valid) return window.showToast(validation.message || '密碼不符合規定', 'error');
                payload.password = pwd;
            }
            var res = await window.apiFetch('/api/users/' + id, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            var j = await res.json().catch(function () { return {}; });
            if (res.ok) {
                window.showToast('更新成功');
                document.getElementById('userModal').classList.remove('open');
                loadUsersPage(window.usersPage || 1);
            } else {
                window.showToast(j.error || '更新失敗', 'error');
            }
        }
    }
    window.submitUser = submitUser;

    async function toggleUserDisable(id) {
        var userList = window.userList || [];
        var u = userList.find(function (x) { return x.id === id; });
        var action = u && u.isDisabled === true ? '啟用' : '停用';
        var confirmed = await window.showConfirmModal('確定要' + action + '此帳號嗎？', '確定' + action, '取消');
        if (!confirmed) return;
        try {
            var res = await window.apiFetch('/api/users/' + id + '/disable', { method: 'PATCH' });
            var data = await res.json().catch(function () { return {}; });
            if (res.ok) {
                window.showToast(action + '成功');
                loadUsersPage(window.usersPage || 1);
            } else {
                window.showToast(data.error || action + '失敗', 'error');
            }
        } catch (e) {
            window.showToast('連線錯誤', 'error');
        }
    }
    window.toggleUserDisable = toggleUserDisable;

    async function deleteUser(id) {
        var confirmed = await window.showConfirmModal('確定要刪除此帳號嗎？\n\n此操作無法復原！', '確定刪除', '取消');
        if (!confirmed) return;
        try {
            var res = await window.apiFetch('/api/users/' + id, { method: 'DELETE' });
            var data = await res.json().catch(function () { return {}; });
            if (res.ok) {
                window.showToast('刪除成功');
                loadUsersPage(1);
            } else {
                window.showToast(data.error || '刪除失敗', 'error');
            }
        } catch (e) {
            window.showToast('刪除失敗: ' + e.message, 'error');
        }
    }
    window.deleteUser = deleteUser;

    async function resetUserPassword(userId) {
        var userList = window.userList || [];
        var u = userList.find(function (x) { return parseInt(x.id, 10) === parseInt(userId, 10); });
        var info = u ? (u.name || '-') + '（' + (u.username || '-') + '）' : 'ID: ' + userId;
        var confirmed = await window.showConfirmModal('確定要將使用者「' + info + '」的密碼重置為初始密碼 Aa123456 嗎？\n\n該使用者下次登入時須修改密碼。', '確定重置', '取消');
        if (!confirmed) return;
        try {
            var res = await window.apiFetch('/api/admin/users/' + userId + '/reset-password', { method: 'POST' });
            var data = await res.json().catch(function () { return {}; });
            if (res.ok) {
                window.showToast('密碼已重置為 Aa123456，該使用者下次登入時須修改密碼', 'success');
            } else {
                window.showToast(data.error || '重置失敗', 'error');
            }
        } catch (e) {
            window.showToast('重置失敗: ' + e.message, 'error');
        }
    }
    window.resetUserPassword = resetUserPassword;

    async function exportUsers() {
        try {
            window.showToast('準備匯出中，請稍候...', 'info');
            var res = await fetch('/api/users?page=1&pageSize=10000', { credentials: 'include' });
            if (!res.ok) throw new Error('取得帳號資料失敗');
            var json = await res.json();
            var users = json.data || [];
            if (users.length === 0) return window.showToast('無帳號資料可匯出', 'error');
            var formatRadio = document.querySelector('input[name="userExportFormat"]:checked');
            var format = formatRadio ? formatRadio.value : 'csv';
            if (format === 'json') {
                var blob = new Blob([JSON.stringify(users, null, 2)], { type: 'application/json' });
                var link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'Users_Backup_' + new Date().toISOString().slice(0, 10) + '.json';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.showToast('JSON 匯出完成', 'success');
            } else {
                var csvContent = '\uFEFF';
                csvContent += '姓名,帳號,權限,建立時間\n';
                users.forEach(function (user) {
                    var clean = function (t) { return '"' + String(t || '').replace(/"/g, '""').trim() + '"'; };
                    csvContent += clean(user.name) + ',' + clean(user.username) + ',' + clean(user.role) + ',' + clean(new Date(user.created_at).toLocaleString('zh-TW')) + '\n';
                });
                var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                var link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'Users_' + new Date().toISOString().slice(0, 10) + '.csv';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.showToast('CSV 匯出完成', 'success');
            }
        } catch (e) {
            window.showToast('匯出失敗: ' + e.message, 'error');
        }
    }
    window.exportUsers = exportUsers;

    function usersSortBy(field) {
        if (window.usersSortField === field) {
            window.usersSortDir = window.usersSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            window.usersSortField = field;
            window.usersSortDir = 'asc';
        }
        saveUsersViewState();
        loadUsersPage(1);
    }
    window.usersSortBy = usersSortBy;

    function saveLogsViewState() {
        var state = {
            search: (document.getElementById('loginSearch') && document.getElementById('loginSearch').value) || '',
            page: window.logsPage,
            pageSize: window.logsPageSize
        };
        sessionStorage.setItem('logsViewState', JSON.stringify(state));
    }

    function restoreLogsViewState() {
        var saved = sessionStorage.getItem('logsViewState');
        if (!saved) return;
        try {
            var state = JSON.parse(saved);
            if (document.getElementById('loginSearch')) document.getElementById('loginSearch').value = state.search || '';
            if (state.page) window.logsPage = state.page;
            if (state.pageSize) window.logsPageSize = state.pageSize;
        } catch (e) {}
    }

    async function loadLogsPage(page) {
        page = page || 1;
        var loginSearchEl = document.getElementById('loginSearch');
        if (!loginSearchEl) return;
        window.logsPage = page;
        var q = loginSearchEl.value || '';
        saveLogsViewState();
        var params = new URLSearchParams({ page: window.logsPage, pageSize: window.logsPageSize, q: q, _t: Date.now() });
        var logsLoadingEl = document.getElementById('logsLoading');
        if (logsLoadingEl) logsLoadingEl.style.display = 'block';
        try {
            var res = await window.apiFetch('/api/admin/logs?' + params.toString());
            if (!res.ok) {
                window.showToast('載入登入紀錄失敗', 'error');
                return;
            }
            var j = await res.json();
            window.currentLogs = window.currentLogs || { login: [], action: [] };
            window.currentLogs.login = j.data || [];
            window.logsTotal = j.total || 0;
            window.logsPages = j.pages || 1;
            var logsTableBody = document.getElementById('logsTableBody');
            if (logsTableBody) {
                logsTableBody.innerHTML = (window.currentLogs.login || []).map(function (l) {
                    return '<tr><td data-label="時間" style="padding:12px;">' + new Date(l.login_time).toLocaleString('zh-TW') + '</td><td data-label="帳號">' + (l.username || '') + '</td><td data-label="IP">' + (l.ip_address || '-') + '</td></tr>';
                }).join('');
            }
            if (typeof window.renderPagination === 'function') {
                window.renderPagination('logsPagination', window.logsPage, window.logsPages, 'loadLogsPage');
            }
        } catch (e) {
            window.showToast('載入登入紀錄錯誤', 'error');
        } finally {
            if (logsLoadingEl) logsLoadingEl.style.display = 'none';
        }
    }
    window.loadLogsPage = loadLogsPage;

    function saveActionsViewState() {
        var state = {
            search: (document.getElementById('actionSearch') && document.getElementById('actionSearch').value) || '',
            page: window.actionsPage,
            pageSize: window.actionsPageSize
        };
        sessionStorage.setItem('actionsViewState', JSON.stringify(state));
    }

    function restoreActionsViewState() {
        var saved = sessionStorage.getItem('actionsViewState');
        if (!saved) return;
        try {
            var state = JSON.parse(saved);
            if (document.getElementById('actionSearch')) document.getElementById('actionSearch').value = state.search || '';
            if (state.page) window.actionsPage = state.page;
            if (state.pageSize) window.actionsPageSize = state.pageSize;
        } catch (e) {}
    }

    async function loadActionsPage(page) {
        page = page || 1;
        var actionSearchEl = document.getElementById('actionSearch');
        if (!actionSearchEl) return;
        window.actionsPage = page;
        var q = actionSearchEl.value || '';
        saveActionsViewState();
        var params = new URLSearchParams({ page: window.actionsPage, pageSize: window.actionsPageSize, q: q, _t: Date.now() });
        var logsLoadingEl = document.getElementById('logsLoading');
        if (logsLoadingEl) logsLoadingEl.style.display = 'block';
        try {
            var res = await window.apiFetch('/api/admin/action_logs?' + params.toString());
            if (!res.ok) {
                window.showToast('載入操作紀錄失敗', 'error');
                return;
            }
            var j = await res.json();
            window.currentLogs = window.currentLogs || { login: [], action: [] };
            window.currentLogs.action = j.data || [];
            window.actionsTotal = j.total || 0;
            window.actionsPages = j.pages || 1;
            var actionsTableBody = document.getElementById('actionsTableBody');
            if (actionsTableBody) {
                var escapeHtml = window.escapeHtml || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
                actionsTableBody.innerHTML = (window.currentLogs.action || []).map(function (l) {
                    return '<tr><td data-label="時間" style="padding:12px;white-space:nowrap;">' + new Date(l.created_at).toLocaleString('zh-TW') + '</td><td data-label="帳號">' + (l.username || '') + '</td><td data-label="動作"><span class="badge new">' + (l.action || '') + '</span></td><td data-label="詳細內容"><div style="font-size:12px;color:#666;">' + escapeHtml(l.details || '') + '</div></td></tr>';
                }).join('');
            }
            if (typeof window.renderPagination === 'function') {
                window.renderPagination('actionsPagination', window.actionsPage, window.actionsPages, 'loadActionsPage');
            }
        } catch (e) {
            window.showToast('載入操作紀錄錯誤', 'error');
        } finally {
            if (logsLoadingEl) logsLoadingEl.style.display = 'none';
        }
    }
    window.loadActionsPage = loadActionsPage;

    function exportLogs(type) {
        var data = type === 'login' ? (window.currentLogs && window.currentLogs.login) : (window.currentLogs && window.currentLogs.action);
        if (!data || data.length === 0) {
            window.showToast('無資料可匯出', 'error');
            return;
        }
        var csvContent = '\uFEFF';
        if (type === 'login') {
            csvContent += '時間,帳號,IP位址\n';
            data.forEach(function (row) {
                csvContent += '"' + new Date(row.login_time).toLocaleString('zh-TW') + '","' + (row.username || '') + '","' + (row.ip_address || '') + '"\n';
            });
        } else {
            csvContent += '時間,帳號,動作,詳細內容\n';
            data.forEach(function (row) {
                csvContent += '"' + new Date(row.created_at).toLocaleString('zh-TW') + '","' + (row.username || '') + '","' + (row.action || '') + '","' + (row.details || '').replace(/"/g, '""') + '"\n';
            });
        }
        var link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })));
        link.setAttribute('download', type + '_logs_' + new Date().toISOString().slice(0, 10) + '.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    window.exportLogs = exportLogs;

    async function deleteLogsFromDB(type) {
        var daysSelect = document.getElementById(type === 'login' ? 'loginCleanupDays' : 'actionCleanupDays');
        var customDaysInput = document.getElementById(type === 'login' ? 'loginCustomDays' : 'actionCustomDays');
        var logTypeName = type === 'login' ? '登入' : '操作';
        if (daysSelect.value === 'all') {
            var confirmed = await window.showConfirmModal('確定要刪除資料庫中所有「' + logTypeName + '」紀錄嗎？\n\n此動作無法復原！', '確定刪除', '取消');
            if (!confirmed) return;
            var endpoint = type === 'login' ? '/api/admin/logs' : '/api/admin/action_logs';
            try {
                var res = await window.apiFetch(endpoint, { method: 'DELETE' });
                if (res.ok) {
                    window.showToast('資料庫記錄已全部刪除');
                    if (type === 'login') loadLogsPage(1);
                    else loadActionsPage(1);
                } else {
                    window.showToast('刪除失敗', 'error');
                }
            } catch (e) {
                window.showToast('Error: ' + e.message, 'error');
            }
            return;
        }
        var days = parseInt(daysSelect.value, 10);
        if (daysSelect.value === 'custom') {
            days = parseInt(customDaysInput.value, 10);
            if (!days || days < 1) {
                window.showToast('請輸入有效的保留天數（至少1天）', 'error');
                return;
            }
        }
        var confirmed2 = await window.showConfirmModal('確定要刪除資料庫中 ' + days + ' 天前的「' + logTypeName + '」紀錄嗎？\n\n將保留最近 ' + days + ' 天的記錄，刪除更早的記錄。\n\n此動作無法復原！', '確定刪除', '取消');
        if (!confirmed2) return;
        var endpoint2 = type === 'login' ? '/api/admin/logs/cleanup' : '/api/admin/action_logs/cleanup';
        try {
            var res2 = await window.apiFetch(endpoint2, {
                method: 'POST',
                body: JSON.stringify({ days: days })
            });
            var data = await res2.json();
            if (res2.ok) {
                window.showToast('已刪除資料庫中 ' + (data.deleted || 0) + ' 筆 ' + days + ' 天前的' + logTypeName + '紀錄');
                if (type === 'login') loadLogsPage(1);
                else loadActionsPage(1);
            } else {
                window.showToast(data.error || '刪除失敗', 'error');
            }
        } catch (e) {
            window.showToast('Error: ' + e.message, 'error');
        }
    }
    window.deleteLogsFromDB = deleteLogsFromDB;

    function setupCleanupDaysSelect() {
        var loginSelect = document.getElementById('loginCleanupDays');
        var actionSelect = document.getElementById('actionCleanupDays');
        var loginCustom = document.getElementById('loginCustomDays');
        var actionCustom = document.getElementById('actionCustomDays');
        if (loginSelect) {
            loginSelect.removeEventListener('change', loginSelect._cleanupHandler);
            loginSelect._cleanupHandler = function () {
                if (loginCustom) loginCustom.classList.toggle('hidden', this.value !== 'custom');
                if (this.value !== 'custom' && loginCustom) loginCustom.value = '';
            };
            loginSelect.addEventListener('change', loginSelect._cleanupHandler);
        }
        if (actionSelect) {
            actionSelect.removeEventListener('change', actionSelect._cleanupHandler);
            actionSelect._cleanupHandler = function () {
                if (actionCustom) actionCustom.classList.toggle('hidden', this.value !== 'custom');
                if (this.value !== 'custom' && actionCustom) actionCustom.value = '';
            };
            actionSelect.addEventListener('change', actionSelect._cleanupHandler);
        }
    }
    window.setupCleanupDaysSelect = setupCleanupDaysSelect;

    function switchAdminTab(tab) {
        if (tab === 'import-export') tab = 'users';
        sessionStorage.setItem('currentAdminTab', tab);
        sessionStorage.setItem('currentUsersTab', tab);
        saveUsersViewState();
        document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        if (typeof event !== 'undefined' && event && event.target) {
            event.target.classList.add('active');
        } else {
            document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
                if (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf("'" + tab + "'") >= 0) {
                    btn.classList.add('active');
                }
            });
        }
        var tabUsers = document.getElementById('tab-users');
        var tabImportExport = document.getElementById('tab-import-export');
        var tabLogs = document.getElementById('tab-logs');
        var tabActions = document.getElementById('tab-actions');
        var tabSystem = document.getElementById('tab-system');
        if (tabUsers) tabUsers.classList.toggle('hidden', tab !== 'users');
        if (tabImportExport) tabImportExport.classList.toggle('hidden', tab !== 'import-export');
        if (tabLogs) tabLogs.classList.toggle('hidden', tab !== 'logs');
        if (tabActions) tabActions.classList.toggle('hidden', tab !== 'actions');
        if (tabSystem) tabSystem.classList.toggle('hidden', tab !== 'system');
        if (tab === 'logs') {
            restoreLogsViewState();
            loadLogsPage(window.logsPage || 1);
        }
        if (tab === 'actions') {
            restoreActionsViewState();
            loadActionsPage(window.actionsPage || 1);
        }
        if (tab === 'users') {
            loadUsersPage(window.usersPage || 1);
            setTimeout(function () {
                try { if (typeof window.loadGroupsAdmin === 'function') window.loadGroupsAdmin(); } catch (e) {}
            }, 50);
        }
        if (tab === 'system') {
            setTimeout(function () {
                try { if (typeof window.setupAdminElements === 'function') window.setupAdminElements(); } catch (e) {}
                try { if (typeof window.setupExportOptions === 'function') window.setupExportOptions(); } catch (e) {}
            }, 50);
        }
    }
    window.switchAdminTab = switchAdminTab;
})();
