/**
 * QuizzesManagement — Admin page for managing quizzes
 *
 * Features:
 * - List of all quizzes with program association
 * - Create/edit quiz with questions
 * - View submissions and results
 * - Due date and time limit management
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Search, Filter, Loader2, Eye, FileText, Clock, Calendar } from 'lucide-react';
import { quizAPI, adminAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import DataTable from '../../components/admin/Table';
import { Card, Button, Input, Select, Modal, Textarea } from '../../components/ui';

export default function QuizzesManagement() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [quizzes, setQuizzes] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [viewingQuiz, setViewingQuiz] = useState(null);
  const [form, setForm] = useState({
    program_id: '',
    title: '',
    description: '',
    due_date: '',
    time_limit: 0,
    questions: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await quizAPI.getAll({ all: 'true' });
      setQuizzes(res.data || []);
    } catch (err) {
      toast('Failed to load quizzes', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    import('../../api').then(({ programAPI }) => {
      programAPI.getAll().then(res => setPrograms(res.data || [])).catch(() => {});
    });
  }, []);

  const resetForm = () => {
    setForm({ program_id: '', title: '', description: '', due_date: '', time_limit: 0, questions: [] });
    setEditingQuiz(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.program_id || !form.title.trim()) {
      toast('Program and title are required', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      if (editingQuiz) {
        await quizAPI.update(editingQuiz.id, form);
        toast('Quiz updated', 'success');
      } else {
        await quizAPI.create(form);
        toast('Quiz created', 'success');
      }
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to save quiz', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (quiz) => {
    setEditingQuiz(quiz);
    setForm({
      program_id: quiz.program_id,
      title: quiz.title,
      description: quiz.description || '',
      due_date: quiz.due_date ? quiz.due_date.split('T')[0] : '',
      time_limit: quiz.time_limit || 0,
      questions: quiz.questions || [],
    });
    setShowForm(true);
  };

  const handleDelete = async (quiz) => {
    const ok = await confirm('Delete this quiz and all its submissions?', { danger: true, title: 'Delete Quiz', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await quizAPI.delete(quiz.id);
      setQuizzes(quizzes.filter((q) => q.id !== quiz.id));
      toast('Quiz deleted', 'info');
    } catch (err) {
      toast('Failed to delete quiz', 'error');
    }
  };

  const columns = [
    { key: 'title', label: 'Quiz', sortable: true },
    { key: 'program_title', label: 'Program', sortable: true },
    { key: 'description', label: 'Description', render: (row) => <span className="text-gray-500 dark:text-gray-400 truncate max-w-xs block">{(row.description || '').substring(0, 100)}</span> },
    {
      key: 'questions_count',
      label: 'Questions',
      align: 'center',
      render: (row) => <span className="inline-flex items-center gap-1 text-sm"><FileText className="w-4 h-4" /> {row.questions?.length || 0}</span>,
    },
    {
      key: 'due_date',
      label: 'Due Date',
      align: 'center',
      sortable: true,
      render: (row) => row.due_date ? (
        <span className="inline-flex items-center gap-1 text-sm"><Calendar className="w-4 h-4" /> {new Date(row.due_date).toLocaleDateString()}</span>
      ) : '—',
    },
    {
      key: 'time_limit',
      label: 'Time Limit',
      align: 'center',
      render: (row) => row.time_limit > 0 ? (
        <span className="inline-flex items-center gap-1 text-sm"><Clock className="w-4 h-4" /> {row.time_limit} min</span>
      ) : 'No limit',
    },
  ];

  const rowActions = [
    { key: 'view', label: 'View', icon: Eye, variant: 'primary', onClick: (row) => setViewingQuiz(row) },
    { key: 'edit', label: 'Edit', icon: Edit, variant: 'primary', onClick: handleEdit },
    { key: 'delete', label: 'Delete', icon: Trash2, variant: 'danger', onClick: handleDelete },
  ];

  const filteredQuizzes = quizzes.filter((q) =>
    (q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     q.program_title?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!programFilter || q.program_id === programFilter)
  );

  const programOptions = [{ value: '', label: 'All Programs' }, ...programs.map(p => ({ value: p.id, label: p.title }))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quiz Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Create and manage quizzes</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} icon={Plus}>
          Create Quiz
        </Button>
      </div>

      <div className="card flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search quizzes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} options={programOptions} className="w-full sm:w-56" />
      </div>

      <DataTable
        columns={columns}
        data={filteredQuizzes}
        keyField="id"
        loading={loading}
        emptyMessage="No quizzes found"
        rowActions={rowActions}
        pagination={{ page: 1, pageSize: 15, total: filteredQuizzes.length }}
      />

      {/* Add/Edit Quiz Modal */}
      {showForm && (
        <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingQuiz ? 'Edit Quiz' : 'Create New Quiz'} size="xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select label="Program *" value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })} options={programOptions} required />
            <Input label="Quiz Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g., Midterm Exam - Web Development" />
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Quiz instructions..." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Due Date" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              <Input label="Time Limit (minutes, 0 = no limit)" type="number" value={form.time_limit} onChange={(e) => setForm({ ...form, time_limit: parseInt(e.target.value) || 0 })} min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Questions</label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Questions are managed in the quiz builder. This is a simplified view.</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {form.questions.map((q, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium">Q{i + 1}: {q.question?.substring(0, 80)}...</span>
                    <span className="text-xs text-gray-500">{q.type || 'multiple_choice'}</span>
                  </div>
                ))}
                {form.questions.length === 0 && (
                  <p className="text-center text-gray-400 py-4">No questions added yet</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {editingQuiz ? 'Update Quiz' : 'Create Quiz'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Quiz Modal */}
      {viewingQuiz && (
        <Modal isOpen={!!viewingQuiz} onClose={() => setViewingQuiz(null)} title="Quiz Details" size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</p><p className="font-medium">{viewingQuiz.title}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Program</p><p>{viewingQuiz.program_title}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Questions</p><p>{viewingQuiz.questions?.length || 0}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time Limit</p><p>{viewingQuiz.time_limit > 0 ? `${viewingQuiz.time_limit} minutes` : 'No limit'}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Due Date</p><p>{viewingQuiz.due_date ? new Date(viewingQuiz.due_date).toLocaleDateString() : 'No deadline'}</p></div>
            </div>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button variant="secondary" onClick={() => setViewingQuiz(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}