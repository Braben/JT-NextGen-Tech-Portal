/**
 * Modal — Accessible modal dialog component with portal rendering
 *
 * Features:
 * - Focus trapping
 * - ESC key to close
 * - Click overlay to close
 * - Animated enter/exit
 * - Portal to body for proper stacking
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  };

  // Only opening/closing may move focus. Inline onClose callbacks change on
  // every form render, including keystrokes, so read the latest one via a ref.
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Focus the modal or first focusable element
      const focusTimer = setTimeout(() => modalRef.current?.focus(), 0);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onCloseRef.current?.();
        if (e.key === 'Tab') trapFocus(e);
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(focusTimer);
        document.body.style.overflow = previousOverflow;
        document.removeEventListener('keydown', handleKeyDown);
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen]);

  // Focus trapping
  const trapFocus = (e) => {
    if (!modalRef.current) return;
    const focusableElements = Array.from(modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [contenteditable="true"], [tabindex]'
    )).filter((element) => !element.disabled && element.tabIndex !== -1 && element.getClientRects().length > 0);
    if (!focusableElements.length) {
      e.preventDefault();
      modalRef.current.focus();
      return;
    }
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && (document.activeElement === firstElement || document.activeElement === modalRef.current)) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto isolate" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4 relative z-10">
            <motion.div
              ref={modalRef}
              tabIndex={-1}
              className={`dashboard-content min-w-0 w-full ${sizeClasses[size]} bg-white dark:bg-gray-800 rounded-xl shadow-2xl transform max-h-[90vh] overflow-y-auto relative`}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              role="document"
            >
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white pr-4">
                {title}
              </h2>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </motion.div>
      </div>
    </div>
      )}
    </AnimatePresence>
  );

  // Render to body portal for proper z-index handling
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return null;
}
