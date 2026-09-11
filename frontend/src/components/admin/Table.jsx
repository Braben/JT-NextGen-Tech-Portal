import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, ChevronRight, Inbox } from 'lucide-react';

export default function DataTable({
  columns,
  data,
  keyField = 'id',
  loading = false,
  emptyMessage = 'No data available',
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
  className = '',
  stickyHeader = true,
  rowActions,
  pagination,
  onPageChange,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
}) {
  const [sortConfig, setSortConfig] = useState({ key: sortBy, order: sortOrder });

  const handleSort = (key) => {
    if (!onSort) return;
    let order = 'asc';
    if (sortConfig.key === key && sortConfig.order === 'asc') {
      order = 'desc';
    }
    setSortConfig({ key, order });
    onSort(key, order);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectionChange?.(data.map((row) => row[keyField]));
    } else {
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (id, e) => {
    e.stopPropagation();
    if (selectedRows.includes(id)) {
      onSelectionChange?.(selectedRows.filter((r) => r !== id));
    } else {
      onSelectionChange?.([...selectedRows, id]);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full" role="grid">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {columns.map((col) => (
                  <th key={col.key} className="text-left py-3 px-4">
                    <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800 animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="py-3 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <Inbox className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-0 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm" role="grid">
        <thead className={`${stickyHeader ? 'sticky top-0' : ''} bg-white dark:bg-gray-800`}>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {selectable && (
              <th className="text-center py-3 px-4 w-12">
                <input
                  type="checkbox"
                  ref={(el) => { if (el) el.indeterminate = selectedRows.length > 0 && selectedRows.length < data.length; }}
                  checked={selectedRows.length === data.length && data.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-3 px-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs ${col.sortable ? 'cursor-pointer hover:text-gray-900 dark:hover:text-white select-none' : ''} ${col.align ? `text-${col.align}` : ''}`}
                onClick={() => col.sortable && handleSort(col.key)}
                style={{ width: col.width }}
                aria-sort={sortConfig.key === col.key ? (sortConfig.order === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-1">
                  <span>{col.label}</span>
                  {col.sortable && sortConfig.key === col.key && (
                    <span className="inline-flex">
                      {sortConfig.order === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  )}
                </div>
              </th>
            ))}
            {rowActions && <th className="text-center py-3 px-4 w-24">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((row, rowIndex) => (
            <motion.tr
              key={row[keyField]}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: rowIndex * 0.05 }}
              className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${onRowClick ? 'cursor-pointer' : ''} ${selectedRows.includes(row[keyField]) ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {selectable && (
                <td className="py-3 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(row[keyField])}
                    onChange={(e) => handleSelectRow(row[keyField], e)}
                    className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    aria-label={`Select row ${rowIndex + 1}`}
                  />
                </td>
              )}
              {columns.map((col) => (
                <td key={col.key} className={`py-3 px-4 ${col.align ? `text-${col.align}` : ''}`}>
                  {col.render ? col.render(row, rowIndex) : row[col.key]}
                </td>
              ))}
              {rowActions && (
                <td className="py-3 px-4 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {rowActions.map((action) => (
                      <button
                        key={action.key}
                        onClick={(e) => { e.stopPropagation(); action.onClick(row); }}
                        className={`p-1.5 rounded text-xs font-medium transition-colors ${action.variant === 'danger' ? 'text-red-600 hover:bg-red-50' : action.variant === 'primary' ? 'text-brand-600 hover:bg-brand-50' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                        disabled={action.disabled?.(row)}
                        aria-label={`${action.label} for ${row[keyField]}`}
                      >
                        {action.icon && <action.icon className="w-4 h-4" />}
                        {action.label && <span className="ml-1">{action.label}</span>}
                      </button>
                    ))}
                  </div>
                </td>
              )}
            </motion.tr>
          ))}
        </tbody>
      </table>
      </div>

      {pagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {pagination.total === 0 ? 'No results' : `Showing ${(pagination.page - 1) * pagination.pageSize + 1} to ${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 -rotate-180" />
            </button>
            <span className="px-3 text-sm text-gray-700 dark:text-gray-200">
              Page {pagination.page} of {Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}
            </span>
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
