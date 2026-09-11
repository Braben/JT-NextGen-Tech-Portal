import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { gradebookAPI, gradingAPI, submissionAPI } from '../api';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Gradebook() {
  const [grades, setGrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';
  const [searchParams] = useSearchParams();
  const focusSubmissionId = searchParams.get('submission');

  const [manualGrades, setManualGrades] = useState({});

  useEffect(() => {
    Promise.all([gradebookAPI.getAll(), gradebookAPI.getSummary()])
      .then(([gRes, sRes]) => {
        setGrades(gRes.data);
        setStats(sRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleManualSave = async (submissionId) => {
    const data = manualGrades[submissionId];
    if (!data) return;
    try {
      await gradingAPI.manualGrade(submissionId, data);
      const res = await gradebookAPI.getAll();
      setGrades(res.data);
      setManualGrades((prev) => { const n = { ...prev }; delete n[submissionId]; return n; });
      toast('Grade saved successfully', 'success');
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to save grade', 'error');
    }
  };

  const handleQuickGrade = (submissionId, field, value) => {
    setManualGrades((prev) => ({
      ...prev,
      [submissionId]: { ...(prev[submissionId] || { score: 0, feedback: '', strengths: '', weaknesses: '', suggestions: '' }), [field]: value },
    }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gradebook</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{isInstructor ? 'View and manage all student grades' : 'Track your academic performance'}</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {isInstructor ? (
            <>
              <StatCard label="Total Submissions" value={stats.totalSubmissions} />
              <StatCard label="Graded" value={stats.gradedSubmissions} />
              <StatCard label="Avg Score" value={`${stats.avgScore}%`} highlight />
              <StatCard label="Ungraded" value={stats.totalSubmissions - stats.gradedSubmissions} />
            </>
          ) : (
            <>
              <StatCard label="Assignments" value={stats.totalAssignments} />
              <StatCard label="Submitted" value={stats.submittedCount} />
              <StatCard label="Graded" value={stats.gradedCount} />
              <StatCard label="Avg Score" value={`${stats.avgScore}%`} highlight />
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {isInstructor && <th className="text-left py-3 px-3 font-semibold text-gray-600 dark:text-gray-300">Student</th>}
                <th className="text-left py-3 px-3 font-semibold text-gray-600 dark:text-gray-300">Assignment</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-600 dark:text-gray-300">Score</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-600 dark:text-gray-300">Grade</th>
                {isInstructor && <th className="text-center py-3 px-3 font-semibold text-gray-600 dark:text-gray-300">Actions</th>}
                <th className="text-center py-3 px-3 font-semibold text-gray-600 dark:text-gray-300">Link</th>
              </tr>
            </thead>
            <tbody>
              {grades.length === 0 ? (
                <tr><td colSpan={isInstructor ? 7 : 5} className="text-center py-10 text-gray-400">No records found</td></tr>
              ) : (
                grades.map((g, i) => {
                  const mg = manualGrades[g.submission_id] || {};
                  const hasOverride = Object.keys(manualGrades).includes(g.submission_id);
                  const isFocus = g.submission_id === focusSubmissionId;
                  return (
                    <tr key={`${g.student_id || ''}-${g.assignment_id}-${i}`} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${isFocus ? 'bg-brand-50 ring-2 ring-brand-300' : ''}`}>
                      {isInstructor && <td className="py-3 px-3 font-medium text-gray-800 dark:text-gray-100">{g.student_name || 'Unknown'}</td>}
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-200">{g.assignment_title}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          g.submission_status === 'graded' ? 'bg-green-100 text-green-700' :
                          g.submission_status === 'submitted' || g.submission_status === 'resubmitted' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-500 dark:text-gray-400'
                        }`}>
                          {g.submission_status || 'Not submitted'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {g.score !== null ? (
                          <span className="font-bold text-brand-600">{Math.round(g.score)}</span>
                        ) : '-'}
                        <span className="text-gray-400 text-xs">/{g.max_score}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isInstructor && g.submission_id ? (
                          <input
                            type="number"
                            className={`w-20 text-center input-field text-sm py-1 ${hasOverride ? 'border-orange-300 ring-1 ring-orange-200' : ''}`}
                            value={mg.score !== undefined ? mg.score : (g.score || '')}
                            onChange={(e) => handleQuickGrade(g.submission_id, 'score', e.target.value)}
                            placeholder="-"
                          />
                        ) : (
                          <span className={g.manually_overridden ? 'text-orange-600 font-medium' : 'text-gray-600 dark:text-gray-300'}>
                            {g.score !== null ? `${Math.round(g.score)}/${g.max_score}` : '-'}
                          </span>
                        )}
                      </td>
                      {isInstructor && (
                        <td className="py-3 px-3 text-center">
                          {g.submission_id && (
                            <div className="flex items-center justify-center gap-1">
                              {hasOverride && (
                                <button onClick={() => handleManualSave(g.submission_id)} className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded transition-colors">
                                  Save
                                </button>
                              )}
                              <button onClick={() => setManualGrades((prev) => {
                                const n = { ...prev };
                                if (n[g.submission_id]) delete n[g.submission_id];
                                return n;
                              })} className="text-xs btn-secondary py-1 px-2">
                                {hasOverride ? 'Cancel' : 'Override'}
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                      <td className="py-3 px-3 text-center">
                        {g.submission_id ? (
                          <Link to={`/submission/${g.submission_id}`} className="text-brand-600 hover:text-brand-700 text-xs font-medium">
                            View
                          </Link>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`card text-center ${highlight ? 'border-brand-200 bg-brand-50/30' : ''}`}>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-600' : 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}
