/**
 * AttendanceManagement — Admin page for managing attendance sessions
 *
 * Features:
 * - List of attendance sessions with status
 * - Create new session
 * - View session details with student records
 * - Filter by program and status
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Search, Filter, Loader2, Eye, Calendar, UserCheck } from 'lucide-react';
import { attendanceAPI, classAPI, programAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import DataTable from '../../components/admin/Table';
import { Card, Button, Input, Select, Modal } from '../../components/ui';

export default function AttendanceManagement() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [sessions, setSessions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [viewingSession, setViewingSession] = useState(null);
  const [form, setForm] = useState({
    program_id: '',
    class_id: '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    closes_at_minutes: 30,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceAPI.getSessions();
      setSessions(res.data || []);
    } catch (err) {
      toast('Failed to load sessions', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    Promise.all([programAPI.getAll(), classAPI.getAll()])
      .then(([programRes, classRes]) => {
        setPrograms(programRes.data || []);
        setClasses(classRes.data || []);
      })
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setForm({ program_id: '', class_id: '', title: '', date: new Date().toISOString().split('T')[0], closes_at_minutes: 30 });
    setEditingSession(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.program_id || !form.date) {
      toast('Program and date are required', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      if (editingSession) {
        await attendanceAPI.updateSession(editingSession.id, form);
        toast('Session updated', 'success');
      } else {
        await attendanceAPI.createSession(form);
        toast('Session created', 'success');
      }
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to save session', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (session) => {
    setEditingSession(session);
    setForm({
      program_id: session.program_id,
      class_id: session.class_id || '',
      title: session.title || '',
      date: session.date,
      closes_at_minutes: 30,
    });
    setShowForm(true);
  };

  const handleDelete = async (session) => {
    const ok = await confirm('Delete this attendance session? All attendance records for this session will be removed.', { danger: true, title: 'Delete Session', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await attendanceAPI.deleteSession(session.id);
      toast('Session deleted', 'success');
      fetchData();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to delete session', 'error');
    }
  };

  const handleCloseSession = async (session) => {
    const ok = await confirm('Close this session? This will auto-mark absent students.', { danger: true, title: 'Close Session', confirmText: 'Close' });
    if (!ok) return;
    try {
      await attendanceAPI.closeSession(session.id);
      toast('Session closed', 'success');
      fetchData();
    } catch (err) {
      toast('Failed to close session', 'error');
    }
  };

  const columns = [
    { key: 'title', label: 'Session', sortable: true, render: (row) => <span className="font-medium">{row.title || 'Untitled Session'}</span> },
    { key: 'program_title', label: 'Program', sortable: true },
    {
      key: 'class_name',
      label: 'Class',
      sortable: true,
      render: (row) => row.class_name ? `${row.class_name} (${row.class_code})` : <span className="text-gray-400">Program-wide</span>,
    },
    { key: 'instructor_name', label: 'Instructor', sortable: true },
    {
      key: 'date',
      label: 'Date',
      align: 'center',
      sortable: true,
      render: (row) => <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(row.date).toLocaleDateString()}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      sortable: true,
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          row.status === 'open' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
        }`}>
          {row.status || 'open'}
        </span>
      ),
    },
    {
      key: 'marked_count',
      label: 'Marked',
      align: 'center',
      render: (row) => <span className="inline-flex items-center gap-1"><UserCheck className="w-4 h-4" /> {row.marked_count || 0}</span>,
    },
  ];

  const rowActions = [
    { key: 'view', label: 'View', icon: Eye, variant: 'primary', onClick: (row) => setViewingSession(row) },
    { key: 'close', label: 'Close', icon: Calendar, variant: 'secondary', onClick: handleCloseSession, disabled: (row) => row.status !== 'open' },
    { key: 'delete', label: 'Delete', icon: Trash2, variant: 'danger', onClick: handleDelete },
  ];

  const filteredSessions = sessions.filter((s) =>
    (s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     s.program_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     s.class_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     s.class_code?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!programFilter || s.program_id === programFilter) &&
    (!statusFilter || s.status === statusFilter)
  );

  const programOptions = [{ value: '', label: 'All Programs' }, ...programs.map(p => ({ value: p.id, label: p.title }))];
  const classOptions = [
    { value: '', label: 'Program-wide attendance' },
    ...classes
      .filter((item) => !form.program_id || item.program_id === form.program_id)
      .map((item) => ({ value: item.id, label: `${item.name} (${item.code})` })),
  ];
  const statusOptions = [{ value: '', label: 'All Statuses' }, { value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage attendance sessions</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} icon={Plus}>
          Create Session
        </Button>
      </div>

      <div className="card flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} options={programOptions} className="w-full sm:w-56" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={statusOptions} className="w-full sm:w-40" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredSessions}
        keyField="id"
        loading={loading}
        emptyMessage="No sessions found"
        rowActions={rowActions}
        pagination={{ page: 1, pageSize: 15, total: filteredSessions.length }}
      />

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingSession ? 'Edit Session' : 'Create Attendance Session'} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select label="Program *" value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value, class_id: '' })} options={programOptions} required />
            <Select
              label="Class roster"
              value={form.class_id}
              onChange={(e) => {
                const selected = classes.find((item) => item.id === e.target.value);
                setForm({ ...form, class_id: e.target.value, program_id: selected?.program_id || form.program_id });
              }}
              options={classOptions}
              helperText="Use a class roster for cohort-specific attendance; leave blank for legacy program-wide attendance."
            />
            <Input label="Session Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Week 1 - Introduction" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Date *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              <Input label="Closes After (minutes)" type="number" value={form.closes_at_minutes} onChange={(e) => setForm({ ...form, closes_at_minutes: parseInt(e.target.value) || 30 })} min="1" max="1440" />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {editingSession ? 'Update Session' : 'Create Session'}
              </Button>
            </div>
          </form>
        </Modal>

      {viewingSession && (
        <Modal isOpen={!!viewingSession} onClose={() => setViewingSession(null)} title="Session Details" size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Session</p><p className="font-medium">{viewingSession.title || 'Untitled'}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Program</p><p>{viewingSession.program_title}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Class</p><p>{viewingSession.class_name ? `${viewingSession.class_name} (${viewingSession.class_code})` : 'Program-wide'}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Instructor</p><p>{viewingSession.instructor_name}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</p><p>{new Date(viewingSession.date).toLocaleDateString()}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</p><p className={`font-medium ${viewingSession.status === 'open' ? 'text-emerald-600' : 'text-gray-600'}`}>{viewingSession.status}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Marked</p><p>{viewingSession.marked_count || 0} students</p></div>
            </div>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button variant="secondary" onClick={() => setViewingSession(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
