import { useState, useEffect } from 'react';
import { attendanceAPI, programAPI, classAPI } from '../api';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { Edit, Trash2 } from 'lucide-react';

export default function Attendance() {
  const { user } = useAuth();
  if (user.role === 'student') return <StudentAttendance />;
  return <InstructorAttendance />;
}

function StudentAttendance() {
  const [sessions, setSessions] = useState([]);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(null);
  const [message, setMessage] = useState(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([attendanceAPI.getActiveSessions(), attendanceAPI.getAll(), attendanceAPI.getSummary()])
      .then(([aRes, rRes, sRes]) => { setSessions(aRes.data); setRecords(rRes.data); setSummary(sRes.data); })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load attendance data' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleSelfMark = async (sessionId) => {
    setMarking(sessionId);
    try {
      const res = await attendanceAPI.selfMark(sessionId);
      const msg = res.data.status === 'late' ? 'Marked as late' : 'Attendance marked! You are present.';
      setMessage({ type: 'success', text: msg });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to mark attendance' });
    } finally {
      setMarking(null);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const sessionState = (s) => {
    if (s.status !== 'open') return 'closed';
    if (s.date !== new Date().toISOString().slice(0, 10)) return 'past';
    const [h, m] = (s.closes_at || '00:00').split(':').map(Number);
    const close = new Date(); close.setHours(h, m, 0);
    return new Date() <= close ? 'open' : 'late_window';
  };

  const getTimeRemaining = (s) => {
    const [h, m] = s.closes_at.split(':').map(Number);
    const close = new Date(); close.setHours(h, m, 0);
    const diff = close - new Date();
    if (diff <= 0) return null;
    const mins = Math.floor(diff / 60000);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Attendance</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Mark yourself present for today's sessions</p>

      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm mb-4 border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message.text}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Present" value={summary.present} color="green" />
          <StatCard label="Late" value={summary.late} color="yellow" />
          <StatCard label="Absent" value={summary.absent} color="red" />
          <StatCard label="Excused" value={summary.excused} color="blue" />
          <StatCard label="Rate" value={`${summary.percentage}%`} highlight />
        </div>
      )}

      <div className="space-y-3 mb-6">
        {sessions.map(s => {
          const state = sessionState(s);
          const timeLeft = getTimeRemaining(s);
          const colorBorder = state === 'open' ? 'border-brand-200' : state === 'late_window' ? 'border-orange-200' : 'border-gray-100';

          return (
            <div key={s.id} className={`card border-l-4 ${colorBorder}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{s.class_name || s.program_title}</h3>
                    {s.title && <span className="text-xs text-gray-400">({s.title})</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {s.class_name && <span>{s.program_title}</span>}
                    <span>by {s.instructor_name}</span>
                    <span>closes at {s.closes_at}</span>
                    {timeLeft && state === 'open' && <span className={`font-medium ${parseInt(timeLeft) <= 5 ? 'text-orange-500' : 'text-green-500'}`}>{timeLeft} left</span>}
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  {s.my_status ? (
                    <StatusBadge status={s.my_status} />
                  ) : state === 'open' ? (
                    <button onClick={() => handleSelfMark(s.id)} disabled={marking === s.id} className="btn-primary text-sm px-5 py-1.5">
                      {marking === s.id ? '...' : 'Mark Present'}
                    </button>
                  ) : state === 'late_window' ? (
                    <div className="text-right">
                      <button onClick={() => handleSelfMark(s.id)} disabled={marking === s.id} className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-5 py-1.5 rounded-lg font-medium transition-colors">
                        {marking === s.id ? '...' : 'Mark Late'}
                      </button>
                      <p className="text-xs text-orange-500 mt-1">Past closing time</p>
                    </div>
                  ) : (
                    <span className="text-xs bg-gray-200 text-gray-500 dark:text-gray-400 px-3 py-1.5 rounded-full font-medium">Closed</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {sessions.length === 0 && (
          <div className="card bg-gray-50 dark:bg-gray-800/50 border-dashed border-gray-200 text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 font-medium">No sessions</p>
            <p className="text-gray-400 text-sm mt-1">Wait for your instructor to open attendance</p>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">History</h2>
        {records.length === 0 ? (
          <div className="text-center py-12"><p className="text-gray-400">No records yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                  <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">Program</th>
                  <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">Instructor</th>
                  <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                  <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-2">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-3 px-2">{r.class_name ? `${r.class_name} (${r.program_title})` : r.program_title}</td>
                    <td className="py-3 px-2 text-gray-500 dark:text-gray-400">{r.instructor_name}</td>
                    <td className="py-3 px-2"><StatusBadge status={r.status} /></td>
                    <td className="py-3 px-2 text-gray-400 text-xs">{new Date(r.marked_at || r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function InstructorAttendance() {
  const confirm = useConfirm();
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [detail, setDetail] = useState(null);
  const [overrideStatus, setOverrideStatus] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [view, setView] = useState('sessions'); // 'sessions' | 'students'
  const [students, setStudents] = useState([]);
  const [studentDetail, setStudentDetail] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loadingStudent, setLoadingStudent] = useState(false);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [sRes, sumRes, pRes, cRes] = await Promise.all([attendanceAPI.getSessions(), attendanceAPI.getSummary(), programAPI.getAll(), classAPI.getAll()]);
      setSessions(sRes.data); setSummary(sumRes.data); setPrograms(pRes.data); setClasses(cRes.data || []);
    } catch { setError('Failed to load data'); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedSession) {
      attendanceAPI.getSession(selectedSession).then(r => { setDetail(r.data); }).catch(() => setDetail(null));
    } else { setDetail(null); }
  }, [selectedSession]);

  useEffect(() => {
    if (view === 'students') {
      attendanceAPI.getStudents().then(r => setStudents(r.data || [])).catch(() => {});
    }
  }, [view]);

  const lookupStudent = async (studentId) => {
    if (!studentId) return;
    setLoadingStudent(true); setStudentDetail(null);
    try {
      const r = await attendanceAPI.getStudent(studentId);
      setStudentDetail(r.data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to load student attendance'); }
    finally { setLoadingStudent(false); }
  };

  const [form, setForm] = useState({ program_id: '', class_id: '', date: new Date().toISOString().split('T')[0], closes_at_minutes: '30', title: '' });
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setForm({ program_id: '', class_id: '', date: new Date().toISOString().split('T')[0], closes_at_minutes: '30', title: '' });
    setEditingId(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!form.program_id) { setError('Please select a program'); return; }
    try {
      if (editingId) {
        await attendanceAPI.updateSession(editingId, form);
        setSuccess('Session updated!');
      } else {
        await attendanceAPI.createSession(form);
        setSuccess('Session opened!');
      }
      setShowCreate(false); resetForm();
      loadData();
    } catch (err) { setError(err.response?.data?.error || 'Failed to save session'); }
    setTimeout(() => { setError(''); setSuccess(''); }, 5000);
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setForm({ program_id: s.program_id, class_id: s.class_id || '', date: s.date, closes_at_minutes: '30', title: s.title || '' });
    setShowCreate(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Delete this session? All attendance for it will be removed.', { danger: true, title: 'Delete Session', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await attendanceAPI.deleteSession(id);
      setSuccess('Session deleted');
      if (selectedSession === id) { setSelectedSession(null); setDetail(null); }
      loadData();
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete'); }
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const handleClose = async (id) => {
    const ok = await confirm('Close this session? Unmarked students will be marked absent.', { danger: true, title: 'Close session', confirmText: 'Close' });
    if (!ok) return;
    try {
      const res = await attendanceAPI.closeSession(id);
      setSuccess(`Session closed. ${res.data.auto_marked} marked absent.`);
      loadData(); if (selectedSession === id) setDetail(null);
    } catch (err) { setError(err.response?.data?.error || 'Failed to close session'); }
    setTimeout(() => { setError(''); setSuccess(''); }, 5000);
  };

  const handleOverride = async (studentId, status) => {
    if (!status) return;
    try {
      await attendanceAPI.overrideStudent(selectedSession, studentId, { status });
      setSuccess(`Status updated to ${status}`);
      const r = await attendanceAPI.getSession(selectedSession);
      setDetail(r.data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to update'); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const now = new Date().toISOString().slice(0, 10);
  const isOpen = (s) => s.status === 'open' && s.date === now;

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance Sessions</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Open attendance for students to self-mark</p>
        </div>
        {view === 'sessions' ? (
          <button onClick={() => { if (showCreate) resetForm(); setShowCreate(!showCreate); setError(''); }} className="btn-primary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {showCreate ? 'Cancel' : 'New Session'}
          </button>
        ) : (
          <button onClick={() => { setSelectedStudent(''); setStudentDetail(null); setView('sessions'); }} className="btn-secondary flex items-center gap-2 text-sm">
            Back to Sessions
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto w-full sm:w-fit">
        <button onClick={() => setView('sessions')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${view === 'sessions' ? 'bg-white dark:bg-gray-700 text-brand-700 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          Sessions
        </button>
        <button onClick={() => setView('students')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${view === 'students' ? 'bg-white dark:bg-gray-700 text-brand-700 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
          Student Lookup
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 border border-red-200">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm mb-4 border border-green-200">{success}</div>}

      {view === 'students' ? (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Student Attendance Lookup</h2>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select className="input-field sm:w-80" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
              <option value="">Select a student...</option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>{st.name} — {st.program_title}</option>
              ))}
            </select>
            <button onClick={() => lookupStudent(selectedStudent)} disabled={!selectedStudent || loadingStudent} className="btn-primary text-sm">
              {loadingStudent ? 'Loading...' : 'View Attendance'}
            </button>
          </div>

          {studentDetail && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold">{studentDetail.student.name.charAt(0)}</div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{studentDetail.student.name}</p>
                  <p className="text-xs text-gray-400">{studentDetail.student.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                <StatCard label="Present" value={studentDetail.summary.present} color="green" />
                <StatCard label="Late" value={studentDetail.summary.late} color="yellow" />
                <StatCard label="Absent" value={studentDetail.summary.absent} color="red" />
                <StatCard label="Excused" value={studentDetail.summary.excused} color="blue" />
                <StatCard label="Rate" value={`${studentDetail.summary.percentage}%`} highlight />
              </div>

              {studentDetail.records.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No attendance records for this student yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Program</th>
                        <th className="text-left py-2 px-2">Session</th>
                        <th className="text-left py-2 px-2">Instructor</th>
                        <th className="text-center py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentDetail.records.map((r) => (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-2">{new Date(r.session_date || r.date).toLocaleDateString()}</td>
                          <td className="py-2 px-2 text-gray-500 dark:text-gray-400">{r.program_title}</td>
                          <td className="py-2 px-2">{r.session_title || '—'}</td>
                          <td className="py-2 px-2 text-gray-500 dark:text-gray-400">{r.instructor_name}</td>
                          <td className="py-2 px-2 text-center"><StatusBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Present" value={summary.present} color="green" />
          <StatCard label="Late" value={summary.late} color="yellow" />
          <StatCard label="Absent" value={summary.absent} color="red" />
          <StatCard label="Excused" value={summary.excused} color="blue" />
          <StatCard label="Rate" value={`${summary.percentage}%`} highlight />
        </div>
      )}

      {showCreate && (
        <div className="card mb-6 border-brand-200">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{editingId ? 'Edit Attendance Session' : 'Open Attendance Session'}</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Program *</label>
              <select className="input-field" value={form.program_id} onChange={e => setForm(p => ({ ...p, program_id: e.target.value, class_id: '' }))} required>
                <option value="">Select program</option>
                {programs.length === 0 && <option disabled>No programs</option>}
                {programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Class roster</label>
              <select
                className="input-field"
                value={form.class_id}
                onChange={e => {
                  const selected = classes.find((item) => item.id === e.target.value);
                  setForm(p => ({ ...p, class_id: e.target.value, program_id: selected?.program_id || p.program_id }));
                }}
              >
                <option value="">Program-wide attendance</option>
                {classes
                  .filter((item) => !form.program_id || item.program_id === form.program_id)
                  .map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-400">Choose a class to mark only students allocated to that roster.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Date *</label>
                <input type="date" className="input-field" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Closes in</label>
                <select className="input-field" value={form.closes_at_minutes} onChange={e => setForm(p => ({ ...p, closes_at_minutes: e.target.value }))}>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                  <option value="480">8 hours</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Title (optional)</label>
              <input type="text" className="input-field" placeholder="e.g. Morning Session" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">{editingId ? 'Update Session' : 'Open Session'}</button>
              <button type="button" onClick={() => { setShowCreate(false); resetForm(); }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Sessions</h2>
          {sessions.length === 0 ? (
            <div className="text-center py-8"><p className="text-gray-400">No sessions yet</p></div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {sessions.map(s => (
                <div key={s.id} onClick={() => setSelectedSession(s.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${selectedSession === s.id ? 'border-brand-300 bg-brand-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{s.class_name || s.program_title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.status === 'open' && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(s); }} className="p-1 rounded hover:bg-white dark:hover:bg-gray-700 text-gray-400 hover:text-brand-600" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                      {isOpen(s) ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Open</span> : <span className="text-xs bg-gray-100 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">Closed</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{new Date(s.date).toLocaleDateString()}</span>
                    {s.class_name && <span>{s.program_title}</span>}
                    <span>closes {s.closes_at}</span>
                    <span>{s.marked_count} marked</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          {detail ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Session Detail</h2>
                {detail.status === 'open' && (
                  <button onClick={() => handleClose(detail.id)} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium">Close & Mark Absent</button>
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 space-y-1">
                <p><strong>Program:</strong> {detail.program_title}</p>
                {detail.class_name && <p><strong>Class:</strong> {detail.class_name} ({detail.class_code})</p>}
                <p><strong>Date:</strong> {new Date(detail.date).toLocaleDateString()} <strong>Closes:</strong> {detail.closes_at} <strong>Status:</strong> {detail.status}</p>
              </div>

              <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-2">All Students</h3>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {detail.records.map(r => (
                  <StudentRow key={r.id} student={r} sessionId={detail.id} onOverride={handleOverride} />
                ))}
                {detail.unmarked?.map(u => (
                  <StudentRow key={u.id} student={{ ...u, status: null, notes: '' }} sessionId={detail.id} onOverride={handleOverride} unmarked />
                ))}
                {detail.records.length === 0 && (!detail.unmarked || detail.unmarked.length === 0) && (
                  <p className="text-xs text-gray-400 text-center py-4">No students enrolled</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p>Select a session to see students</p>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </motion.div>
  );
}

function StudentRow({ student, sessionId, onOverride, unmarked }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`flex items-center gap-2 p-2 rounded text-sm ${unmarked ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-800'} border border-gray-100`}>
      <div className="flex-1 min-w-0">
        <span className="text-gray-700 dark:text-gray-200 font-medium">{student.student_name || student.name}</span>
      </div>
      {unmarked ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Not marked</span>
          <button onClick={() => setOpen(!open)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Set</button>
        </div>
      ) : (
        <button onClick={() => setOpen(!open)} className="cursor-pointer">
          <StatusBadge status={student.status} />
        </button>
      )}
      {open && (
        <div className="flex items-center gap-1">
          {['present', 'late', 'absent', 'excused'].map(st => (
            <button
              key={st}
              onClick={() => { onOverride(sessionId, student.student_id || student.id, st); setOpen(false); }}
              className={`text-xs px-2 py-1 rounded font-medium transition-colors ${student.status === st ? 'ring-2 ring-brand-400' : ''} ${
                st === 'present' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                st === 'late' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                st === 'absent' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) return <span className="text-xs bg-gray-200 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full font-medium">—</span>;
  const colors = {
    present: 'bg-green-100 text-green-700',
    late: 'bg-yellow-100 text-yellow-700',
    absent: 'bg-red-100 text-red-700',
    excused: 'bg-blue-100 text-blue-700',
  };
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${colors[status] || 'bg-gray-100 text-gray-600 dark:text-gray-300'}`}>{status}</span>;
}

function StatCard({ label, value, color, highlight }) {
  const colorMap = { green: 'text-green-600', yellow: 'text-yellow-600', red: 'text-red-600', blue: 'text-blue-600' };
  return (
    <div className={`card text-center ${highlight ? 'border-brand-200 bg-brand-50/30' : ''}`}>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-600' : colorMap[color] || 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}
