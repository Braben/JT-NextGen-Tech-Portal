import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';
import BrandLogo from './BrandLogo';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClick(e) { if (menuRef.current && !menuRef.current.contains(e.target) && window.innerWidth < 768) setMobileOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isPublic = !user;
  const isStudent = user?.role === 'student';
  const isInstructor = user?.role === 'instructor';
  const isAdmin = user?.role === 'admin';

  const publicLinks = [
    { to: '/', label: 'Home' },
    { to: '/programs', label: 'Programs' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
    { to: '/blog', label: 'Blog' },
    { to: '/verify-certificate', label: 'Verify Certificate' },
  ];

  const inDashboard = location.pathname.startsWith('/student') || location.pathname.startsWith('/instructor') || location.pathname.startsWith('/admin');

  const roleLinks = isStudent
    ? [{ to: '/student', label: 'Dashboard' }, { to: '/student/progress', label: 'Progress' }, { to: '/student/gradebook', label: 'Grades' }, { to: '/student/attendance', label: 'Attendance' }]
    : isInstructor
    ? [{ to: '/instructor', label: 'Dashboard' }, { to: '/instructor/create', label: 'Create' }, { to: '/instructor/gradebook', label: 'Gradebook' }, { to: '/instructor/attendance', label: 'Attendance' }]
    : isAdmin
    ? [{ to: '/admin', label: 'Admin Dashboard' }, { to: '/admin/gradebook', label: 'Gradebook' }, { to: '/admin/attendance', label: 'Attendance' }]
    : [];

  const generalLinks = isStudent
    ? [{ to: '/student/materials', label: 'Materials' }, { to: '/student/calendar', label: 'Calendar' }, { to: '/student/quizzes', label: 'Quizzes' }, { to: '/student/payments', label: 'Payments' }, { to: '/student/messages', label: 'Messages' }, { to: '/student/forums', label: 'Forums' }]
    : isInstructor
    ? [{ to: '/instructor/materials', label: 'Materials' }, { to: '/instructor/calendar', label: 'Calendar' }, { to: '/instructor/quizzes', label: 'Quizzes' }, { to: '/instructor/messages', label: 'Messages' }, { to: '/instructor/forums', label: 'Forums' }]
    : isAdmin
    ? [{ to: '/admin/materials', label: 'Materials' }, { to: '/admin/calendar', label: 'Calendar' }, { to: '/admin/quizzes', label: 'Quizzes' }, { to: '/admin/payments', label: 'Payments' }, { to: '/admin/messages', label: 'Messages' }, { to: '/admin/forums', label: 'Forums' }]
    : [
        { to: '/materials', label: 'Materials' },
        { to: '/calendar', label: 'Calendar' },
        { to: '/quizzes', label: 'Quizzes' },
        { to: '/messages', label: 'Messages' },
        { to: '/forums', label: 'Forums' },
      ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4" ref={menuRef}>
        <div className="flex items-center justify-between h-16">
          <Link to="/home" className="flex items-center gap-2 flex-shrink-0" aria-label="JT NextGen Tech Hub home">
            <BrandLogo className="w-36 sm:w-44" />
          </Link>

          {isPublic && (
            <>
              <div className="hidden md:flex items-center gap-1">
                {publicLinks.map((l) => (
                  <NavLink key={l.to} to={l.to} label={l.label} current={location.pathname} />
                ))}
                <Link to="/login" className="ml-3 btn-primary text-sm px-4 py-1.5">Sign In</Link>
                <Link to="/register" className="btn-secondary text-sm px-4 py-1.5">Register</Link>
              </div>
              <div className="flex shrink-0 items-center gap-1 md:hidden">
                <Link to="/register" className="inline-flex min-h-11 items-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Register</Link>
                <button type="button" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} className="flex h-11 w-11 items-center justify-center text-gray-600 hover:text-brand-700">
                  {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </>
          )}

          {user && (
            <div className="flex items-center gap-1 sm:gap-3">
              {!inDashboard && (
                <>
                  <div className="hidden lg:flex items-center gap-1">
                    {roleLinks.map((l) => (
                      <NavLink key={l.to} to={l.to} label={l.label} current={location.pathname} />
                    ))}
                  </div>
                  <div className="hidden lg:flex items-center gap-1">
                    {generalLinks.map((l) => (
                      <NavLink key={l.to} to={l.to} label={l.label} current={location.pathname} />
                    ))}
                  </div>
                </>
              )}
              {inDashboard && (
                <div className="hidden lg:flex items-center gap-2 text-xs text-gray-400">
                  <span className="hidden xl:inline">Dashboard navigation in sidebar →</span>
                </div>
              )}

              {!isAdmin && <NotificationBell />}

              <button onClick={toggle} className="p-2 rounded-lg text-gray-500 hover:text-brand-700 hover:bg-gray-50 transition-colors" title={dark ? 'Light Mode' : 'Dark Mode'}>
                {dark ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
              </button>

              <ProfileDropdown user={user} logout={logout} />

              <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 text-gray-600 hover:text-brand-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-gray-100"
            >
              <div className="py-3 space-y-1">
                {isPublic ? (
                  <>
                    {publicLinks.map((l) => (
                      <MobileNavLink key={l.to} to={l.to} label={l.label} current={location.pathname} />
                    ))}
                    <div className="flex gap-2 mt-3 px-3">
                      <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-primary text-sm flex-1 text-center py-2">Sign In</Link>
                      <Link to="/register" onClick={() => setMobileOpen(false)} className="btn-secondary text-sm flex-1 text-center py-2">Register</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Main</div>
                    {roleLinks.map((l) => (
                      <MobileNavLink key={l.to} to={l.to} label={l.label} current={location.pathname} />
                    ))}
                    <div className="px-3 py-1.5 mt-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Features</div>
                    {generalLinks.map((l) => (
                      <MobileNavLink key={l.to} to={l.to} label={l.label} current={location.pathname} />
                    ))}
                    <hr className="my-2 border-gray-100 mx-3" />
                    <MobileNavLink to="/profile" label="Account Settings" current={location.pathname} />
                    <MobileNavLink to="/notifications/settings" label="Notification Settings" current={location.pathname} />
                    <div className="px-3 pt-1">
                      <button onClick={() => { logout(); setMobileOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}

function NavLink({ to, label, current }) {
  const isActive = current === to || current.startsWith(to + '/');
  return (
    <Link to={to} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:text-brand-700 hover:bg-gray-50'}`}>
      {label}
    </Link>
  );
}

function MobileNavLink({ to, label, current }) {
  const isActive = current === to || current.startsWith(to + '/');
  return (
    <Link to={to} className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:text-brand-700 hover:bg-gray-50'}`}>
      {label}
    </Link>
  );
}

function ProfileDropdown({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 hover:bg-gray-50 rounded-lg p-1.5 transition-colors">
        <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-semibold">
          {user.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <span className="hidden lg:block text-sm font-medium text-gray-700">{user.name}</span>
        <svg className={`hidden lg:block w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
          <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Profile
          </Link>
          <Link to="/notifications/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Notification Settings
          </Link>
          <hr className="my-1 border-gray-100" />
          <button onClick={() => { setOpen(false); logout(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
