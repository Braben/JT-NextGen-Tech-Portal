/**
 * Button — Reusable button component with multiple variants and states
 *
 * Variants: primary, secondary, danger, outline, ghost
 * Sizes: sm, md, lg
 * States: loading, disabled
 */

import { motion } from 'framer-motion';
import React, { forwardRef } from 'react';

const variantClasses = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/20',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/20',
  outline: 'border-2 border-gray-300 hover:border-brand-500 text-gray-700 dark:border-gray-600 dark:hover:border-brand-500 dark:text-gray-200 bg-transparent',
  ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 bg-transparent',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

function renderIcon(IconProp) {
  if (!IconProp) return null;
  if (React.isValidElement(IconProp)) return IconProp;
  const Icon = IconProp;
  if (typeof Icon === 'function' || typeof Icon === 'object') {
    return <Icon className="w-4 h-4" aria-hidden="true" />;
  }
  return null;
}

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: iconProp,
  iconRight: iconRightProp,
  className = '',
  type = 'button',
  ...props
}, ref) => {
  const isDisabled = disabled || loading;
  const iconNode = renderIcon(iconProp);
  const iconRightNode = renderIcon(iconRightProp);

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`
        inline-flex min-w-0 max-w-full items-center justify-center gap-2 font-medium rounded-lg
        transition-all duration-200 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
        ${isDisabled ? 'cursor-not-allowed' : 'hover:-translate-y-0.5 active:translate-y-0'}
      `}
      whileHover={!isDisabled ? { scale: 1.01 } : {}}
      whileTap={!isDisabled ? { scale: 0.99 } : {}}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : iconNode ? (
        <span aria-hidden="true" className="inline-flex shrink-0">{iconNode}</span>
      ) : null}
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
      {iconRightNode && !loading && <span aria-hidden="true" className="inline-flex shrink-0">{iconRightNode}</span>}
    </motion.button>
  );
});

Button.displayName = 'Button';

export default Button;
