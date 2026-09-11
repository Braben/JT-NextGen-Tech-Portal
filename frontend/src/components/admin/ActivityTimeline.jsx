import { motion } from 'framer-motion';
import {
  UserPlus,
  Award,
  FileText,
  GraduationCap,
  HelpCircle,
  Shield,
  Settings,
  TrendingUp,
} from 'lucide-react';

const activityIcons = {
  user_registered: UserPlus,
  certificate_approved: Award,
  material_uploaded: FileText,
  program_updated: GraduationCap,
  quiz_created: HelpCircle,
  admin_action: Shield,
  enrollment_approved: UserPlus,
  system_update: Settings,
  default: TrendingUp,
};

const activityColors = {
  user_registered: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  certificate_approved: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  material_uploaded: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  program_updated: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  quiz_created: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  admin_action: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  enrollment_approved: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  system_update: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  default: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

export default function ActivityTimeline({ activities = [], loading = false, limit = 10 }) {
  const displayActivities = activities.slice(0, limit);

  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (displayActivities.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
            <activityIcons.default className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
        <div className="space-y-6">
          {displayActivities.map((activity, index) => {
            const Icon = activityIcons[activity.type] || activityIcons.default;
            const colorClass = activityColors[activity.type] || activityColors.default;
            return (
              <motion.div
                key={activity.id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex gap-4 relative"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass} relative z-10`}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.title}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{activity.time}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{activity.description}</p>
                  {activity.meta && (
                    <p className="text-xs text-gray-400 mt-1">{activity.meta}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      {activities.length > limit && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <button className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all activity</button>
        </div>
      )}
    </div>
  );
}