/**
 * ProgramsManagement — Admin page for managing training programs
 *
 * Features:
 * - Grid/list view of programs with icons
 * - Create/edit program modal with full form
 * - Learning outcomes management
 * - Delete with confirmation
 * - Responsive card grid layout
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Search, Filter, X, ChevronDown, Loader2 } from 'lucide-react';
import { programAPI, adminAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Card, Button, Input, Select, Modal, Textarea } from '../../components/ui';
import ProgramIcon, { programIconOptions, normalizeProgramIcon } from '../../components/ProgramIcon';

export default function ProgramsManagement() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    duration: '3 Months',
    level: 'Beginner',
    audience: '',
    icon: 'computing',
    outcomes: [],
    outcomeInput: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await programAPI.getAll();
      setPrograms(res.data || []);
    } catch (err) {
      toast('Failed to load programs', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchPrograms(); }, [fetchPrograms]);

  const resetForm = () => {
    setFormError('');
    setForm({ title: '', slug: '', description: '', duration: '3 Months', level: 'Beginner', audience: '', icon: 'computing', outcomes: [], outcomeInput: '' });
    setEditingProgram(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.slug.trim() || !form.description.trim()) {
      toast('Title, slug, and description are required', 'warning');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const payload = { ...form, outcomes: form.outcomes, outcomeInput: undefined };
      if (editingProgram) {
        await programAPI.update(editingProgram.id, payload);
        toast('Program updated', 'success');
      } else {
        await programAPI.create(payload);
        toast('Program created', 'success');
      }
      setShowForm(false);
      resetForm();
      fetchPrograms();
    } catch (err) {
      setFormError([err.response?.data?.error || 'Failed to save program', ...Object.entries(err.response?.data?.fieldErrors || {}).map(([key, value]) => `${key}: ${value}`)].join('. '));
      toast(err.response?.data?.error || 'Failed to save program', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (program) => {
    setFormError('');
    let outcomes = [];
    try { outcomes = Array.isArray(program.outcomes) ? program.outcomes : JSON.parse(program.outcomes || '[]'); } catch { outcomes = []; }
    setEditingProgram(program);
    setForm({ title: program.title, slug: program.slug, description: program.description, duration: program.duration || '3 Months', level: program.level || 'Beginner', audience: program.audience || '', icon: normalizeProgramIcon(program.icon), outcomes, outcomeInput: '' });
    setShowForm(true);
  };

  const handleDelete = async (program) => {
    const ok = await confirm('Delete this program? Students may lose access to its materials and enrollments.', { danger: true, title: 'Delete program', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await programAPI.delete(program.id);
      setPrograms(programs.filter((p) => p.id !== program.id));
      toast('Program deleted', 'info');
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to delete program', 'error');
    }
  };

  const addOutcome = () => {
    if (!form.outcomeInput.trim()) return;
    setForm({ ...form, outcomes: [...form.outcomes, form.outcomeInput.trim()], outcomeInput: '' });
  };

  const removeOutcome = (index) => {
    setForm({ ...form, outcomes: form.outcomes.filter((_, i) => i !== index) });
  };

  const filteredPrograms = programs.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (!levelFilter || p.level === levelFilter)
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Program Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Create and manage training programs</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} icon={Plus}>
          Add Program
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="card flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search programs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="w-full sm:w-48 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All Levels</option>
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
        </select>
      </div>

      {/* Programs Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : filteredPrograms.length === 0 ? (
        <Card className="text-center py-12">
          <Loader2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3 animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">No programs found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredPrograms.map((program) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="group"
            >
              <Card className="h-full hover-lift">
                <div className="flex items-start justify-between mb-3">
                  <ProgramIcon value={program.icon} className="h-8 w-8 shrink-0 text-core dark:text-turquoise" />
<div className="flex items-center gap-1 ml-auto">
                      <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleEdit(program)} aria-label="Edit program" title="Edit program" />
                      <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(program)} aria-label="Delete program" title="Delete program" />
                    </div>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">{program.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{program.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">{program.duration}</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 capitalize">{program.level}</span>
                </div>
                {program.outcomes && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium mb-1">Learning Outcomes:</p>
                    <ul className="list-disc list-inside space-y-0.5 max-h-16 overflow-hidden">
                      {(() => {
                        try {
                          const list = Array.isArray(program.outcomes) ? program.outcomes : JSON.parse(program.outcomes || '[]');
                          return list.slice(0, 3).map((outcome, i) => <li key={i} className="truncate">{typeof outcome === 'string' ? outcome : String(outcome)}</li>);
                        } catch { return null; }
                      })()}
                    </ul>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Program Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingProgram ? 'Edit Program' : 'Create New Program'} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{formError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Program Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g., Web Development" />
              <Input label="Slug *" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required placeholder="e.g., web-development" />
            </div>
            <Textarea label="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={3} placeholder="Describe the program..." />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="3 Months" />
              <Select label="Level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} options={[
                { value: 'Beginner', label: 'Beginner' },
                { value: 'Intermediate', label: 'Intermediate' },
                { value: 'Advanced', label: 'Advanced' },
              ]} />
              <Select label="Program icon" value={normalizeProgramIcon(form.icon)} onChange={(e) => setForm({ ...form, icon: e.target.value })} options={programIconOptions} />
            </div>
            <Input label="Audience (comma separated)" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Beginners, Career changers, Students" />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Learning Outcomes</label>
              <div className="flex gap-2 mb-2">
                <Input value={form.outcomeInput} onChange={(e) => setForm({ ...form, outcomeInput: e.target.value })} placeholder="e.g., Build responsive websites" className="flex-1" />
                <Button type="button" variant="secondary" onClick={addOutcome} size="sm">Add</Button>
              </div>
              {form.outcomes.length > 0 && (
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {form.outcomes.map((outcome, i) => (
                    <li key={i} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700 rounded px-2 py-1">
                      <span className="text-gray-700 dark:text-gray-200 truncate flex-1 mr-2">{outcome}</span>
                      <Button type="button" variant="danger" size="sm" icon={Trash2} onClick={() => removeOutcome(i)} className="p-1" aria-label="Remove outcome" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {editingProgram ? 'Update Program' : 'Create Program'}
              </Button>
            </div>
          </form>
        </Modal>
    </div>
  );
}
