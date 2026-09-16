/**
 * Select — Reusable select dropdown component
 */

import { forwardRef } from 'react';

const Select = forwardRef(({
  label,
  error,
  helperText,
  options = [],
  className = '',
  id,
  placeholder,
  ...props
}, ref) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full min-w-0">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`
          w-full min-w-0 max-w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900
          text-gray-900 dark:text-white
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-0
          appearance-none
          ${error
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-500 dark:border-gray-500 focus:ring-brand-500 focus:border-brand-500'}
          ${props.disabled ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}
          ${className}
        `}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${selectId}-helper`} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
