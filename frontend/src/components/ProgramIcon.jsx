import { FiMonitor, FiCode, FiPenTool, FiBarChart2, FiBookOpen, FiGlobe } from 'react-icons/fi';

const icons = { computing: FiMonitor, development: FiCode, design: FiPenTool, data: FiBarChart2, learning: FiBookOpen, web: FiGlobe };
export const programIconOptions = Object.keys(icons).map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
export function normalizeProgramIcon(value) {
  if (icons[value]) return value;
  // Legacy emoji values render as consistent SVGs without changing saved records.
  const legacy = { '\uD83D\uDCBB': 'computing', '\uD83C\uDFA8': 'design', '\uD83D\uDCCA': 'data', '\uD83C\uDF10': 'web', '\uD83D\uDCDA': 'learning' };
  return legacy[value] || 'computing';
}
export default function ProgramIcon({ value, className = 'h-8 w-8 shrink-0' }) {
  const Icon = icons[normalizeProgramIcon(value)];
  return <Icon className={className} aria-hidden="true" />;
}
