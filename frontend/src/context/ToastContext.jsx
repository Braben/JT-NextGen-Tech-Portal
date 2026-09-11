import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

let toastId = 0;
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message, type) => addToast(message, type), [addToast]);

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      <div className="fixed inset-x-4 top-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none sm:inset-x-auto sm:right-4">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto animate-slide-in-right w-full max-w-sm px-4 py-3 rounded-lg shadow-lg border text-sm font-medium flex items-start gap-2 ${t.type === 'success' ? 'bg-green-600 text-white border-green-700' : t.type === 'error' ? 'bg-red-600 text-white border-red-700' : t.type === 'warning' ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-gray-800 text-white border-gray-700'}`}>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="text-white/70 hover:text-white flex-shrink-0" aria-label="Dismiss">&times;</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
