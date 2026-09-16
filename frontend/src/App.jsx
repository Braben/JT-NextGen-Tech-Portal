/**
 * App — Root router
 *
 * Pages are lazy-loaded via React.lazy() so each page becomes its own
 * bundle (code splitting). Only the shell (Layout + HomeRedirect) is
 * loaded upfront; the rest load on demand, shrinking the initial
 * download and improving perceived performance.
 *
 * A Suspense fallback (LoadingSpinner) is rendered while a lazy page
 * chunk is being fetched.
 */

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import AdminLayout from './layouts/AdminLayout';
import InstructorLayout from './layouts/InstructorLayout';
import StudentLayout from './layouts/StudentLayout';

/* ---- Lazy-loaded pages (each becomes its own chunk) ---- */
// Public pages
const Home                 = lazy(() => import('./pages/public/Home'));
const About                = lazy(() => import('./pages/public/About'));
const Programs             = lazy(() => import('./pages/public/Programs'));
const ProgramDetail        = lazy(() => import('./pages/public/ProgramDetail'));
const Contact              = lazy(() => import('./pages/public/Contact'));
const VerifyCertificate    = lazy(() => import('./pages/public/VerifyCertificate'));
const PublicRegister       = lazy(() => import('./pages/public/Register'));
const ApplicationSubmitted = lazy(() => import('./pages/public/ApplicationSubmitted'));
const Blog                 = lazy(() => import('./pages/public/Blog'));
const BlogPost             = lazy(() => import('./pages/public/BlogPost'));
const Login                = lazy(() => import('./pages/Login'));
const ForgotPassword       = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword        = lazy(() => import('./pages/ResetPassword'));

// Student pages
const StudentDashboard     = lazy(() => import('./pages/StudentDashboard'));
const SubmitAssignment     = lazy(() => import('./pages/SubmitAssignment'));
const SubmissionDetail     = lazy(() => import('./pages/SubmissionDetail'));
const Gradebook            = lazy(() => import('./pages/Gradebook'));
const Profile              = lazy(() => import('./pages/Profile'));

// Instructor pages
const InstructorDashboard  = lazy(() => import('./pages/InstructorDashboard'));
const CreateAssignment     = lazy(() => import('./pages/CreateAssignment'));
const EditAssignment       = lazy(() => import('./pages/EditAssignment'));

// Admin pages
const AdminDashboard       = lazy(() => import('./pages/admin/AdminDashboard'));

// Admin sub-pages (wrapped in AdminLayout)
const UsersManagement      = lazy(() => import('./pages/admin/UsersManagement'));
const ProgramsManagement   = lazy(() => import('./pages/admin/ProgramsManagement'));
const EnrollmentsManagement = lazy(() => import('./pages/admin/EnrollmentsManagement'));
const CertificatesManagement = lazy(() => import('./pages/admin/CertificatesManagement'));
const MaterialsManagement  = lazy(() => import('./pages/admin/MaterialsManagement'));
const CalendarManagement   = lazy(() => import('./pages/admin/CalendarManagement'));
const QuizzesManagement    = lazy(() => import('./pages/admin/QuizzesManagement'));
const AttendanceManagement = lazy(() => import('./pages/admin/AttendanceManagement'));
const MessagesManagement   = lazy(() => import('./pages/admin/MessagesManagement'));
const ForumsManagement     = lazy(() => import('./pages/admin/ForumsManagement'));
const SecurityManagement   = lazy(() => import('./pages/admin/SecurityManagement'));
const AuditManagement      = lazy(() => import('./pages/admin/AuditManagement'));
const SystemManagement     = lazy(() => import('./pages/admin/SystemManagement'));
const SystemMessagesManagement = lazy(() => import('./pages/admin/SystemMessagesManagement'));
const AccountSettings      = lazy(() => import('./pages/admin/AccountSettings'));
const NotificationSettingsManagement = lazy(() => import('./pages/admin/NotificationSettingsManagement'));

// Legacy pages (for backward compatibility routes)
const Messages             = lazy(() => import('./pages/Messages'));
const Forums               = lazy(() => import('./pages/Forums'));
const Attendance           = lazy(() => import('./pages/Attendance'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));
const Materials            = lazy(() => import('./pages/Materials'));
const Calendar             = lazy(() => import('./pages/Calendar'));
const Quizzes              = lazy(() => import('./pages/Quizzes'));
const QuizTake             = lazy(() => import('./pages/QuizTake'));
const Payments             = lazy(() => import('./pages/Payments'));
const ProgressDashboard    = lazy(() => import('./pages/ProgressDashboard'));
const StudentAptitude      = lazy(() => import('./pages/StudentAptitude'));
const ClassAllocation      = lazy(() => import('./pages/ClassAllocation'));

/** Fallback shown while a lazy chunk loads */
function PageLoader() {
  return <LoadingSpinner />;
}

/** Redirect "/" to the correct dashboard based on auth role */
function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Home />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'instructor') return <Navigate to="/instructor" replace />;
  return <Navigate to="/student" replace />;
}

/** Redirect old shared paths into the current user's canonical role workspace. */
function RoleRedirect({ admin, instructor, student }) {
  const { user } = useAuth();
  const location = useLocation();
  const params = useParams();
  if (!user) return <Navigate to="/login" replace />;
  const target = user.role === 'admin' ? admin : user.role === 'instructor' ? instructor : student;
  if (!target) return <Navigate to="/" replace />;
  const resolved = target.replace(/:([A-Za-z0-9_]+)/g, (_, key) => params[key] || '');
  return <Navigate to={`${resolved}${location.search}`} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          <Route path="/" element={<HomeRedirect />} />
          {/* Public landing page — always accessible, even when logged in (brand logo link) */}
          <Route path="/home" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/programs/:slug" element={<ProgramDetail />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/certificates/verify" element={<VerifyCertificate />} />
          <Route path="/verify-certificate" element={<Navigate to="/certificates/verify" replace />} />
          <Route path="/register" element={<Navigate to="/register/account" replace />} />
          <Route path="/register/:page" element={<PublicRegister />} />
          <Route path="/register/submitted" element={<ProtectedRoute role="student"><ApplicationSubmitted /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />

          <Route path="/submission/:id" element={<ProtectedRoute><SubmissionDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<RoleRedirect admin="/admin/account" instructor="/instructor/profile" student="/student/profile" />} />

          {/* Student routes with StudentLayout — same theme & auth as Admin/Instructor */}
          <Route element={<ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<Profile />} />
            <Route path="/student/progress" element={<ProgressDashboard />} />
            <Route path="/student/gradebook" element={<Gradebook />} />
            <Route path="/student/materials" element={<Materials />} />
            <Route path="/student/classes" element={<ClassAllocation />} />
            <Route path="/student/quizzes" element={<Quizzes />} />
            <Route path="/student/quizzes/:id" element={<QuizTake />} />
            <Route path="/student/quizzes/:id/results/:submissionId" element={<QuizTake />} />
            <Route path="/student/aptitude" element={<StudentAptitude />} />
            <Route path="/student/aptitude/:assessmentId" element={<StudentAptitude />} />
            <Route path="/student/attendance" element={<Attendance />} />
            <Route path="/student/calendar" element={<Calendar />} />
            <Route path="/student/forums" element={<Forums />} />
            <Route path="/student/forums/:categoryId" element={<Forums />} />
            <Route path="/student/forums/:categoryId/topics/:topicId" element={<Forums />} />
            <Route path="/student/messages" element={<Messages />} />
            <Route path="/student/messages/:userId" element={<Messages />} />
            <Route path="/student/payments" element={<Payments />} />
            <Route path="/student/submit/:id" element={<SubmitAssignment />} />
          </Route>

          {/* Legacy student routes for backward compatibility (keep outside layout) */}
          <Route path="/progress" element={<ProtectedRoute role="student"><ProgressDashboard /></ProtectedRoute>} />
          <Route path="/submit/:id" element={<ProtectedRoute role="student"><SubmitAssignment /></ProtectedRoute>} />
          <Route path="/gradebook" element={<RoleRedirect admin="/admin/gradebook" instructor="/instructor/gradebook" student="/student/gradebook" />} />

          {/* Instructor routes with InstructorLayout wrapper — same theme & auth pattern as Admin */}
          <Route element={<ProtectedRoute role="instructor"><InstructorLayout /></ProtectedRoute>}>
            <Route path="/instructor" element={<InstructorDashboard />} />
            <Route path="/instructor/profile" element={<Profile />} />
            <Route path="/instructor/create" element={<CreateAssignment />} />
            <Route path="/instructor/edit/:id" element={<EditAssignment />} />
            <Route path="/instructor/materials" element={<Materials />} />
            <Route path="/instructor/classes" element={<ClassAllocation />} />
            <Route path="/instructor/quizzes" element={<Quizzes />} />
            <Route path="/instructor/attendance" element={<Attendance />} />
            <Route path="/instructor/calendar" element={<Calendar />} />
            <Route path="/instructor/messages" element={<Messages />} />
            <Route path="/instructor/forums" element={<Forums />} />
            <Route path="/instructor/forums/:categoryId" element={<Forums />} />
            <Route path="/instructor/forums/:categoryId/topics/:topicId" element={<Forums />} />
            <Route path="/instructor/gradebook" element={<Gradebook />} />
          </Route>

          {/* Admin routes with AdminLayout wrapper */}
          <Route element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UsersManagement />} />
            <Route path="/admin/programs" element={<ProgramsManagement />} />
            <Route path="/admin/classes" element={<ClassAllocation />} />
            <Route path="/admin/enrollments" element={<EnrollmentsManagement />} />
            <Route path="/admin/certificates" element={<CertificatesManagement />} />
            <Route path="/admin/materials" element={<MaterialsManagement />} />
            <Route path="/admin/calendar" element={<CalendarManagement />} />
            <Route path="/admin/quizzes" element={<QuizzesManagement />} />
            <Route path="/admin/attendance" element={<AttendanceManagement />} />
            <Route path="/admin/gradebook" element={<Gradebook />} />
            <Route path="/admin/payments" element={<Payments />} />
            <Route path="/admin/messages" element={<MessagesManagement />} />
            <Route path="/admin/forums" element={<ForumsManagement />} />
            <Route path="/admin/forums/:categoryId" element={<Forums />} />
            <Route path="/admin/forums/:categoryId/topics/:topicId" element={<Forums />} />
            <Route path="/admin/security" element={<SecurityManagement />} />
            <Route path="/admin/audit" element={<AuditManagement />} />
            <Route path="/admin/system" element={<SystemManagement />} />
            <Route path="/admin/system-messages" element={<SystemMessagesManagement />} />
            <Route path="/admin/account" element={<AccountSettings />} />
            <Route path="/admin/notifications" element={<NotificationSettingsManagement />} />
          </Route>

          {/* Legacy routes (keep for backward compatibility) */}
          <Route path="/messages" element={<RoleRedirect admin="/admin/messages" instructor="/instructor/messages" student="/student/messages" />} />
          <Route path="/messages/:userId" element={<RoleRedirect admin="/admin/messages" instructor="/instructor/messages/:userId" student="/student/messages/:userId" />} />
          <Route path="/forums" element={<RoleRedirect admin="/admin/forums" instructor="/instructor/forums" student="/student/forums" />} />
          <Route path="/forums/:categoryId" element={<RoleRedirect admin="/admin/forums/:categoryId" instructor="/instructor/forums/:categoryId" student="/student/forums/:categoryId" />} />
          <Route path="/forums/:categoryId/topics/:topicId" element={<RoleRedirect admin="/admin/forums/:categoryId/topics/:topicId" instructor="/instructor/forums/:categoryId/topics/:topicId" student="/student/forums/:categoryId/topics/:topicId" />} />
          <Route path="/attendance" element={<RoleRedirect admin="/admin/attendance" instructor="/instructor/attendance" student="/student/attendance" />} />
          <Route path="/notifications/settings" element={<RoleRedirect admin="/admin/notifications" instructor="/notifications/settings" student="/notifications/settings" />} />
          <Route path="/materials" element={<RoleRedirect admin="/admin/materials" instructor="/instructor/materials" student="/student/materials" />} />
          <Route path="/calendar" element={<RoleRedirect admin="/admin/calendar" instructor="/instructor/calendar" student="/student/calendar" />} />
          <Route path="/quizzes" element={<RoleRedirect admin="/admin/quizzes" instructor="/instructor/quizzes" student="/student/quizzes" />} />
          <Route path="/quizzes/:id" element={<RoleRedirect admin="/admin/quizzes" instructor="/instructor/quizzes" student="/student/quizzes/:id" />} />
          <Route path="/quizzes/:id/results/:submissionId" element={<RoleRedirect admin="/admin/quizzes" instructor="/instructor/quizzes" student="/student/quizzes/:id/results/:submissionId" />} />
          <Route path="/payments" element={<RoleRedirect admin="/admin/payments" student="/student/payments" />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
    </ErrorBoundary>
  );
}
