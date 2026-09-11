import { motion } from 'framer-motion';
import { UserCheck, Award, Flag, UserPlus, ClipboardCheck, ChevronRight } from 'lucide-react';

const pendingItems = [
  { key: 'enrollments', label: 'Enrollment Approvals', icon: UserCheck, color: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', count: 0, href: '/admin/enrollments?filter=pending' },
  { key: 'aptitudeReviews', label: 'Aptitude Reviews', icon: ClipboardCheck, color: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', count: 0, href: '/admin/enrollments?assessment=submitted' },
  { key: 'certificates', label: 'Certificate Approvals', icon: Award, color: 'bg-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', count: 0, href: '/admin/certificates?filter=pending' },
  { key: 'forumReports', label: 'Forum Reports', icon: Flag, color: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', count: 0, href: '/admin/forums?filter=reports' },
  { key: 'accountRequests', label: 'Account Requests', icon: UserPlus, color: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', count: 0, href: '/admin/users?filter=requests' },
];

export default function PendingActions({ counts = {}, loading = false, onActionClick }) {
  const itemsWithCounts = pendingItems.map((item) => ({
    ...item,
    count: counts[item.key] || 0,
  }));

  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pending Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1">
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pending Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {itemsWithCounts.map((item, index) => (
          <motion.button
            key={item.key}
            onClick={() => onActionClick?.(item)}
            className={`group flex items-center gap-3 p-4 rounded-xl border border-gray-100 dark:border-gray-700 transition-all duration-200 hover:border-gray-200 dark:hover:border-gray-600 ${item.bg} hover:shadow-sm`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            aria-label={`${item.label}, ${item.count} pending`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.color} text-white`}>
              <item.icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.label}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-2xl font-bold ${item.text}`}>{item.count}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">pending</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors`} aria-hidden="true" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
