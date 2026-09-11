/**
 * ConfirmDialog — promise-based in-app confirmation
 *
 * Replaces the native window.confirm() with a styled modal that matches
 * the toast/layout design system. Usage:
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm('Delete this item?', { danger: true });
 *   if (!ok) return;
 *
 * The provider must wrap the app (see App/Layout).
 */

import { createContext, useContext, useState, useCallback } from 'react';

const ConfirmContext = createContext();

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { message, resolve, options }

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setState({ message, resolve, options });
    });
  }, []);

  const handleClose = (result) => {
    if (state) state.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50" onClick={() => handleClose(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 animate-slide-in-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-4 ${state.options?.danger ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-600'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {state.options?.danger ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {state.options?.title || 'Are you sure?'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{state.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => handleClose(false)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={() => handleClose(true)}
                className={`text-sm ${state.options?.danger ? 'btn-danger' : 'btn-primary'}`}
              >
                {state.options?.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);