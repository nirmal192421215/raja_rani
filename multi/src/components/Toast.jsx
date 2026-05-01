import { useState, useCallback, createContext, useContext, useRef } from 'react';

// ─── Toast Context ─────────────────────────────────────────────
const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

// Toast types
const ICONS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  money: '💰',
  police: '🔍',
  thief: '🥷',
};

const COLORS = {
  success: '#10B981',
  error:   '#EF4444',
  warning: '#F59E0B',
  info:    '#60A5FA',
  money:   '#D4AF37',
  police:  '#7B2FF7',
  thief:   '#DC2626',
};

// ─── Provider ──────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const toast = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration + 400); // extra time for exit animation
  }, []);

  // Convenience helpers
  toast.success = (msg, d) => toast(msg, 'success', d);
  toast.error   = (msg, d) => toast(msg, 'error', d);
  toast.warning = (msg, d) => toast(msg, 'warning', d);
  toast.info    = (msg, d) => toast(msg, 'info', d);
  toast.money   = (msg, d) => toast(msg, 'money', d);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className="toast"
            style={{ borderLeft: `4px solid ${COLORS[t.type] || COLORS.info}` }}
          >
            <span className="toast-icon">{ICONS[t.type] || ICONS.info}</span>
            <span className="toast-message">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
