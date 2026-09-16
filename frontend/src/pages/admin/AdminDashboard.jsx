import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { adminAPI, attendanceAPI, eventAPI, materialAPI, enrollmentAPI, classAPI, messageAPI, programAPI, systemAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/admin/StatCard';
import { LineChart, DonutChart, StatRow } from '../../components/admin/Charts';
import ActivityTimeline from '../../components/admin/ActivityTimeline';
import SystemStatus from '../../components/admin/SystemStatus';
import PendingActions from '../../components/admin/PendingActions';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Button } from '../../components/ui';
import {
  AlertCircle,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  MessageSquare,
  Plus,
  RefreshCcw,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [materialsCount, setMaterialsCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [systemStatus, setSystemStatus] = useState({});
  const [loadErrors, setLoadErrors] = useState([]);
  const [enrollmentPeriod, setEnrollmentPeriod] = useState('month');

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      adminAPI.getStats(),
      enrollmentAPI.getAll(),
      attendanceAPI.getSummary(),
      eventAPI.getPublic(),
      programAPI.getAll(),
      adminAPI.getEnrollments(),
      materialAPI.getAll(),
      systemAPI.health().then((response) => response.data),
      adminAPI.getAuditLog({ limit: 8 }),
      classAPI.getAll(),
      messageAPI.getConversations(),
    ]);

    const [statsRes, enrollmentRes, attendanceRes, eventsRes, programsRes, enrollmentsRes, materialsRes, healthRes, auditRes, classesRes, messagesRes] = results;
    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data || null);
    if (enrollmentRes.status === 'fulfilled') setEnrollments(enrollmentRes.value.data || []);
    if (attendanceRes.status === 'fulfilled') setAttendanceSummary(attendanceRes.value.data || null);
    if (eventsRes.status === 'fulfilled') setUpcomingEvents((eventsRes.value.data || []).slice(0, 5));
    if (programsRes.status === 'fulfilled') setPrograms(programsRes.value.data || []);
    if (materialsRes.status === 'fulfilled') setMaterialsCount((materialsRes.value.data || []).length);
    if (healthRes.status === 'fulfilled') setSystemStatus(normalizeHealth(healthRes.value));
    if (classesRes.status === 'fulfilled') setClasses(classesRes.value.data || []);
    if (messagesRes.status === 'fulfilled') {
      setUnreadMessages((messagesRes.value.data || []).reduce((total, item) => total + Number(item.unread || 0), 0));
    }
    if (auditRes.status === 'fulfilled') setRecentActivity(toActivityItems(auditRes.value.data || []));

    // Prefer the richer admin enrollment payload when available because it includes assessment state.
    if (enrollmentsRes.status === 'fulfilled') setEnrollments(enrollmentsRes.value.data || []);

    const labels = ['stats', 'enrollment chart', 'attendance', 'events', 'programs', 'enrollments', 'materials', 'health', 'audit log', 'classes', 'messages'];
    setLoadErrors(results
      .map((result, index) => result.status === 'rejected' ? labels[index] : null)
      .filter(Boolean));
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const enrollmentChart = buildEnrollmentChart(enrollments, enrollmentPeriod);
  const attendanceData = buildAttendanceData(attendanceSummary);
  const totalAttendance = attendanceData.reduce((total, item) => total + item.value, 0);
  const attendancePercentage = totalAttendance > 0
    ? Math.round(((attendanceSummary?.present || 0) + (attendanceSummary?.late || 0)) / totalAttendance * 100)
    : 0;
  const activeClasses = classes.filter((item) => item.status === 'active');
  const activeEnrollments = stats?.activeEnrollments ?? enrollments.filter((item) => item.status === 'active').length;
  const pendingEnrollments = enrollments.filter((item) => item.status === 'pending').length;
  const aptitudeReviews = stats?.pendingAssessments ?? enrollments.filter((item) => item.assessment_status === 'submitted').length;
  const unallocatedStudents = enrollments.filter((item) => item.status === 'active' && !item.class_id).length;
  const launchReadiness = calculateReadiness({
    hasStudents: Number(stats?.activeStudents || 0) > 0,
    hasPrograms: Number(stats?.programs || programs.length || 0) > 0,
    hasClasses: activeClasses.length > 0,
    hasMaterials: materialsCount > 0,
    systemHealthy: systemStatus.database?.status === 'ok',
  });
  const nextAction = getNextAction({ aptitudeReviews, pendingEnrollments, unallocatedStudents, loadErrors, activeClasses, unreadMessages });

  const statCards = [
    { key: 'students', label: 'Active Students', value: stats?.activeStudents || 0, subValue: `${activeEnrollments} active enrollments`, trend: activeEnrollments ? 'up' : 'neutral', trendLabel: 'Learning now' },
    { key: 'pendingReview', label: 'Aptitude Reviews', value: aptitudeReviews, subValue: `${pendingEnrollments} pending enrollments`, trend: aptitudeReviews || pendingEnrollments ? 'down' : 'up', trendLabel: aptitudeReviews || pendingEnrollments ? 'Needs action' : 'Clear' },
    { key: 'programs', label: 'Programs', value: stats?.programs || programs.length, subValue: `${activeClasses.length} active classes`, trend: activeClasses.length ? 'up' : 'neutral', trendLabel: 'Delivery structure' },
    { key: 'totalMaterials', label: 'Materials', value: materialsCount, subValue: `${attendancePercentage}% attendance`, trend: materialsCount ? 'up' : 'neutral', trendLabel: 'Resources' },
    { key: 'trainers', label: 'Instructors', value: stats?.instructors || 0, subValue: `${unallocatedStudents} unallocated`, trend: unallocatedStudents ? 'down' : 'neutral', trendLabel: 'Class allocation' },
    { key: 'certificates', label: 'Certificates', value: stats?.certificates || 0, subValue: `${stats?.alumni || 0} alumni`, trend: Number(stats?.certificates || 0) ? 'up' : 'neutral', trendLabel: 'Issued' },
  ];

  const pendingCounts = {
    enrollments: pendingEnrollments,
    aptitudeReviews,
    certificates: 0,
    forumReports: 0,
    accountRequests: 0,
  };

  const programPerformance = buildProgramPerformance(programs, enrollments, attendancePercentage);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-700 dark:text-brand-300">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Admissions, delivery, communication, and system health from one command view.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" onClick={fetchDashboardData} icon={RefreshCcw}>Refresh</Button>
          <Button onClick={() => navigate(nextAction.href)} icon={nextAction.icon}>{nextAction.label}</Button>
        </div>
      </div>

      {loadErrors.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Some dashboard data could not load: {loadErrors.join(', ')}. Use refresh or open the related management page directly.</p>
        </div>
      )}

      <section className="card mb-6 border-l-4 border-l-brand-500">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Next Best Action</p>
            <h2 className="mt-1 break-words text-lg font-semibold text-gray-900 dark:text-white">{nextAction.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{nextAction.detail}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:min-w-[320px]">
            <ReadinessTile label="Launch" value={`${launchReadiness}%`} />
            <ReadinessTile label="Queue" value={aptitudeReviews + pendingEnrollments} />
            <ReadinessTile label="Unread" value={unreadMessages} />
          </div>
        </div>
      </section>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map(({ key, ...props }) => (
          <StatCard key={key} cardKey={key} {...props} />
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enrollment Pipeline</h3>
            <div className="flex flex-wrap gap-1.5">
              {['week', 'month', 'quarter', 'year'].map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setEnrollmentPeriod(period)}
                  className={`rounded-lg border px-3 py-1 text-xs transition-colors ${enrollmentPeriod === period ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {enrollmentChart.labels.length === 0 ? (
            <EmptyPanel title="No enrollment data yet" detail="Applications will appear here once students register." />
          ) : (
            <>
              <LineChart data={enrollmentChart.datasets.map((item) => item.data)} labels={enrollmentChart.labels} colors={enrollmentChart.datasets.map((item) => item.color)} height={220} showLegend />
              <div className="mt-6">
                <StatRow stats={[
                  { label: 'Applications', value: enrollmentChart.summary.applications, trend: 'neutral' },
                  { label: 'Approved', value: enrollmentChart.summary.approved, trend: 'up' },
                  { label: 'Active', value: enrollmentChart.summary.enrolled, trend: 'up' },
                  { label: 'Dropped', value: enrollmentChart.summary.rejected, trend: 'down' },
                ]} />
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">Attendance Health</h3>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold leading-none text-brand-600 dark:text-brand-400">{attendancePercentage}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">present/late</p>
            </div>
          </div>
          {totalAttendance === 0 ? (
            <EmptyPanel title="No attendance marks" detail="Attendance sessions will populate this view." compact />
          ) : (
            <div className="flex min-h-[220px] items-center justify-center">
              <DonutChart data={attendanceData} size={170} centerValue={`${attendancePercentage}%`} centerLabel="Attendance Rate" />
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Operational Shortcuts</h3>
            {unallocatedStudents > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{unallocatedStudents} unallocated</span>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {quickActions.map((action) => (
              <button key={action.key} type="button" onClick={() => navigate(action.href)} className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-gray-100 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/50 dark:border-gray-700 dark:hover:bg-brand-900/10">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"><action.icon className="h-5 w-5" /></span>
                <span className="text-center text-xs font-medium text-gray-700 dark:text-gray-200">{action.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Events</h3>
            <Link to="/admin/calendar" className="text-sm font-medium text-brand-600 hover:text-brand-700">Calendar →</Link>
          </div>
          <div className="space-y-2">
            {upcomingEvents.length === 0 ? (
              <EmptyPanel title="No upcoming events" detail="Add events to keep students and instructors aligned." compact />
            ) : upcomingEvents.map((event) => (
              <button key={event.id} type="button" onClick={() => navigate('/admin/calendar')} className="flex w-full items-center gap-3 rounded-xl border border-transparent p-3 text-left transition-colors hover:border-gray-100 hover:bg-gray-50 dark:hover:border-gray-700 dark:hover:bg-gray-800/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900/30">
                  <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{new Date(event.event_date).getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{event.title}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{formatEventMeta(event)}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div>
          <PendingActions counts={pendingCounts} onActionClick={(item) => navigate(item.href)} />
        </div>
        <div className="xl:col-span-2">
          <section className="card overflow-hidden">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Program Performance</h3>
              <Link to="/admin/programs" className="text-sm font-medium text-brand-600 hover:text-brand-700">Programs →</Link>
            </div>
            {programPerformance.length === 0 ? (
              <EmptyPanel title="No programs yet" detail="Create a program before tracking performance." />
            ) : (
              <div className="-mx-6 overflow-x-auto px-6">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <th className="px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Program</th>
                      <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Students</th>
                      <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Classes</th>
                      <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Attendance</th>
                      <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programPerformance.map((program) => (
                      <tr key={program.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 dark:border-gray-800 dark:hover:bg-gray-800/30">
                        <td className="max-w-[220px] truncate px-2 py-3 font-medium text-gray-900 dark:text-white">{program.program}</td>
                        <td className="px-2 py-3 text-center text-gray-600 dark:text-gray-400">{program.students}</td>
                        <td className="px-2 py-3 text-center text-gray-600 dark:text-gray-400">{program.classes}</td>
                        <td className="px-2 py-3 text-center">
                          <ProgressPill value={program.attendance} />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${program.status === 'Active' ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400' : 'border-gray-100 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                            {program.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivityTimeline activities={recentActivity} limit={8} />
        <SystemStatus status={systemStatus} />
      </div>
    </motion.div>
  );
}

const quickActions = [
  { key: 'add-student', label: 'Add Student', icon: UserPlus, href: '/admin/users?action=add' },
  { key: 'create-program', label: 'Create Program', icon: GraduationCap, href: '/admin/programs?action=add' },
  { key: 'classes', label: 'Allocate Class', icon: Users, href: '/admin/classes' },
  { key: 'aptitude', label: 'Aptitude Review', icon: ClipboardCheck, href: '/admin/enrollments?assessment=submitted' },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck, href: '/admin/attendance' },
  { key: 'broadcast', label: 'Announcement', icon: MessageSquare, href: '/admin/messages?action=compose' },
];

function buildEnrollmentChart(enrollments, period) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const byMonth = {};

  enrollments.forEach((item) => {
    if (!item.enrolled_at) return;
    const date = new Date(item.enrolled_at);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { applications: 0, approved: 0, enrolled: 0, rejected: 0 };
    byMonth[key].applications += 1;
    if (item.status === 'active') byMonth[key].enrolled += 1;
    if (item.status === 'approved' || item.status === 'active') byMonth[key].approved += 1;
    if (item.status === 'dropped' || item.status === 'rejected') byMonth[key].rejected += 1;
  });

  const rangeSize = { week: 4, month: 6, quarter: 9, year: 12 }[period] || 6;
  const keys = Object.keys(byMonth).sort().slice(-rangeSize);
  return {
    labels: keys.map((key) => {
      const [year, month] = key.split('-');
      return `${monthNames[Number(month)]} ${year.slice(2)}`;
    }),
    datasets: [
      { label: 'Applications', data: keys.map((key) => byMonth[key].applications), color: '#3b82f6' },
      { label: 'Approved', data: keys.map((key) => byMonth[key].approved), color: '#10b981' },
      { label: 'Active', data: keys.map((key) => byMonth[key].enrolled), color: '#f59e0b' },
      { label: 'Dropped', data: keys.map((key) => byMonth[key].rejected), color: '#ef4444' },
    ],
    summary: {
      applications: enrollments.length,
      approved: enrollments.filter((item) => item.status === 'active' || item.status === 'approved').length,
      enrolled: enrollments.filter((item) => item.status === 'active').length,
      rejected: enrollments.filter((item) => item.status === 'dropped' || item.status === 'rejected').length,
    },
  };
}

function buildAttendanceData(summary) {
  const data = summary || {};
  return [
    { label: 'Present', value: data.present || 0, color: '#10b981' },
    { label: 'Late', value: data.late || 0, color: '#f59e0b' },
    { label: 'Absent', value: data.absent || 0, color: '#ef4444' },
    { label: 'Excused', value: data.excused || 0, color: '#3b82f6' },
  ];
}

function buildProgramPerformance(programs, enrollments, attendancePercentage) {
  return programs.map((program) => {
    const rows = enrollments.filter((item) => item.program_id === program.id);
    const students = rows.filter((item) => item.status === 'active').length;
    const classes = new Set(rows.map((item) => item.class_id).filter(Boolean)).size;
    return {
      id: program.id,
      program: program.title,
      students,
      classes,
      attendance: attendancePercentage,
      status: students > 0 ? 'Active' : 'No Students',
    };
  });
}

function toActivityItems(rows) {
  const typeMap = {
    create: 'admin_action',
    update: 'program_updated',
    delete: 'admin_action',
    'onboarding.recommend': 'enrollment_approved',
    'onboarding.grade': 'enrollment_approved',
    'class.create': 'program_updated',
    'class.update': 'program_updated',
    'class.allocate': 'enrollment_approved',
    'broadcast.send': 'system_update',
  };

  return rows.map((item, index) => ({
    id: item.id || index,
    type: typeMap[item.action] || 'admin_action',
    title: formatActionTitle(item.action, item.entity_type),
    description: item.details || `${item.admin_name || 'Admin'} updated ${item.entity_type || 'system record'}`,
    time: formatRelativeTime(item.created_at),
    meta: item.admin_name || 'System',
  }));
}

function formatActionTitle(action, entityType) {
  const cleanAction = String(action || 'updated').replaceAll('.', ' ');
  const cleanEntity = String(entityType || 'record').replaceAll('_', ' ');
  return `${cleanAction} ${cleanEntity}`;
}

function normalizeHealth(status) {
  if (!status) return {};
  return {
    ...status,
    uptime: status.uptimeSeconds ? `${Math.floor(status.uptimeSeconds / 60)} min` : status.uptime,
    api: status.status === 'ok' ? 'Operational' : 'Issue',
    storage: status.uploads?.status === 'ok' ? 'Ready' : 'Check uploads',
    replication: 'Local',
  };
}

function calculateReadiness(items) {
  const checks = Object.values(items);
  if (!checks.length) return 0;
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getNextAction({ aptitudeReviews, pendingEnrollments, unallocatedStudents, loadErrors, activeClasses, unreadMessages }) {
  if (loadErrors.length) return { title: 'Dashboard data needs attention', detail: 'Refresh the dashboard or inspect the affected management page before making launch decisions.', href: '/admin/system', label: 'Check System', icon: Shield };
  if (aptitudeReviews > 0) return { title: `${aptitudeReviews} aptitude test${aptitudeReviews === 1 ? '' : 's'} awaiting grading`, detail: 'Grade submitted onboarding tests so students can move through admissions.', href: '/admin/enrollments?assessment=submitted', label: 'Review Tests', icon: ClipboardCheck };
  if (pendingEnrollments > 0) return { title: `${pendingEnrollments} enrollment${pendingEnrollments === 1 ? '' : 's'} pending approval`, detail: 'Clear the admissions queue and recommend aptitude tests where needed.', href: '/admin/enrollments?filter=pending', label: 'Open Enrollments', icon: UserPlus };
  if (unallocatedStudents > 0) return { title: `${unallocatedStudents} active student${unallocatedStudents === 1 ? '' : 's'} need class allocation`, detail: 'Assign active students to classes so instructors can manage rosters and forums.', href: '/admin/classes', label: 'Allocate Classes', icon: Users };
  if (unreadMessages > 0) return { title: `${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'}`, detail: 'Respond to operational messages before they become blockers.', href: '/admin/messages', label: 'Open Messages', icon: MessageSquare };
  if (!activeClasses.length) return { title: 'Create your first active class', detail: 'Classes connect enrollments to instructors, attendance, messages, and forums.', href: '/admin/classes', label: 'Manage Classes', icon: GraduationCap };
  return { title: 'System is ready for routine operations', detail: 'Keep programs, announcements, attendance, and audit checks moving.', href: '/admin/messages?action=compose', label: 'Send Update', icon: MessageSquare };
}

function formatEventMeta(event) {
  const time = event.start_time && event.end_time ? `${event.start_time} - ${event.end_time}` : 'All day';
  return `${time}${event.program_name ? ` | ${event.program_name}` : ''}`;
}

function formatRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

function EmptyPanel({ title, detail, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 text-center dark:border-gray-700 ${compact ? 'min-h-[160px] p-5' : 'min-h-[220px] p-8'}`}>
      <BookOpen className="mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
      <p className="font-medium text-gray-700 dark:text-gray-200">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
  );
}

function ReadinessTile({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800/70">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function ProgressPill({ value }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-medium text-gray-700 dark:text-gray-300">{value}%</span>
    </div>
  );
}
