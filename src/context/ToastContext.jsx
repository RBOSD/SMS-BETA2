import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div id="toast-container" className="toast-container" style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type} show`}>
            <div className="toast-icon">
              {t.type === 'success' ? '✅' : t.type === 'warning' ? '⚠️' : t.type === 'info' ? 'ℹ️' : '❌'}
            </div>
            <div className="toast-content">
              <div className="toast-title">
                {t.type === 'success' ? '成功' : t.type === 'warning' ? '警告' : t.type === 'info' ? '資訊' : '錯誤'}
              </div>
              <div className="toast-msg">{t.message}</div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx?.showToast || (() => {});
}
