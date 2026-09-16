/**
 * AdminLayout — Wrapper for all admin pages providing consistent sidebar + header
 *
 * This component provides the shared layout structure for all admin sub-pages:
 * - Fixed left sidebar navigation (collapsible on mobile)
 * - Sticky top header with search, notifications, user menu
 * - Main content area that takes full available width
 * - Responsive design that works on desktop, tablet, and mobile
 *
 * All admin pages should be wrapped with this layout to maintain consistency.
 */

import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar';
import Header from '../components/admin/Header';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { logout } = useAuth();

  const handleSidebarToggle = (open) => {
    if (typeof open === 'boolean') setSidebarOpen(open);
    else setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Fixed on desktop, slide-in on mobile */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleSidebarToggle}
        onSignOut={logout}
      />

      {/* Main content area with sidebar offset on desktop */}
      <div className="lg:pl-64 min-w-0 flex flex-col min-h-screen">
        {/* Header with page title, search, notifications, user menu */}
        <Header
          title={getPageTitle(location.pathname)}
          subtitle={getPageSubtitle(location.pathname)}
          onSidebarToggle={handleSidebarToggle}
        />

        {/* Main content - takes full width and available height */}
        <main className="admin-content dashboard-content min-w-0 flex-1 p-4 sm:p-6 lg:p-8 w-full">
          {/* Outlet renders the child route component */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * Returns the page title based on the current pathname
 * @param {string} pathname - Current route pathname
 * @returns {string} Page title
 */
function getPageTitle(pathname) {
  const titles = {
    '/admin': 'Admin Dashboard',
    '/admin/users': 'User Management',
    '/admin/programs': 'Program Management',
    '/admin/classes': 'Class Allocation',
    '/admin/enrollments': 'Enrollment Management',
    '/admin/certificates': 'Certificate Management',
    '/admin/materials': 'Materials Management',
    '/admin/calendar': 'Calendar & Events',
    '/admin/quizzes': 'Quiz Management',
    '/admin/attendance': 'Attendance Management',
    '/admin/gradebook': 'Gradebook',
    '/admin/payments': 'Payment Management',
    '/admin/messages': 'Messages',
    '/admin/forums': 'Forum Management',
    '/admin/security': 'Security Monitor',
    '/admin/audit': 'Audit Trail',
    '/admin/system': 'System Status',
    '/admin/system-messages': 'System Messages',
    '/admin/account': 'Account Settings',
    '/admin/notifications': 'Notification Settings',
  };

  // Match exact routes first, then fall back to parent routes
  for (const [route, title] of Object.entries(titles)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return title;
    }
  }

  return 'Admin Dashboard';
}

/**
 * Returns the page subtitle based on the current pathname
 * @param {string} pathname - Current route pathname
 * @returns {string} Page subtitle
 */
function getPageSubtitle(pathname) {
  const subtitles = {
    '/admin': 'Full system management and control',
    '/admin/users': 'Manage users, roles, and permissions',
    '/admin/programs': 'Create and manage training programs',
    '/admin/classes': 'Create cohorts, assign instructors, and allocate students',
    '/admin/enrollments': 'Track and manage student enrollments',
    '/admin/certificates': 'Issue and manage certificates',
    '/admin/materials': 'Upload and organize course materials',
    '/admin/calendar': 'Schedule and manage events',
    '/admin/quizzes': 'Create and manage quizzes',
    '/admin/attendance': 'Track attendance sessions',
    '/admin/gradebook': 'Review grades and feedback across instructors',
    '/admin/payments': 'Review invoices and record verified payments',
    '/admin/messages': 'View and manage messages',
    '/admin/forums': 'Moderate forum discussions',
    '/admin/security': 'Monitor login attempts and security',
    '/admin/audit': 'View admin action audit trail',
    '/admin/system': 'System health and performance',
    '/admin/system-messages': 'Manage system-wide messages',
    '/admin/account': 'Manage your account settings',
    '/admin/notifications': 'Configure notification preferences',
  };

  for (const [route, subtitle] of Object.entries(subtitles)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return subtitle;
    }
  }

  return 'Full system management and control';
}
