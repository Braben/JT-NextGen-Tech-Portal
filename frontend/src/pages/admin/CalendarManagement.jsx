/**
 * CalendarManagement — Admin page for managing events and calendar
 *
 * Features:
 * - Calendar view with events
 * - List view with filtering
 * - Create/edit event modal
 * - Public/private event toggle
 * - Program association
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Plus, Edit, Trash2, Search, Filter, Loader2, Eye, Globe, Lock } from 'lucide-react';
import { eventAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import DataTable from '../../components/admin/Table';
import { Card, Button, Input, Select, Modal, Textarea } from '../../components/ui';

const eventTypes = [
  { value: 'class', label: 'Class' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'exam', label: 'Exam' },
  { value: 'other', label: 'Other' },
];

export default function CalendarManagement() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [events, setEvents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({
    program_id: '',
    title: '',
    description: '',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    type: 'class',
    is_public: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await eventAPI.getAll();
      setEvents(res.data || []);
    } catch (err) {
      toast('Failed to load events', 'error');
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
    setForm({ program_id: '', title: '', description: '', event_date: new Date().toISOString().split('T')[0], start_time: '', end_time: '', type: 'class', is_public: false });
    setEditingEvent(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.event_date) {
      toast('Title and date are required', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      if (editingEvent) {
        await eventAPI.update(editingEvent.id, form);
        toast('Event updated', 'success');
      } else {
        await eventAPI.create(form);
        toast('Event created', 'success');
      }
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to save event', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setForm({
      program_id: event.program_id || '',
      title: event.title,
      description: event.description || '',
      event_date: event.event_date,
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      type: event.type || 'class',
      is_public: !!event.is_public,
    });
    setShowForm(true);
  };

  const handleDelete = async (event) => {
    const ok = await confirm('Delete this event?', { danger: true, title: 'Delete Event', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await eventAPI.delete(event.id);
      setEvents(events.filter((e) => e.id !== event.id));
      toast('Event deleted', 'info');
    } catch (err) {
      toast('Failed to delete event', 'error');
    }
  };

  const columns = [
    { key: 'title', label: 'Event', sortable: true },
    { key: 'program_name', label: 'Program', sortable: true },
    {
      key: 'type',
      label: 'Type',
      align: 'center',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs capitalize">
          {row.type}
        </span>
      ),
    },
    {
      key: 'event_date',
      label: 'Date',
      align: 'center',
      sortable: true,
      render: (row) => <span className="text-sm font-medium">{new Date(row.event_date).toLocaleDateString()}</span>,
    },
    {
      key: 'time',
      label: 'Time',
      align: 'center',
      render: (row) => row.start_time && row.end_time ? `${row.start_time} - ${row.end_time}` : 'All day',
    },
    {
      key: 'is_public',
      label: 'Visibility',
      align: 'center',
      render: (row) => row.is_public ? (
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm"><Globe className="w-4 h-4" /> Public</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm"><Lock className="w-4 h-4" /> Private</span>
      ),
    },
  ];

  const rowActions = [
    { key: 'edit', label: 'Edit', icon: Edit, variant: 'primary', onClick: handleEdit },
    { key: 'delete', label: 'Delete', icon: Trash2, variant: 'danger', onClick: handleDelete },
  ];

  const filteredEvents = events.filter((e) =>
    (e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     e.program_name?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!programFilter || (programFilter === 'none' ? !e.program_id : e.program_id === programFilter)) &&
    (!typeFilter || e.type === typeFilter)
  );

  const programOptions = [{ value: '', label: 'All Programs' }, { value: 'none', label: 'No Program (Global)' }, ...programs.map(p => ({ value: p.id, label: p.title }))];
  const typeOptions = [{ value: '', label: 'All Types' }, ...eventTypes];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar & Events</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Schedule and manage events</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} icon={Plus}>
          Create Event
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="card flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} options={programOptions} className="w-full sm:w-56" />
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={typeOptions} className="w-full sm:w-40" />
        </div>
      </div>

      {/* Events Table */}
      <DataTable
        columns={columns}
        data={filteredEvents}
        keyField="id"
        loading={loading}
        emptyMessage="No events found"
        rowActions={rowActions}
        pagination={{ page: 1, pageSize: 15, total: filteredEvents.length }}
      />

      {/* Add/Edit Event Modal */}
      {showForm && (
        <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingEvent ? 'Edit Event' : 'Create New Event'} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select label="Program" value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })} options={[{ value: '', label: 'Global event (no program)' }, ...programs.map(p => ({ value: p.id, label: p.title }))]} />
            <Input label="Event Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g., Midterm Exam" />
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Event details..." />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input label="Date *" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
              <Input label="Start Time" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              <Input label="End Time" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={eventTypes} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Public event (visible on landing page)</span>
            </label>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {editingEvent ? 'Update Event' : 'Create Event'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
