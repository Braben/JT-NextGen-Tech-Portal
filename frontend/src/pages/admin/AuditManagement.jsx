/**
 * AuditManagement — Admin page for viewing audit trail
 *
 * Features:
 * - Complete audit log of admin actions
 * - Filter by action type, entity, admin
 * - Search functionality
 * - Export capability
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Loader2, Download, History } from 'lucide-react';
import { adminAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/admin/Table';
import { Card, Button, Select } from '../../components/ui';

const actionColors = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'payment.record': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'grade.manual': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'grade.ai': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export default function AuditManagement() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getAuditLog({ limit: 500 });
      setLogs(res.data || []);
    } catch (err) {
      toast('Failed to load audit log', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      key: 'admin_name',
      label: 'Actor',
      sortable: true,
      render: (row) => (
        <div>
          <span className="block font-medium">{row.admin_name || row.admin_id}</span>
          {row.actor_role && <span className="block text-xs text-gray-500 capitalize">{row.actor_role}</span>}
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      align: 'center',
      sortable: true,
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${actionColors[row.action] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'}`}>
          {row.action.charAt(0).toUpperCase() + row.action.slice(1)}
        </span>
      ),
    },
    { key: 'entity_type', label: 'Entity Type', sortable: true },
    { key: 'entity_id', label: 'Entity ID', render: (row) => row.entity_id ? <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{row.entity_id}</code> : '-' },
    { key: 'details', label: 'Details', render: (row) => <span className="text-gray-500 dark:text-gray-400 truncate max-w-md block">{row.details || '-'}</span> },
    { key: 'created_at', label: 'Time', align: 'center', sortable: true, render: (row) => <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(row.created_at).toLocaleString()}</span> },
  ];

  const filteredLogs = logs.filter((log) =>
    (log.admin_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     log.entity_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     log.details?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!actionFilter || log.action === actionFilter) &&
    (!entityFilter || log.entity_type === entityFilter) &&
    (!adminFilter || log.admin_id === adminFilter)
  );

  const uniqueActions = [...new Set(logs.map(l => l.action).filter(Boolean))];
  const uniqueEntities = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];
  const uniqueAdmins = [...new Set(logs.map(l => l.admin_id).filter(Boolean))];

  const actionOptions = [{ value: '', label: 'All Actions' }, ...uniqueActions.map(a => ({ value: a, label: a.charAt(0).toUpperCase() + a.slice(1) }))];
  const entityOptions = [{ value: '', label: 'All Entities' }, ...uniqueEntities.map(e => ({ value: e, label: e }))];
  const adminOptions = [{ value: '', label: 'All Admins' }, ...uniqueAdmins.map(a => ({ value: a, label: a }))];

  const exportCsv = () => {
    const headers = ['time', 'actor', 'role', 'action', 'entity_type', 'entity_id', 'details'];
    const rows = filteredLogs.map((log) => [
      log.created_at,
      log.admin_name || log.admin_id,
      log.actor_role || '',
      log.action,
      log.entity_type,
      log.entity_id || '',
      log.details || '',
    ]);
    const blob = new Blob([
      [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n'),
    ], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Trail</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">View sensitive staff actions</p>
        </div>
        <Button variant="outline" icon={Download} size="sm" onClick={exportCsv} disabled={!filteredLogs.length}>Export CSV</Button>
      </div>

      <div className="card flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input type="search" placeholder="Search audit log..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} options={actionOptions} className="w-full sm:w-40" />
          <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} options={entityOptions} className="w-full sm:w-40" />
          <Select value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)} options={adminOptions} className="w-full sm:w-48" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredLogs}
        keyField="id"
        loading={loading}
        emptyMessage="No audit records found"
        pagination={{ page: 1, pageSize: 25, total: filteredLogs.length }}
      />
    </div>
  );
}
