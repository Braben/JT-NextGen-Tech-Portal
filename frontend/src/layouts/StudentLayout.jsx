import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/student/Sidebar';
import Header from '../components/admin/Header';
import { useAuth } from '../context/AuthContext';

export default function StudentLayout() {
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
    '/student': 'Student Dashboard',
    '/student/progress': 'Progress Overview',
    '/student/gradebook': 'Gradebook',
    '/student/classes': 'My Class',
    '/student/materials': 'Course Materials',
    '/student/quizzes': 'Quizzes',
    '/student/aptitude': 'Aptitude Assessment',
    '/student/attendance': 'Attendance',
    '/student/calendar': 'Calendar & Events',
    '/student/messages': 'Messages',
    '/student/forums': 'Forums',
    '/student/payments': 'Payments',
    '/student/profile': 'Profile',
    '/profile': 'Profile',
  };
  for (const [route, title] of Object.entries(titles)) {
    if (pathname === route || pathname.startsWith(route + '/')) return title;
  }
  if (pathname.startsWith('/submit/')) return 'Submit Assignment';
  if (pathname.startsWith('/quizzes/')) return 'Quiz';
  return 'Student Dashboard';
}

function getPageSubtitle(pathname) {
  const subtitles = {
    '/student': 'Track progress and stay on top of assignments',
    '/student/progress': 'Your learning journey at a glance',
    '/student/gradebook': 'Review grades and feedback',
    '/student/classes': 'Your cohort, instructor, and discussion room',
    '/student/materials': 'Learning resources from your programs',
    '/student/quizzes': 'Take quizzes and track scores',
    '/student/aptitude': 'Complete admissions readiness tasks',
    '/student/attendance': 'Your attendance history',
    '/student/calendar': 'Events and deadlines',
    '/student/messages': 'Stay connected',
    '/student/forums': 'Discuss and collaborate',
    '/student/payments': 'Billing and transaction history',
    '/student/profile': 'Manage your profile',
    '/profile': 'Manage your profile',
  };
  for (const [route, subtitle] of Object.entries(subtitles)) {
    if (pathname === route || pathname.startsWith(route + '/')) return subtitle;
  }
  if (pathname.startsWith('/submit/')) return 'Submit your work for review';
  if (pathname.startsWith('/quizzes/')) return 'Complete your assessment';
  return 'Student workspace';
}
