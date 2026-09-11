import { motion } from 'framer-motion';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

const COLORS = {
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  teal: '#14b8a6',
};

export function LineChart({
  data,
  labels,
  colors = [COLORS.blue, COLORS.emerald, COLORS.amber],
  height = 200,
  showLegend = true,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="h-[200px] animate-pulse">
        <div className="h-6 w-1/4 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="h-full bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  const maxValue = Math.max(1, ...data.flat());

  const getPath = (points) => {
    if (!points.length) return '';
    if (points.length === 1) {
      const y = 100 - (points[0] / maxValue) * 90;
      return `M 0 ${y} L 100 ${y}`;
    }
    const width = 100;
    const pointWidth = width / (points.length - 1);
    return points
      .map((point, i) => {
        const x = i * pointWidth;
        const y = 100 - (point / maxValue) * 90;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <div>
      <div className="relative h-[200px]">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gridGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#e5e7eb" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g stroke="url(#gridGradient)" strokeWidth="0.5">
            {[20, 40, 60, 80].map((y) => (
              <line key={y} x1="0" y1={y} x2="100" y2={y} />
            ))}
          </g>
          {data.map((points, i) => (
            <motion.path
              key={i}
              d={getPath(points)}
              stroke={colors[i % colors.length]}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: i * 0.2 }}
            />
          ))}
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 -mb-2 text-xs text-gray-400">
          {labels.map((label, i) => (
            <span key={i} className="flex-1 text-center truncate px-1">{label}</span>
          ))}
        </div>
      </div>
      {showLegend && data.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-6 justify-center">
          {labels.length ? labels.map((_, i) => null) : null}
          {data.map((_, i) => {
            const fallback = ['Applications', 'Approved', 'Enrolled', 'Rejected', 'Series ' + (i + 1)];
            const label = ['Applications', 'Approved', 'Enrolled', 'Rejected'][i] || fallback[i] || `Series ${i + 1}`;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DonutChart({
  data,
  colors = [COLORS.emerald, COLORS.amber, COLORS.red, COLORS.blue],
  size = 160,
  strokeWidth = 16,
  showCenter = true,
  centerValue,
  centerLabel,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[200px] animate-pulse">
        <div className="w-32 h-32 rounded-full border-4 border-gray-200 dark:border-gray-700" />
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center">
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
          </svg>
          {showCenter && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{centerValue ?? '0%'}</span>
              {centerLabel && <span className="text-xs text-gray-500 dark:text-gray-400">{centerLabel}</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {data.map((segment, i) => {
            const percentage = segment.value / total;
            const strokeDasharray = `${percentage * circumference} ${circumference}`;
            const rotation = i === 0 ? -90 : data.slice(0, i).reduce((sum, d) => sum + (d.value / total) * 360, 0) - 90;
            return (
              <motion.circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
                transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray }}
                transition={{ duration: 1, delay: i * 0.1 }}
              />
            );
          })}
        </svg>
        {showCenter && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{centerValue ?? `${((data[0]?.value / total) * 100).toFixed(1)}%`}</span>
            {centerLabel && <span className="text-xs text-gray-500 dark:text-gray-400">{centerLabel}</span>}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 justify-center text-sm">
        {data.map((segment, i) => (
          <div key={segment.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-gray-600 dark:text-gray-400">{segment.label}</span>
            <span className="font-medium text-gray-900 dark:text-white">{segment.value}</span>
            <span className="text-gray-400">({((segment.value / total) * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatRow({ stats, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 sm:p-4 animate-pulse">
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mb-2 mx-auto" />
            <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 sm:p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            {stat.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
            {stat.trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
            {stat.trend === 'neutral' && <Minus className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{stat.label}</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
