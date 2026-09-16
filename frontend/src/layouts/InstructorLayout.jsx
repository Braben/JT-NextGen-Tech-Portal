import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/instructor/Sidebar';
import Header from '../components/admin/Header';
import { useAuth } from '../context/AuthContext';

export default function InstructorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { logout } = useAuth();

  const handleSidebarToggle = (open) => {
    if (typeof open === 'boolean') setSidebarOpen(open);
    else setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar isOpen={sidebarOpen} onClose={handleSidebarToggle} onSignOut={logout} />
      <div className="lg:pl-64 min-w-0 flex flex-col min-h-screen">
        <Header title={getPageTitle(location.pathname)} subtitle={getPageSubtitle(location.pathname)} onSidebarToggle={handleSidebarToggle} />
        <main className="dashboard-content min-w-0 flex-1 p-4 sm:p-6 lg:p-8 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getPageTitle(pathname) {
  const titles = {
    '/instructor': 'Instructor Dashboard',
    '/instructor/materials': 'Materials Management',
    '/instructor/classes': 'My Classes',
    '/instructor/quizzes': 'Quiz Management',
    '/instructor/attendance': 'Attendance Management',
    '/instructor/calendar': 'Calendar & Events',
    '/instructor/messages': 'Messages',
    '/instructor/forums': 'Forum Management',
    '/instructor/profile': 'Profile',
    '/gradebook': 'Gradebook',
    '/profile': 'Profile',
  };
  for (const [route, title] of Object.entries(titles)) {
    if (pathname === route || pathname.startsWith(route + '/')) return title;
  }
  if (pathname.startsWith('/instructor/edit') || pathname.startsWith('/instructor/create')) return 'Assignment Editor';
  return 'Instructor Dashboard';
}

function getPageSubtitle(pathname) {
  const subtitles = {
    '/instructor': 'Manage assignments and track student progress',
    '/instructor/materials': 'Upload and organize course materials',
    '/instructor/classes': 'Rosters, class messages, and discussion rooms',
    '/instructor/quizzes': 'Create and manage quizzes',
    '/instructor/attendance': 'Track attendance sessions',
    '/instructor/calendar': 'Schedule and manage events',
    '/instructor/messages': 'View and manage messages',
    '/instructor/forums': 'Moderate forum discussions',
    '/instructor/profile': 'Manage your profile',
    '/gradebook': 'Review grades and feedback',
    '/profile': 'Manage your profile',
  };
  for (const [route, subtitle] of Object.entries(subtitles)) {
    if (pathname === route || pathname.startsWith(route + '/')) return subtitle;
  }
  if (pathname.startsWith('/instructor/edit') || pathname.startsWith('/instructor/create')) return 'Create and review assignments';
  return 'Instructor workspace';
}
