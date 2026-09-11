/**
 * SecurityManagement — Admin page for security monitoring
 *
 * Features:
 * - Login attempts monitoring
 * - Failed login tracking
 * - Brute force detection
 * - IP-based filtering
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Loader2, Shield, AlertTriangle, CheckCircle, XCircle, Download } from 'lucide-react';
import { adminAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/admin/Table';
import { Card, Button, Select } from '../../components/ui';

export default function SecurityManagement() {
  const { toast } = useToast();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getLoginAttempts({ limit: 500 });
      setAttempts(res.data?.attempts || []);
    } catch (err) {
      toast('Failed to load security data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = {
    total: attempts.length,
    failed: attempts.filter(a => !a.success).length,
    successful: attempts.filter(a => a.success).length,
    uniqueIPs: new Set(attempts.map(a => a.ip)).size,
    failedLastHour: attempts.filter(a => !a.success && new Date(a.created_at) > new Date(Date.now() - 3600000)).length,
  };

  const columns = [
    { key: 'email', label: 'Email', sortable: true },
    { key: 'ip', label: 'IP Address', sortable: true },
    {
      key: 'success',
      label: 'Result',
      align: 'center',
      sortable: true,
      render: (row) => row.success ? (
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle className="w-4 h-4" /> Success</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><XCircle className="w-4 h-4" /> Failed</span>
      ),
    },
    { key: 'created_at', label: 'Time', align: 'center', sortable: true, render: (row) => <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(row.created_at).toLocaleString()}</span> },
  ];

  const filteredAttempts = attempts.filter((a) =>
    (a.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     a.ip?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!statusFilter || (statusFilter === 'success' ? a.success : !a.success)) &&
    (!ipFilter || a.ip === ipFilter)
  );

  const uniqueIPs = [...new Set(attempts.map(a => a.ip).filter(Boolean))];
  const statusOptions = [{ value: '', label: 'All' }, { value: 'success', label: 'Successful' }, { value: 'failed', label: 'Failed' }];
  const ipOptions = [{ value: '', label: 'All IPs' }, ...uniqueIPs.map(ip => ({ value: ip, label: ip }))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Monitor</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor login activity and security threats</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Attempts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Failed (1hr)</p>
              <p className="text-2xl font-bold text-red-600">{stats.failedLastHour}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Failed Total</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center"><XCircle className="w-6 h-6 text-orange-600" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Successful</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.successful}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Unique IPs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.uniqueIPs}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"><Shield className="w-6 h-6 text-purple-600" /></div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="card flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input type="search" placeholder="Search by email or IP..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={statusOptions} className="w-full sm:w-40" />
          <Select value={ipFilter} onChange={(e) => setIpFilter(e.target.value)} options={ipOptions} className="w-full sm:w-48" />
        </div>
      </div>

      {/* Attempts Table */}
      <DataTable
        columns={columns}
        data={filteredAttempts}
        keyField="id"
        loading={loading}
        emptyMessage="No login attempts recorded"
        pagination={{ page: 1, pageSize: 20, total: filteredAttempts.length }}
      />
    </div>
  );
}
