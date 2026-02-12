/**
 * 共用 Modal：showPreview、closePreview、showConfirmModal、closeConfirmModal、closeDrawer
 * 依賴：core.js
 */
(function () {
    'use strict';

    var confirmModalResolve = null;
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

    document.addEventListener('DOMContentLoaded', function () {
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
