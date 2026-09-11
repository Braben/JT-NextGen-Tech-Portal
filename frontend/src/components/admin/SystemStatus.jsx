import { motion } from 'framer-motion';
import { Server, Database, Users, HardDrive, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';

export default function SystemStatus({ status = {}, loading = false }) {
  const checks = [
    { key: 'uptime', label: 'System Uptime', icon: Server, value: status.uptime || '—', ok: true },
    { key: 'database', label: 'Database', icon: Database, value: status.database?.status === 'ok' ? 'Connected' : 'Error', ok: status.database?.status === 'ok' },
    { key: 'storage', label: 'Storage Usage', icon: HardDrive, value: status.storage || '—', ok: true },
    { key: 'activeUsers', label: 'Active Users', icon: Users, value: status.activeUsers || '—', ok: true },
    { key: 'api', label: 'API Status', icon: Wifi, value: status.api || 'Operational', ok: status.api === 'Operational' },
    { key: 'replication', label: 'Replication', icon: Database, value: status.replication || 'Healthy', ok: status.replication === 'Healthy' },
  ];

  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Status</h3>
        <div className="space-y-3">
          {checks.map((c) => (
            <div key={c.key} className="flex items-center justify-between py-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div>
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
                </div>
              </div>
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded text-right" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Status</h3>
      <div className="space-y-3">
        {checks.map((check, index) => (
          <motion.div
            key={check.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <check.icon className="w-4 h-4 text-gray-600 dark:text-gray-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{check.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{check.value}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${check.ok ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
              <span className={`text-xs font-medium ${check.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {check.ok ? 'Healthy' : 'Issue'}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
        <button className="text-sm text-brand-600 hover:text-brand-700 font-medium">View detailed metrics</button>
      </div>
    </div>
  );
}