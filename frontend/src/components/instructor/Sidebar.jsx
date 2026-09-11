import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  HelpCircle,
  CalendarCheck,
  MessageSquare,
  Calendar,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';

const navigation = [
  {
    group: 'Main',
    items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/instructor' }],
  },
  {
    group: 'Teaching',
    items: [
      { key: 'materials', label: 'Materials', icon: BookOpen, href: '/instructor/materials' },
      { key: 'classes', label: 'Classes', icon: GraduationCap, href: '/instructor/classes' },
      { key: 'quizzes', label: 'Quizzes', icon: HelpCircle, href: '/instructor/quizzes' },
      { key: 'attendance', label: 'Attendance', icon: CalendarCheck, href: '/instructor/attendance' },
      { key: 'gradebook', label: 'Gradebook', icon: ClipboardCheck, href: '/instructor/gradebook' },
    ],
  },
  {
    group: 'Community',
    items: [
      { key: 'messages', label: 'Messages', icon: MessageSquare, href: '/instructor/messages' },
      { key: 'forums', label: 'Forums', icon: MessageSquare, href: '/instructor/forums' },
      { key: 'calendar', label: 'Calendar', icon: Calendar, href: '/instructor/calendar' },
    ],
  },
  {
    group: 'Account',
    items: [{ key: 'profile', label: 'Profile', icon: Settings, href: '/instructor/profile' }],
  },
];

export default function Sidebar({ isOpen, onClose, onSignOut }) {
  const location = useLocation();
  const [collapsedGroups, setCollapsedGroups] = useState({
    Main: false,
    Teaching: false,
    Community: false,
    Account: false,
  });

  const toggleGroup = (group) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const isActive = (href) => {
    if (href === '/instructor') return location.pathname === '/instructor';
    return location.pathname.startsWith(href);
  };

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-brand-600 text-white rounded-lg shadow-lg"
        onClick={() => onClose(!isOpen)}
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-navy-900 text-white transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        aria-label="Main navigation"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-navy-700">
            <div className="flex items-center gap-3">
              <BrandLogo />
            </div>
            <button className="lg:hidden p-1 rounded hover:bg-navy-800" onClick={() => onClose(false)} aria-label="Close sidebar">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-2" role="navigation" aria-label="Instructor navigation">
            {navigation.map((section) => (
              <div key={section.group} className="group">
                <button
                  type="button"
                  onClick={() => toggleGroup(section.group)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-navy-300 uppercase tracking-wider hover:text-white transition-colors"
                  aria-expanded={!collapsedGroups[section.group]}
                >
                  <span>{section.group}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${collapsedGroups[section.group] ? '-rotate-90' : ''}`} aria-hidden="true" />
                </button>

                <div className={`${collapsedGroups[section.group] ? 'hidden' : 'block'} mt-1 space-y-1`} role="group" aria-label={`${section.group} navigation`}>
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    if (item.onClick) {
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => { onClose(false); onSignOut?.(); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-navy-200 hover:bg-navy-800 hover:text-white cursor-pointer"
                          title={item.label}
                        >
                          <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    }
                    return (
                      <NavLink
                        key={item.key}
                        to={item.href}
                        end={item.href === '/instructor'}
                        onClick={() => onClose(false)}
                        className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-brand-600/20 text-brand-100 shadow-sm shadow-brand-500/10' : 'text-navy-200 hover:bg-navy-800 hover:text-white'}`}
                        aria-current={active ? 'page' : undefined}
                        title={item.label}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-4 border-t border-navy-700 space-y-3">
            <div className="flex items-center gap-3 p-2.5 bg-navy-800/50 rounded-xl border border-navy-700/50">
              <div className="w-9 h-9 bg-brand-500/20 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand-300">IN</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">Instructor</p>
                <p className="text-xs text-navy-400">Teaching Access</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" aria-hidden="true" />
            </div>
            <button
              type="button"
              onClick={() => { onClose(false); onSignOut?.(); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.06] hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-navy-100 hover:text-red-200 transition-all duration-200 font-medium text-sm cursor-pointer group"
            >
              <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {isOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => onClose(false)} aria-hidden="true" />}
    </>
  );
}
import BrandLogo from '../BrandLogo';
