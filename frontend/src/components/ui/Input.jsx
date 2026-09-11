/**
 * Input — Reusable form input component with label, error, and helper text
 *
 * Supports all standard HTML input attributes
 * Integrates with form validation libraries
 */

import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full min-w-0">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`
          w-full min-w-0 max-w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800
          text-gray-900 dark:text-white placeholder-gray-400
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-0
          ${error
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-200 dark:border-gray-600 focus:ring-brand-500 focus:border-brand-500'}
          ${props.disabled ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}
          ${className}
        `}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
