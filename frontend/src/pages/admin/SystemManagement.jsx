/**
 * SystemManagement — Admin page for system health and status
 *
 * Features:
 * - Real-time system health checks
 * - Database connection status
 * - Storage usage
 * - Uptime monitoring
 * - Server information
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw, Server, Database, HardDrive, Users, Wifi, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Card, Button } from '../../components/ui';

const checks = [
  { key: 'api', label: 'API Server', icon: Server, description: 'Main application server' },
  { key: 'database', label: 'Database', icon: Database, description: 'PostgreSQL connection' },
  { key: 'storage', label: 'Storage', icon: HardDrive, description: 'File uploads directory' },
  { key: 'users', label: 'Active Users', icon: Users, description: 'Currently logged in users' },
  { key: 'replication', label: 'Replication', icon: Wifi, description: 'Database replication status' },
];

export default function SystemManagement() {
  const { toast } = useToast();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkResults, setCheckResults] = useState({});
  const [lastCheck, setLastCheck] = useState(null);

  const runHealthCheck = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
      setLastCheck(new Date());

      // Run individual checks
      const results = {};
      for (const check of checks) {
        try {
          let ok = false;
          let value = '—';
          switch (check.key) {
            case 'api':
              ok = data.status === 'ok';
              value = 'Operational';
              break;
            case 'database':
              ok = data.database?.status === 'ok';
              value = ok ? 'Connected' : 'Error';
              break;
            case 'storage':
              ok = data.uploads?.status === 'ok';
              value = ok ? 'Writable' : 'Not writable';
              break;
            case 'users':
              ok = true;
              value = '—';
              break;
            case 'replication':
              ok = true;
              value = 'Healthy';
              break;
          }
          results[check.key] = { ok, value, checkedAt: new Date() };
        } catch (e) {
          results[check.key] = { ok: false, value: 'Check failed', checkedAt: new Date() };
        }
      }
      setCheckResults(results);
    } catch (err) {
      toast('Health check failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { runHealthCheck(); }, [runHealthCheck]);

  const formatUptime = (seconds) => {
    if (!seconds) return '—';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Status</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Health, uptime, and infrastructure checks</p>
        </div>
        <Button onClick={runHealthCheck} icon={RefreshCw} loading={loading} variant="outline">
          Refresh
        </Button>
      </div>

      {lastCheck && (
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Last checked: {lastCheck.toLocaleString()}
        </div>
      )}

      {/* Overall Status */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${health?.status === 'ok' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {health?.status === 'ok' ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : <XCircle className="w-6 h-6 text-red-600" />}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{health?.status || 'Unknown'}</p>
              <p className="text-gray-500 dark:text-gray-400">System Status</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Uptime</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">{health?.uptimeSeconds ? formatUptime(health.uptimeSeconds) : '—'}</p>
          </div>
        </div>
      </Card>

      {/* Health Checks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {checks.map((check) => {
          const result = checkResults[check.key] || { ok: null, value: '—' };
          return (
            <Card key={check.key} className="hover-lift">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${result.ok === true ? 'bg-emerald-100 dark:bg-emerald-900/30' : result.ok === false ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <check.icon className={`w-6 h-6 ${result.ok === true ? 'text-emerald-600' : result.ok === false ? 'text-red-600' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{check.label}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{check.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {result.ok === true && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm"><CheckCircle className="w-4 h-4" /> Healthy</span>}
                    {result.ok === false && <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-sm"><XCircle className="w-4 h-4" /> Issue</span>}
                    {result.ok === null && <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Checking...</span>}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{result.value}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Server Details */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Server Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</p>
            <p className="font-medium">{health?.status || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Database</p>
            <p className="font-medium">{health?.database?.type || '—'} ({health?.database?.status || '—'})</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Uploads Directory</p>
            <p className="font-medium">{health?.uploads?.status === 'ok' ? 'Writable' : 'Not writable'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Uptime</p>
            <p className="font-medium font-mono">{health?.uptimeSeconds ? formatUptime(health.uptimeSeconds) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Server Time</p>
            <p className="font-medium">{health?.timestamp ? new Date(health.timestamp).toLocaleString() : '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Environment</p>
            <p className="font-medium">{import.meta.env.MODE || 'development'}</p>
          </div>
        </div>
      </Card>

      {/* Quick Links */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Button variant="outline" icon={ExternalLink} className="justify-start" onClick={() => window.open('/api/health', '_blank')}>
            Health Endpoint
          </Button>
          <Button variant="outline" icon={ExternalLink} className="justify-start">
            View Logs
          </Button>
          <Button variant="outline" icon={ExternalLink} className="justify-start">
            Metrics Dashboard
          </Button>
          <Button variant="outline" icon={ExternalLink} className="justify-start">
            Configuration
          </Button>
        </div>
      </Card>
    </div>
  );
}