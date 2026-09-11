import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { gradebookAPI, progressAPI, attendanceAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function ProgressDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [gradeSummary, setGradeSummary] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [g, a, q] = await Promise.all([
        gradebookAPI.getSummary().catch(() => null),
        attendanceAPI.getSummary().catch(() => null),
        progressAPI.getQuizPerformance().catch(() => ({ data: [] })),
      ]);
      if (g) setGradeSummary(g.data);
      if (a) setAttendance(a.data);
      if (q) setQuizzes(q.data?.filter(qq => qq.submission) || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const fadeItem = (delay) => ({ initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 }, transition: { delay } });

  if (loading) return <div className="text-center py-12 text-gray-500">Loading your progress...</div>;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'grades', label: 'Grades' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'quizzes', label: 'Quizzes' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Progress Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Track your academic performance across all programs</p>
      </motion.div>

      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <motion.div {...fadeItem(0)} className="card text-center">
            <p className="text-sm text-gray-500">Overall Grade</p>
            <p className="text-3xl font-bold mt-1" style={{ color: gradeSummary?.average >= 70 ? '#059669' : gradeSummary?.average >= 50 ? '#ca8a04' : '#dc2626' }}>
              {gradeSummary?.average != null ? `${gradeSummary.average.toFixed(1)}%` : 'N/A'}
            </p>
          </motion.div>
          <motion.div {...fadeItem(0.1)} className="card text-center">
            <p className="text-sm text-gray-500">Attendance Rate</p>
            <p className="text-3xl font-bold mt-1 text-brand-600">{attendance?.rate != null ? `${attendance.rate.toFixed(1)}%` : 'N/A'}</p>
          </motion.div>
          <motion.div {...fadeItem(0.2)} className="card text-center">
            <p className="text-sm text-gray-500">Quizzes Completed</p>
            <p className="text-3xl font-bold mt-1 text-brand-600">{quizzes.length}</p>
          </motion.div>
        </div>
      )}

      {activeTab === 'grades' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Grade Breakdown</h2>
          {gradeSummary?.breakdown?.length > 0 ? gradeSummary.breakdown.map((b, i) => (
            <motion.div key={i} {...fadeItem(i * 0.05)} className="card">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-900">{b.assignment_title || b.program_name || 'Assignment'}</span>
                <span className="text-sm font-semibold" style={{ color: b.score >= 70 ? '#059669' : b.score >= 50 ? '#ca8a04' : '#dc2626' }}>{b.score != null ? `${b.score}%` : 'N/A'}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(b.score || 0, 100)}%`, backgroundColor: b.score >= 70 ? '#059669' : b.score >= 50 ? '#ca8a04' : '#dc2626' }} />
              </div>
            </motion.div>
          )) : <p className="text-gray-400 text-center py-8">No graded assignments yet.</p>}
        </motion.div>
      )}

      {activeTab === 'attendance' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card text-center">
              <p className="text-sm text-gray-500">Present</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{attendance?.present || 0}</p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-gray-500">Absent</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{attendance?.absent || 0}</p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-gray-500">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-700 mt-1">{(attendance?.present || 0) + (attendance?.absent || 0)}</p>
            </div>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-2">Attendance Rate</p>
            <div className="w-full bg-gray-100 rounded-full h-4">
              <div className="h-4 rounded-full bg-brand-600 transition-all flex items-center justify-end pr-2" style={{ width: `${Math.min(attendance?.rate || 0, 100)}%` }}>
                <span className="text-xs text-white font-medium">{attendance?.rate != null ? `${attendance.rate.toFixed(0)}%` : ''}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'quizzes' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Quiz Results</h2>
          {quizzes.length > 0 ? quizzes.map((q, i) => {
            const pct = q.submission.total_points > 0 ? (q.submission.score / q.submission.total_points) * 100 : 0;
            return (
              <motion.div key={q.id} {...fadeItem(i * 0.05)} className="card">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900">{q.title}</h3>
                    <p className="text-xs text-gray-400">{q.submission.submitted_at ? new Date(q.submission.submitted_at).toLocaleDateString() : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {q.submission.score}/{q.submission.total_points}
                    </p>
                    <p className="text-xs text-gray-400">{pct.toFixed(0)}%</p>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= 70 ? '#059669' : pct >= 50 ? '#ca8a04' : '#dc2626' }} />
                </div>
              </motion.div>
            );
          }) : <p className="text-gray-400 text-center py-8">No quizzes completed yet.</p>}
        </motion.div>
      )}
    </div>
  );
}
