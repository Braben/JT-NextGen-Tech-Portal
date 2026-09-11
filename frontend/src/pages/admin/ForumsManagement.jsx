/**
 * ForumsManagement — Admin page for managing forum categories, topics, and reports
 *
 * Features:
 * - Category management
 * - Topic moderation (pin, close, delete)
 * - Report handling
 * - Statistics overview
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Search, Filter, Loader2, Flag, FlagOff, Eye, MessageSquare, Hash, X, ChevronDown } from 'lucide-react';
import { forumAPI, adminAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import DataTable from '../../components/admin/Table';
import { Card, Button, Input, Select, Modal, Textarea } from '../../components/ui';

export default function ForumsManagement() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState([]);
  const [topics, setTopics] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', type: 'general', session: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const catRes = await forumAPI.getCategories();
      setCategories(catRes.data || []);
      // Fetch topics for first category if available
      if (catRes.data?.length > 0) {
        const topicRes = await forumAPI.getCategory(catRes.data[0].id);
        setTopics(topicRes.data?.topics || []);
      }
    } catch (err) {
      toast('Failed to load forums', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm({ name: '', description: '', type: 'general', session: '' });
    setEditingCategory(null);
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast('Name is required', 'warning'); return; }
    setSubmitting(true);
    try {
      if (editingCategory) {
        // Update not implemented in API yet
        toast('Category updates not yet implemented', 'warning');
      } else {
        await forumAPI.createCategory(form);
        toast('Category created', 'success');
      }
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to save category', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    const ok = await confirm('Delete this category and all its topics?', { danger: true, title: 'Delete Category', confirmText: 'Delete' });
    if (!ok) return;
    toast('Category deletion not yet implemented', 'warning');
  };

  const handlePinTopic = async (topicId) => {
    try {
      await forumAPI.pinTopic(topicId);
      toast('Topic pinned', 'success');
      fetchData();
    } catch (err) { toast('Failed to pin topic', 'error'); }
  };

  const handleCloseTopic = async (topicId) => {
    try {
      await forumAPI.closeTopic(topicId);
      toast('Topic closed', 'success');
      fetchData();
    } catch (err) { toast('Failed to close topic', 'error'); }
  };

  const categoryColumns = [
    { key: 'name', label: 'Category', sortable: true },
    { key: 'description', label: 'Description', render: (row) => <span className="text-gray-500 dark:text-gray-400 truncate max-w-xs block">{row.description || '—'}</span> },
    { key: 'type', label: 'Type', align: 'center', render: (row) => <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs capitalize">{row.type || 'general'}</span> },
    { key: 'session', label: 'Session', align: 'center', render: (row) => row.session || '—' },
    { key: 'created_at', label: 'Created', align: 'center', render: (row) => <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(row.created_at).toLocaleDateString()}</span> },
  ];

  const topicColumns = [
    { key: 'title', label: 'Topic', sortable: true, render: (row) => <span className="font-medium">{row.title}</span> },
    { key: 'user_name', label: 'Author', sortable: true },
    { key: 'category_name', label: 'Category' },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          {row.is_pinned && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs"><Hash className="w-3 h-3" /> Pinned</span>}
          {row.is_closed && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs"><X className="w-3 h-3" /> Closed</span>}
          {!row.is_pinned && !row.is_closed && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">Open</span>}
        </div>
      ),
    },
    { key: 'views', label: 'Views', align: 'center', render: (row) => row.views || 0 },
    { key: 'created_at', label: 'Created', align: 'center', render: (row) => <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(row.created_at).toLocaleDateString()}</span> },
  ];

  const categoryActions = [
    { key: 'edit', label: 'Edit', icon: Edit, variant: 'primary', onClick: (row) => { setEditingCategory(row); setForm({ name: row.name, description: row.description || '', type: row.type || 'general', session: row.session || '' }); setShowForm(true); } },
    { key: 'delete', label: 'Delete', icon: Trash2, variant: 'danger', onClick: handleDeleteCategory },
  ];

  const topicActions = [
    { key: 'pin', label: 'Pin', icon: Hash, variant: 'secondary', onClick: (row) => handlePinTopic(row.id), disabled: (row) => row.is_pinned },
    { key: 'close', label: 'Close', icon: X, variant: 'danger', onClick: (row) => handleCloseTopic(row.id), disabled: (row) => row.is_closed },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forum Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage categories, topics, and moderation</p>
        </div>
        {activeTab === 'categories' && <Button onClick={() => { resetForm(); setShowForm(true); }} icon={Plus}>Add Category</Button>}
      </div>

      <div className="card mb-4">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg" role="tablist">
          {['categories', 'topics', 'reports'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              aria-selected={activeTab === tab}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'categories' && (
        <>
          <div className="card flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
              <input type="search" placeholder="Search categories..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <DataTable columns={categoryColumns} data={categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))} keyField="id" loading={loading} emptyMessage="No categories" rowActions={categoryActions} />
        </>
      )}

      {activeTab === 'topics' && (
        <>
          <div className="card flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
              <input type="search" placeholder="Search topics..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <Select value={''} onChange={() => {}} options={[{value:'',label:'All Categories'}]} className="w-full sm:w-56" />
          </div>
          <DataTable columns={topicColumns} data={topics.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))} keyField="id" loading={loading} emptyMessage="No topics" rowActions={topicActions} />
        </>
      )}

      {activeTab === 'reports' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Reported Content</h2>
            <span className="text-sm text-gray-500">{reports.length} reports</span>
          </div>
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <Flag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No reports</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{report.reason || 'Inappropriate content'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Reported by {report.reporter_name} • {new Date(report.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" icon={FlagOff}>Dismiss</Button>
                      <Button variant="danger" size="sm" icon={Trash2}>Remove Content</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingCategory ? 'Edit Category' : 'Create Category'} size="lg">
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <Input label="Category Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g., Web Development Discussions" />
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Category description..." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{value:'general',label:'General'},{value:'announcements',label:'Announcements'},{value:'help',label:'Help & Support'},{value:'off-topic',label:'Off Topic'}]} />
              <Input label="Session (optional)" value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} placeholder="e.g., Morning, Evening" />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" loading={submitting}>{editingCategory ? 'Update Category' : 'Create Category'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}