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
    default: 'bg-surface rounded-2xl shadow-sm border border-gray-200/80 dark:border-gray-700/70',
    hover: 'bg-surface rounded-2xl shadow-sm border border-gray-200/80 dark:border-gray-700/70 hover:shadow-md hover:border-brand-300 dark:hover:border-brand-600 transition-[border-color,box-shadow] duration-200 cursor-pointer',
    bordered: 'bg-surface rounded-2xl border border-gray-300 dark:border-gray-600',
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
