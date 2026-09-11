import { motion } from 'framer-motion';
import {
  Users,
  GraduationCap,
  UserCheck,
  Briefcase,
  Award,
  FileText,
  ClipboardCheck,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

const statConfig = {
  students: { icon: Users, color: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
  programs: { icon: GraduationCap, color: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
  enrollments: { icon: UserCheck, color: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' },
  trainers: { icon: Briefcase, color: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
  certificates: { icon: Award, color: 'bg-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400' },
  totalStudents: { icon: Users, color: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
  totalAssignments: { icon: FileText, color: 'bg-brand-500', bg: 'bg-brand-50 dark:bg-brand-900/20', text: 'text-brand-600 dark:text-brand-400' },
  totalSubmissions: { icon: ClipboardCheck, color: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' },
  submittedCount: { icon: ClipboardCheck, color: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' },
  gradedCount: { icon: Award, color: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
  avgScore: { icon: Award, color: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
  totalMaterials: { icon: BookOpen, color: 'bg-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-600 dark:text-sky-400' },
  pendingReview: { icon: ClipboardCheck, color: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
};

function TrendIndicator({ trend }) {
  if (!trend || trend === 'neutral') return <Minus className="w-4 h-4 text-gray-400" aria-hidden="true" />;
  return trend === 'up' ? (
    <TrendingUp className="w-4 h-4 text-emerald-500" aria-hidden="true" />
  ) : (
    <TrendingDown className="w-4 h-4 text-red-500" aria-hidden="true" />
  );
}

export default function StatCard({
  cardKey,
  label,
  value,
  subValue,
  subLabel,
  trend = 'neutral',
  trendLabel,
  loading = false,
  icon: customIcon,
}) {
  const config = statConfig[cardKey] || statConfig.students;
  const Icon = customIcon || config.icon;

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1">
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {subValue !== undefined && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`text-sm font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
                <TrendIndicator trend={trend} />
                {subValue}
              </span>
              {trendLabel && <span className="text-xs text-gray-400">{trendLabel}</span>}
              {subLabel && <span className="text-xs text-gray-400">{subLabel}</span>}
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${config.bg} ${config.text}`}>
          <Icon className="w-6 h-6" aria-hidden="true" />
        </div>
      </div>
    </motion.div>
  );
}
