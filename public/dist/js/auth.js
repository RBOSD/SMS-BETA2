/**
 * 認證相關：logout、個人設定、變更密碼、密碼顯示切換
 * 依賴：core.js (showToast, apiFetch, currentUser), utils.js (validatePasswordFrontend)
 */
(function () {
    'use strict';

    function togglePwdVisibility(inputId, btn) {
        var input = document.getElementById(inputId);
        if (!input || !btn) return;
        if (input.type === 'password') {
            input.type = 'text';
            btn.innerText = '🚫';
        } else {
            input.type = 'password';
            btn.innerText = '👁️';
        }
    }
    window.togglePwdVisibility = togglePwdVisibility;

    function openProfileModal() {
        var nameEl = document.getElementById('myProfileName');
        var pwdEl = document.getElementById('myProfilePwd');
        var modal = document.getElementById('profileModal');
        if (nameEl) nameEl.value = (window.currentUser && window.currentUser.name) || '';
        if (pwdEl) pwdEl.value = '';
        if (modal) modal.classList.add('open');
    }
    window.openProfileModal = openProfileModal;

    async function submitProfile() {
        var nameEl = document.getElementById('myProfileName');
        var pwdEl = document.getElementById('myProfilePwd');
        var pwdConfirmEl = document.getElementById('myProfilePwdConfirm');
        var name = nameEl ? nameEl.value : '';
        var pwd = pwdEl ? pwdEl.value : '';
        var pwdConfirm = pwdConfirmEl ? pwdConfirmEl.value : '';
        try {
            if (pwd) {
                if (!pwdConfirm) {
                    window.showToast('請輸入確認密碼', 'error');
                    return;
                }
                if (pwd !== pwdConfirm) {
                    window.showToast('密碼與確認密碼不符', 'error');
                    return;
                }
                var validation = window.validatePasswordFrontend(pwd);
                if (!validation.valid) {
                    window.showToast(validation.message, 'error');
                    return;
                }
            } else if (pwdConfirm) {
                window.showToast('請輸入新密碼', 'error');
                return;
            }
            var res = await window.apiFetch('/api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify({ name: name, password: pwd })
            });
            if (res.ok) {
                window.showToast('更新成功，請重新登入');
                var modal = document.getElementById('profileModal');
                if (modal) modal.classList.remove('open');
                if (pwdEl) pwdEl.value = '';
                if (pwdConfirmEl) pwdConfirmEl.value = '';
                window.logout();
            } else {
                var j = await res.json().catch(function () { return {}; });
                window.showToast(j.error || '更新失敗', 'error');
            }
        } catch (e) {
            window.showToast('更新失敗', 'error');
        }
    }
    window.submitProfile = submitProfile;

    async function submitChangePassword() {
        var newPwdEl = document.getElementById('changePwdNew');
        var confirmPwdEl = document.getElementById('changePwdConfirm');
        var errorEl = document.getElementById('changePwdError');
        var newPwd = newPwdEl ? newPwdEl.value : '';
        var confirmPwd = confirmPwdEl ? confirmPwdEl.value : '';
        if (errorEl) {
            errorEl.style.display = 'none';
            errorEl.innerText = '';
        }
        if (!newPwd || !confirmPwd) {
            if (errorEl) {
                errorEl.innerText = '請輸入新密碼和確認密碼';
                errorEl.style.display = 'block';
            }
            return;
        }
        if (newPwd !== confirmPwd) {
            if (errorEl) {
                errorEl.innerText = '兩次輸入的密碼不一致';
                errorEl.style.display = 'block';
            }
            return;
        }
        var validation = window.validatePasswordFrontend(newPwd);
        if (!validation.valid) {
            if (errorEl) {
                errorEl.innerText = validation.message;
                errorEl.style.display = 'block';
            }
            return;
        }
        try {
            var res = await window.apiFetch('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ password: newPwd })
            });
            if (res.ok) {
                window.showToast('密碼更新成功，請重新登入', 'success');
                var modal = document.getElementById('changePasswordModal');
                if (modal) modal.style.display = 'none';
                if (newPwdEl) newPwdEl.value = '';
                if (confirmPwdEl) confirmPwdEl.value = '';
                setTimeout(function () {
                    window.logout();
                }, 1000);
            } else {
                var data = await res.json().catch(function () { return {}; });
                if (errorEl) {
                    errorEl.innerText = data.error || '密碼更新失敗';
                    errorEl.style.display = 'block';
                }
            }
        } catch (e) {
            if (errorEl) {
                errorEl.innerText = '連線錯誤，請稍後再試';
                errorEl.style.display = 'block';
            }
        }
    }
    window.submitChangePassword = submitChangePassword;

    function logout() {
        sessionStorage.removeItem('currentView');
        sessionStorage.removeItem('currentDataTab');
        sessionStorage.removeItem('currentUsersTab');
        fetch('/api/auth/logout', { method: 'POST' }).then(function () {
            window.location.reload();
        });
    }
    window.logout = logout;
})();
