/**
 * Card — Reusable card container component
 *
 * Variants: default, hover, bordered
 * Padding: none, sm, md, lg
 */

import { forwardRef } from 'react';

const Card = forwardRef(({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}, ref) => {
  const variantClasses = {
    default: 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700',
    hover: 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-200 cursor-pointer',
    bordered: 'bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div
      ref={ref}
      className={`accent-card min-w-0 max-w-full [overflow-wrap:anywhere] ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;
