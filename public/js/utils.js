/**
 * 工具函數：escapeHtml、getKindLabel、getStatusBadge、validateDateFormat、parsePlanValue
 * 依賴：core.js (showToast)
 */
(function () {
    'use strict';

    function getKindLabel(kindCode) {
        if (!kindCode) return '';
        var labels = {
            'N': '<span class="kind-tag N">缺失</span>',
            'O': '<span class="kind-tag O">觀察</span>',
            'R': '<span class="kind-tag R">建議</span>'
        };
        return labels[kindCode] || '';
    }
    window.getKindLabel = getKindLabel;

    function getStatusBadge(status) {
        if (!status || status === 'Open') return '';
        var statusClass = status === '持續列管' ? 'active' : (status === '解除列管' ? 'resolved' : 'self');
        return '<span class="badge ' + statusClass + '">' + status + '</span>';
    }
    window.getStatusBadge = getStatusBadge;

    function validateDateFormat(dateStr, fieldName) {
        fieldName = fieldName || '日期';
        if (!dateStr || !/^\d{6,7}$/.test(dateStr)) {
            if (typeof window.showToast === 'function') {
                window.showToast(fieldName + '格式錯誤，應為6或7位數字（例如：1130601 或 1141001）', 'error');
            }
            return false;
        }
        return true;
    }
    window.validateDateFormat = validateDateFormat;

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    window.escapeHtml = escapeHtml;

    function parsePlanValue(value) {
        if (!value) return { name: '', year: '' };
        if (value.indexOf('|||') >= 0) {
            var parts = value.split('|||');
            return { name: parts[0] || '', year: parts[1] || '' };
        }
        return { name: value, year: '' };
    }
    window.parsePlanValue = parsePlanValue;

    function validatePasswordFrontend(password) {
        if (!password || password.length < 8) {
            return { valid: false, message: '密碼至少需要 8 個字元' };
        }
        if (!/[A-Z]/.test(password)) {
            return { valid: false, message: '密碼必須包含至少一個大寫字母' };
        }
        if (!/[a-z]/.test(password)) {
            return { valid: false, message: '密碼必須包含至少一個小寫字母' };
        }
        if (!/[0-9]/.test(password)) {
            return { valid: false, message: '密碼必須包含至少一個數字' };
        }
        return { valid: true };
    }
    window.validatePasswordFrontend = validatePasswordFrontend;
})();
