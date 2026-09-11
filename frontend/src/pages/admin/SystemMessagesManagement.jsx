/**
 * SystemMessagesManagement - admin broadcast center.
 *
 * Broadcasts are delivered as durable in-app announcement notifications. The
 * history table aggregates each fan-out by broadcast id so admins see one row
 * per announcement while users still keep individual read/unread state.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle, Info, Megaphone, Search, Send, Users } from 'lucide-react';
import { adminAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/admin/Table';
import { Button, Input, Modal, Select, Textarea } from '../../components/ui';

const initialForm = {
  audience: 'all',
  title: '',
  message: '',
  type: 'info',
};

const audienceOptions = [
  { value: 'all', label: 'Everyone' },
  { value: 'students', label: 'Students only' },
  { value: 'instructors', label: 'Instructors only' },
  { value: 'admins', label: 'Admins only' },
];

const toneOptions = [
  { value: 'info', label: 'Information' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Urgent' },
];

const toneStyles = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-800',
};

export default function SystemMessagesManagement() {
  const { toast } = useToast();
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getBroadcasts();
      setBroadcasts(res.data || []);
    } catch {
      toast('Failed to load announcement history', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchBroadcasts(); }, [fetchBroadcasts]);

  const updateForm = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validate = () => {
    const errors = {};
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.message.trim()) errors.message = 'Message is required';
    if (form.title.trim().length > 120) errors.title = 'Title must be 120 characters or fewer';
    if (form.message.trim().length > 2000) errors.message = 'Message must be 2,000 characters or fewer';
    return errors;
  };

  const resetForm = () => {
    setForm(initialForm);
    setFieldErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      toast(Object.values(errors)[0], 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminAPI.sendBroadcast({
        audience: form.audience,
        title: form.title,
        message: form.message,
        type: form.type,
      });
      toast(`Announcement sent to ${res.data.recipient_count} recipient(s)`, 'success');
      setShowForm(false);
      resetForm();
      fetchBroadcasts();
    } catch (err) {
      const response = err.response?.data;
      setFieldErrors(response?.fieldErrors || {});
      toast(response?.error || 'Failed to send announcement', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBroadcasts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return broadcasts.filter((item) => (
      !q || item.title?.toLowerCase().includes(q) || item.message?.toLowerCase().includes(q)
    ));
  }, [broadcasts, searchQuery]);

  const columns = [
    { key: 'title', label: 'Announcement', sortable: true, render: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-900 dark:text-white">{row.title}</p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{row.message}</p>
      </div>
    ) },
    { key: 'recipient_count', label: 'Delivered', align: 'center', sortable: true, render: (row) => (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle className="h-3.5 w-3.5" /> {row.recipient_count}
      </span>
    ) },
    { key: 'unread_count', label: 'Unread', align: 'center', sortable: true, render: (row) => (
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{row.unread_count || 0}</span>
    ) },
    { key: 'created_at', label: 'Sent', align: 'center', sortable: true, render: (row) => (
      <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(row.created_at).toLocaleString()}</span>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Announcements</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Send broadcast updates and review delivery history</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} icon={Megaphone}>
          New Announcement
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon={Bell} label="Total Sent" value={broadcasts.length} />
        <SummaryCard icon={Users} label="Recipients Reached" value={broadcasts.reduce((sum, item) => sum + Number(item.recipient_count || 0), 0)} />
        <SummaryCard icon={Info} label="Unread Copies" value={broadcasts.reduce((sum, item) => sum + Number(item.unread_count || 0), 0)} />
      </div>

      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredBroadcasts}
        keyField="id"
        loading={loading}
        emptyMessage="No announcements sent yet"
        pagination={{ page: 1, pageSize: 15, total: filteredBroadcasts.length }}
      />

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title="New Announcement" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Audience" value={form.audience} onChange={updateForm('audience')} options={audienceOptions} error={fieldErrors.audience} />
            <Select label="Tone" value={form.type} onChange={updateForm('type')} options={toneOptions} error={fieldErrors.type} />
          </div>
          <Input
            label="Title"
            value={form.title}
            onChange={updateForm('title')}
            error={fieldErrors.title}
            helperText={`${form.title.length}/120 characters`}
            required
            maxLength={120}
            placeholder="Example: Orientation reminder"
          />
          <Textarea
            label="Message"
            value={form.message}
            onChange={updateForm('message')}
            error={fieldErrors.message}
            helperText={`${form.message.length}/2000 characters`}
            rows={5}
            required
            maxLength={2000}
            placeholder="Write the announcement students and staff should see..."
          />

          <div className={`rounded-lg border px-4 py-3 ${toneStyles[form.type] || toneStyles.info}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{form.title || 'Announcement title preview'}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{form.message || 'Your message preview will appear here before delivery.'}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button type="submit" loading={submitting} icon={Send}>Send Announcement</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
