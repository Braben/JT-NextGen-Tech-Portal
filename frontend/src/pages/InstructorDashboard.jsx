import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { assignmentAPI, gradebookAPI, quizAPI, materialAPI, attendanceAPI, classAPI, messageAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import StatCard from '../components/admin/StatCard';
import { LineChart, DonutChart } from '../components/admin/Charts';
import DataTable from '../components/admin/Table';
import LoadingSpinner from '../components/LoadingSpinner';
import { Button } from '../components/ui';
import {
  Plus,
  HelpCircle,
  BookOpen,
  ClipboardCheck,
  Edit,
  Trash2,
  Users,
  CalendarCheck,
  MessageSquare,
  RefreshCcw,
  AlertCircle,
  Send,
} from 'lucide-react';

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [stats, setStats] = useState(null);
  const [classes, setClasses] = useState([]);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [quizzesCount, setQuizzesCount] = useState(0);
  const [materialsCount, setMaterialsCount] = useState(0);
  const [loadErrors, setLoadErrors] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      assignmentAPI.getAll(),
      gradebookAPI.getSummary(),
      quizAPI.getAll({ all: 'true' }),
      materialAPI.getAll({ mine: true }),
      classAPI.getAll(),
      attendanceAPI.getSessions(),
      messageAPI.getConversations(),
    ]);

    const [aRes, sRes, qRes, mRes, cRes, atRes, msgRes] = results;
    if (aRes.status === 'fulfilled') setAssignments(aRes.value.data || []);
    if (sRes.status === 'fulfilled') setStats(sRes.value.data || null);
    if (qRes.status === 'fulfilled') setQuizzesCount((qRes.value.data || []).length);
    if (mRes.status === 'fulfilled') setMaterialsCount((mRes.value.data || []).length);
    if (cRes.status === 'fulfilled') setClasses(cRes.value.data || []);
    if (atRes.status === 'fulfilled') setAttendanceSessions(atRes.value.data || []);
    if (msgRes.status === 'fulfilled') {
      setUnreadMessages((msgRes.value.data || []).reduce((total, item) => total + Number(item.unread || 0), 0));
    }

    // Keep partial dashboard data visible while naming the exact source that failed.
    const labels = ['assignments', 'gradebook', 'quizzes', 'materials', 'classes', 'attendance', 'messages'];
    setLoadErrors(results
      .map((result, index) => result.status === 'rejected' ? labels[index] : null)
      .filter(Boolean));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    const ok = await confirm('Delete this assignment and all submissions? This cannot be undone.', { danger: true, title: 'Delete assignment', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await assignmentAPI.delete(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      toast('Assignment deleted', 'success');
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to delete assignment', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const totalSubmissions = stats?.totalSubmissions ?? assignments.reduce((acc, a) => acc + Number(a.submissionCount || 0), 0);
  const avgScore = stats?.avgScore ?? 0;
  const pendingReview = stats?.pendingSubmissions ?? 0;
  const graded = Math.max(0, totalSubmissions - pendingReview);
  const activeClasses = classes.filter((item) => item.status === 'active');
  const activeStudents = classes.reduce((total, item) => total + Number(item.active_count || item.allocated_count || 0), 0);
  const openSessions = attendanceSessions.filter((session) => session.status === 'open');
  const classWithForum = activeClasses.find((item) => item.forum_category_id) || classes.find((item) => item.forum_category_id);

  const nextAction = pendingReview > 0
    ? { title: `${pendingReview} submission${pendingReview === 1 ? '' : 's'} awaiting review`, detail: 'Grade recent work and send feedback while the context is fresh.', href: '/instructor/gradebook', label: 'Open Gradebook', icon: ClipboardCheck }
    : openSessions.length > 0
      ? { title: openSessions[0].title || 'Attendance session is open', detail: openSessions[0].class_name ? `${openSessions[0].class_name} is taking attendance now.` : 'Review attendance marks and close the session when ready.', href: '/instructor/attendance', label: 'Manage Attendance', icon: CalendarCheck }
      : classWithForum
        ? { title: classWithForum.name, detail: 'Keep the class discussion moving with a prompt or announcement.', href: `/instructor/forums/${classWithForum.forum_category_id}`, label: 'Open Forum', icon: MessageSquare }
        : { title: 'Create your next learning activity', detail: 'Publish an assignment, quiz, or material for your active students.', href: '/instructor/create', label: 'New Assignment', icon: Plus };

  const statCards = [
    { key: 'pendingReview', label: 'To Review', value: pendingReview, subValue: `${graded}/${totalSubmissions} graded`, trend: pendingReview > 0 ? 'down' : 'up', trendLabel: pendingReview > 0 ? 'Needs action' : 'Clear' },
    { key: 'totalAssignments', label: 'Assignments', value: assignments.length, subValue: `${quizzesCount} quizzes`, trend: assignments.length ? 'up' : 'neutral', trendLabel: 'Learning tasks' },
    { key: 'totalStudents', label: 'Active Students', value: activeStudents, subValue: `${activeClasses.length} classes`, trend: activeStudents ? 'up' : 'neutral', trendLabel: 'Allocated roster' },
    { key: 'totalMaterials', label: 'Materials', value: materialsCount, subValue: `${openSessions.length} open attendance`, trend: openSessions.length ? 'down' : 'neutral', trendLabel: 'Teaching resources' },
  ];

  // Sort by deadline so charts, table, and next-work context tell the same story.
  const sortedAssignments = [...assignments].sort((a, b) => new Date(a.due_date || '2999-12-31') - new Date(b.due_date || '2999-12-31'));
  const submissionTrendSource = sortedAssignments.slice(0, 5);
  const submissionTrend = submissionTrendSource.map((a) => Number(a.submissionCount || 0));
  const submissionLabels = submissionTrendSource.map((a, index) => a.title?.slice(0, 12) || `A${index + 1}`);
  const donutData = [
    { label: 'Graded', value: graded, color: '#16a34a' },
    { label: 'Pending', value: Math.max(0, pendingReview), color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  const columns = [
    { key: 'title', label: 'Assignment', sortable: true, render: (row) => (
      <div>
        <span className="font-medium text-gray-900 dark:text-white">{row.title}</span>
        {row.description && <p className="mt-1 max-w-md truncate text-xs text-gray-500">{row.description}</p>}
      </div>
    ) },
    { key: 'due_date', label: 'Due', sortable: true, render: (row) => <DueBadge dueDate={row.due_date} /> },
    { key: 'submissionCount', label: 'Submissions', align: 'center', render: (row) => <span className="text-sm font-semibold text-gray-900 dark:text-white">{Number(row.submissionCount || 0)}</span> },
    { key: 'max_score', label: 'Max', align: 'center', render: (row) => <span className="text-sm font-medium">{row.max_score} pts</span> },
    { key: 'status', label: 'Status', align: 'center', render: (row) => <AssignmentStatus row={row} /> },
    { key: 'action', label: 'Action', align: 'center', render: (row) => (
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => navigate(`/instructor/edit/${row.id}`)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300"
        >
          <Edit className="h-3.5 w-3.5" aria-hidden="true" />
          Manage
        </button>
        <button
          type="button"
          onClick={() => handleDelete(row.id)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </button>
      </div>
    ) },
  ];

  const quickActions = [
    { label: 'New Assignment', icon: Plus, href: '/instructor/create' },
    { label: 'Upload Material', icon: BookOpen, href: '/instructor/materials' },
    { label: 'Create Quiz', icon: HelpCircle, href: '/instructor/quizzes' },
    { label: 'Gradebook', icon: ClipboardCheck, href: '/instructor/gradebook' },
    { label: 'Attendance', icon: CalendarCheck, href: '/instructor/attendance' },
    { label: 'Messages', icon: MessageSquare, href: '/instructor/messages' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-700 dark:text-brand-300">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Instructor Dashboard</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Review teaching priorities, classes, feedback, and attendance from one workspace.</p>
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

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ key, ...props }) => (
          <StatCard key={key} cardKey={key} {...props} />
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Submissions Overview</h3>
            <span className="rounded-full border border-brand-100 bg-brand-50 px-2 py-1 text-xs text-brand-700">Next 5 deadlines</span>
          </div>
          {submissionTrend.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">Create assignments to track submission volume</div>
          ) : (
            <LineChart data={[submissionTrend]} labels={submissionLabels} showLegend={false} />
          )}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MetricTile label="Total" value={totalSubmissions} tone="neutral" />
            <MetricTile label="Graded" value={graded} tone="success" />
            <MetricTile label="Pending" value={pendingReview} tone="warning" />
          </div>
        </div>

        <div className="card h-full">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Grading Status</h3>
            <span className="text-xs text-gray-500">{totalSubmissions} submissions</span>
          </div>
          {totalSubmissions === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">No submissions yet</div>
          ) : (
            <DonutChart data={donutData.length ? donutData : [{ label: 'Empty', value: 1, color: '#e5e7eb' }]} size={160} strokeWidth={22} showCenter centerValue={`${totalSubmissions ? Math.round((graded / totalSubmissions) * 100) : 0}%`} centerLabel="Graded" />
          )}
        </div>
      </div>

      {classes.length > 0 && (
        <section className="card mb-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Teaching Classes</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Roster, message, and discussion entry points for your allocated classes.</p>
            </div>
            <Link to="/instructor/classes" className="text-sm font-medium text-brand-600 hover:text-brand-700">Manage classes →</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {classes.slice(0, 4).map((item) => (
              <article key={item.id} className="rounded-xl border border-gray-100 p-3 transition-colors hover:border-brand-200 dark:border-gray-700">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.name}</h3>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{item.code}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-gray-500">{item.program_title}</p>
                    <p className="mt-1 text-xs text-gray-500">{Number(item.active_count || 0)} active students</p>
                  </div>
                  <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>{item.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigate('/instructor/classes')} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    Roster
                  </button>
                  <button type="button" onClick={() => navigate('/instructor/classes')} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    Message
                  </button>
                  {item.forum_category_id && (
                    <button type="button" onClick={() => navigate(`/instructor/forums/${item.forum_category_id}`)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      Forum
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="card mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
          {unreadMessages > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{unreadMessages} unread messages</span>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((a) => (
            <button key={a.label} onClick={() => navigate(a.href)} className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-gray-100 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/50 dark:border-gray-700 dark:hover:bg-brand-900/10">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"><a.icon className="h-5 w-5" /></span>
              <span className="text-center text-xs font-medium text-gray-700 dark:text-gray-200">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Assignment Management</h2>
          <Link to="/instructor/create" className="text-sm font-medium text-brand-600 hover:text-brand-700">Create new →</Link>
        </div>
        <DataTable columns={columns} data={sortedAssignments} keyField="id" loading={false} emptyMessage="No assignments yet. Create the first learning task for your class." pagination={sortedAssignments.length > 8 ? { page: 1, pageSize: 8, total: sortedAssignments.length } : undefined} />
      </div>
    </motion.div>
  );
}

function DueBadge({ dueDate }) {
  if (!dueDate) return <span className="text-xs text-gray-500">No deadline</span>;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due - today) / 86400000);
  const overdue = days < 0;
  const soon = days >= 0 && days <= 3;

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

function AssignmentStatus({ row }) {
  const overdue = row.due_date && new Date(row.due_date) < new Date();
  const submissions = Number(row.submissionCount || 0);
  if (overdue) {
    return <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">Past due</span>;
  }
  if (submissions > 0) {
    return <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Receiving</span>;
  }
  return <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">Published</span>;
}

function MetricTile({ label, value, tone }) {
  const tones = {
    neutral: 'bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-white',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  };

  return (
    <div className={`rounded-lg p-3 text-center ${tones[tone] || tones.neutral}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}
