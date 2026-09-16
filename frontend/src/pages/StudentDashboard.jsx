import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { assignmentAPI, submissionAPI, gradebookAPI, enrollmentAPI, materialAPI, quizAPI, attendanceAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/admin/StatCard';
import { LineChart, DonutChart } from '../components/admin/Charts';
import DataTable from '../components/admin/Table';
import { Button } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import { BookOpen, HelpCircle, CalendarCheck, Award, TrendingUp, Eye, Send, GraduationCap, MessageSquare, RefreshCcw, AlertCircle } from 'lucide-react';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [materialsCount, setMaterialsCount] = useState(0);
  const [quizzesCount, setQuizzesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      assignmentAPI.getAll(),
      submissionAPI.my(),
      gradebookAPI.getSummary(),
      enrollmentAPI.getAll(),
      materialAPI.getAll(),
      quizAPI.getAll({ all: 'true' }),
      attendanceAPI.getSummary(),
    ]);

    const [aRes, sRes, gRes, eRes, mRes, qRes, atRes] = results;
    if (aRes.status === 'fulfilled') setAssignments(aRes.value.data || []);
    if (sRes.status === 'fulfilled') setMySubmissions(sRes.value.data || []);
    if (gRes.status === 'fulfilled') setStats(gRes.value.data || null);
    if (eRes.status === 'fulfilled') setEnrollments(eRes.value.data || []);
    if (mRes.status === 'fulfilled') setMaterialsCount((mRes.value.data || []).length);
    if (qRes.status === 'fulfilled') setQuizzesCount((qRes.value.data || []).length);
    if (atRes.status === 'fulfilled') setAttendanceSummary(atRes.value.data || null);

    const labels = ['assignments', 'submissions', 'grades', 'programmes', 'materials', 'quizzes', 'attendance'];
    setLoadErrors(results
      .map((result, index) => result.status === 'rejected' ? labels[index] : null)
      .filter(Boolean));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>;
  }

  const assignmentMap = {};
  assignments.forEach((assignment) => { assignmentMap[assignment.id] = assignment; });
  const submissionMap = {};
  mySubmissions.forEach((s) => { submissionMap[s.assignment_id] = s; });

  const totalAssignments = stats?.totalAssignments ?? assignments.length;
  const submittedCount = stats?.submittedCount ?? mySubmissions.length;
  const gradedCount = stats?.gradedCount ?? mySubmissions.filter(s => s.status === 'graded' || s.score !== null).length;
  const avgScore = stats?.avgScore ?? 0;
  const pending = Math.max(0, totalAssignments - submittedCount);
  const attendanceRate = attendanceSummary?.percentage ?? 0;
  const pendingAssignments = assignments
    .filter((assignment) => !submissionMap[assignment.id])
    .sort((a, b) => new Date(a.due_date || '2999-12-31') - new Date(b.due_date || '2999-12-31'));
  const nextAssignment = pendingAssignments[0];
  const activeEnrollment = enrollments.find((item) => item.status === 'active') || enrollments[0];
  const nextAction = nextAssignment
    ? { title: nextAssignment.title, detail: nextAssignment.due_date ? `Due ${new Date(nextAssignment.due_date).toLocaleDateString()}` : 'No deadline set', href: `/student/submit/${nextAssignment.id}`, label: 'Submit Assignment', icon: Send }
    : activeEnrollment?.class_forum_category_id
      ? { title: activeEnrollment.class_name || activeEnrollment.program_title, detail: 'Join your class discussion', href: `/student/forums/${activeEnrollment.class_forum_category_id}`, label: 'Open Discussion', icon: MessageSquare }
      : { title: 'Progress overview', detail: 'Review grades, attendance, and learning activity', href: '/student/progress', label: 'View Progress', icon: TrendingUp };

  const statCards = [
    { key: 'totalAssignments', label: 'To Submit', value: pending, subValue: `${submittedCount}/${totalAssignments} done`, trend: pending ? 'down' : 'up', trendLabel: pending ? 'Needs action' : 'Clear' },
    { key: 'submittedCount', label: 'Submitted', value: submittedCount, subValue: `${gradedCount} graded`, trend: gradedCount ? 'up' : 'neutral', trendLabel: 'Reviewed work' },
    { key: 'gradedCount', label: 'Average Score', value: `${Math.round(avgScore)}%`, subValue: `${gradedCount} graded`, trend: avgScore >= 70 ? 'up' : avgScore > 0 ? 'down' : 'neutral', trendLabel: avgScore >= 70 ? 'Strong' : avgScore > 0 ? 'Needs support' : 'Waiting' },
    { key: 'totalMaterials', label: 'Attendance', value: `${attendanceRate}%`, subValue: `${attendanceSummary?.total || 0} records`, trend: attendanceRate >= 80 ? 'up' : attendanceRate > 0 ? 'down' : 'neutral', trendLabel: 'Presence rate' },
  ];

  const gradedSubmissions = mySubmissions
    .filter((submission) => submission.score !== null && submission.score !== undefined)
    .sort((a, b) => new Date(a.submitted_at || a.graded_at || 0) - new Date(b.submitted_at || b.graded_at || 0))
    .slice(-5);
  const scores = gradedSubmissions.map(s => Math.round(s.score || 0)).filter(v => v >= 0);
  const scoreLabels = gradedSubmissions.map((submission, index) => assignmentMap[submission.assignment_id]?.title?.slice(0, 12) || `A${index + 1}`);
  const donutData = [
    { label: 'Graded', value: gradedCount, color: '#16a34a' },
    { label: 'Submitted', value: Math.max(0, submittedCount - gradedCount), color: '#f59e0b' },
    { label: 'Pending', value: pending, color: '#e5e7eb' },
  ].filter(d => d.value > 0);

  const columns = [
    { key: 'title', label: 'Assignment', render: (row) => (
      <div>
        <span className="font-medium text-gray-900 dark:text-white">{row.title}</span>
        {row.description && <p className="mt-1 max-w-md truncate text-xs text-gray-500">{row.description}</p>}
      </div>
    ) },
    { key: 'due_date', label: 'Due', render: (row) => <DueBadge dueDate={row.due_date} submitted={Boolean(submissionMap[row.id])} /> },
    { key: 'status', label: 'Status', align: 'center', render: (row) => {
      const sub = submissionMap[row.id];
      if (!sub) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">Pending</span>;
      if (sub.status === 'graded' || sub.score !== null) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Graded {Math.round(sub.score)}/{row.max_score}</span>;
      return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Submitted</span>;
    }},
    { key: 'action', label: 'Action', align: 'center', render: (row) => {
      const sub = submissionMap[row.id];
      return (
        <button
          type="button"
          onClick={() => navigate(`/student/submit/${row.id}`)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300"
        >
          {sub ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
          {sub ? 'View' : 'Submit'}
        </button>
      );
    }},
  ];

  const quickActions = [
    { label: 'My Class', icon: GraduationCap, href: '/student/classes' },
    { label: 'View Materials', icon: BookOpen, href: '/student/materials' },
    { label: 'Take Quiz', icon: HelpCircle, href: '/student/quizzes' },
    { label: 'Check Attendance', icon: CalendarCheck, href: '/student/attendance' },
    { label: 'Messages', icon: MessageSquare, href: '/student/messages' },
    { label: 'Progress', icon: TrendingUp, href: '/student/progress' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
        <div>
          <p className="text-sm font-medium text-brand-700 dark:text-brand-300">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Student Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Today's priorities, class context, and learning progress in one place.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={fetchData} icon={RefreshCcw}>Refresh</Button>
          <Button onClick={() => navigate(nextAction.href)} icon={nextAction.icon}>{nextAction.label}</Button>
        </div>
      </div>

      {loadErrors.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Some dashboard data could not load: {loadErrors.join(', ')}. Use refresh or open the related page directly.</p>
        </div>
      )}

      <section className="card mb-6 border-l-4 border-l-brand-500">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Next Best Action</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-white">{nextAction.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{nextAction.detail}</p>
          </div>
          <Button onClick={() => navigate(nextAction.href)} icon={nextAction.icon}>{nextAction.label}</Button>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ key, ...props }) => (
          <StatCard key={key} cardKey={key} {...props} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Score Trend</h3>
            <span className="text-xs px-2 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100">Last 5 graded</span>
          </div>
          {scores.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">Complete assignments to see your trend</div>
          ) : (
            <LineChart data={[scores]} labels={scoreLabels} showLegend={false} />
          )}
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <Award className="w-4 h-4 text-amber-500" /> Avg score <span className="font-semibold text-gray-900 dark:text-white">{Math.round(avgScore)}%</span> across <span className="font-semibold">{gradedCount}</span> graded
          </div>
        </div>

        <div className="card h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Completion</h3>
            <span className="text-xs text-gray-500">{submittedCount}/{totalAssignments}</span>
          </div>
          <DonutChart data={donutData.length ? donutData : [{ label: 'Empty', value: 1, color: '#e5e7eb' }]} size={160} strokeWidth={22} showCenter centerValue={`${totalAssignments ? Math.round((submittedCount / totalAssignments) * 100) : 0}%`} centerLabel="Done" />
        </div>
      </div>

      {enrollments.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">My Programs</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {enrollments.map((e) => (
              <div key={e.id} className="flex flex-col gap-3 p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-brand-200 transition-colors sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-white">{e.program_title}</p>
                  <p className="text-xs text-gray-400">{e.session} Session | {e.duration}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {e.class_name ? `Class: ${e.class_name} (${e.class_code})${e.instructor_name ? ` - ${e.instructor_name}` : ''}` : 'Class allocation pending'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {e.class_forum_category_id && (
                    <Link to={`/student/forums/${e.class_forum_category_id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      Forum
                    </Link>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${e.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : e.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>{e.status}</span>
                </div>
              </div>
            ))}
          </div>
          <Link to="/programs" className="text-sm text-brand-600 hover:text-brand-700 font-medium mt-3 inline-flex items-center gap-1">Browse more programs <TrendingUp className="w-4 h-4" /></Link>
        </div>
      )}

      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {quickActions.map((a) => (
            <button key={a.label} onClick={() => navigate(a.href)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-200 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-colors cursor-pointer">
              <span className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400"><a.icon className="w-5 h-5" /></span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200 text-center">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current Assignments</h2>
          <Link to="/student/progress" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all →</Link>
        </div>
        <DataTable columns={columns} data={assignments} keyField="id" emptyMessage="No assignments available yet" pagination={assignments.length > 8 ? { page: 1, pageSize: 8, total: assignments.length } : undefined} />
      </div>
    </motion.div>
  );
}

function DueBadge({ dueDate, submitted }) {
  if (!dueDate) return <span className="text-xs text-gray-500">No deadline</span>;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due - today) / 86400000);
  const overdue = days < 0 && !submitted;
  const soon = days >= 0 && days <= 3 && !submitted;

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
      overdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
      soon ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
    }`}>
      {overdue ? `${Math.abs(days)}d overdue` : soon ? `${days || 'Today'}${days ? 'd left' : ''}` : due.toLocaleDateString()}
    </span>
  );
}
