/**
 * MaterialsManagement — Admin page for managing course materials
 *
 * Features:
 * - Upload multiple files with drag-and-drop support
 * - Link materials (external URLs)
 * - Audience targeting (active students, alumni, specific cohorts)
 * - File type categorization
 * - Delete with confirmation
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Video, Image, Link, Trash2, Search, Filter, Eye, Loader2, Download, MoreHorizontal } from 'lucide-react';
import { fileAPI, materialAPI, openBlobDownload } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import DataTable from '../../components/admin/Table';
import { Card, Button, Input, Select, Modal, Textarea } from '../../components/ui';

const fileTypeIcons = {
  document: FileText,
  video: Video,
  slides: Image,
  link: Link,
  other: FileText,
};

const fileTypeLabels = {
  document: 'Document',
  video: 'Video',
  slides: 'Slides',
  link: 'Link',
  other: 'Other',
};

export default function MaterialsManagement() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [materials, setMaterials] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [form, setForm] = useState({
    program_id: '',
    title: '',
    description: '',
    file_type: 'document',
    link_url: '',
    audience_groups: ['active'],
    audience_year: '',
    audience_month: '',
    files: [],
  });
  const [filePreviews, setFilePreviews] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await materialAPI.getAll();
      setMaterials(res.data || []);
    } catch (err) {
      toast('Failed to load materials', 'error');
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
    setForm({ program_id: '', title: '', description: '', file_type: 'document', link_url: '', audience_groups: ['active'], audience_year: '', audience_month: '', files: [] });
    setFilePreviews([]);
    setEditingMaterial(null);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setForm({ ...form, files });
    const previews = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    }));
    setFilePreviews(previews);
  };

  const removeFile = (index) => {
    const newFiles = [...form.files];
    newFiles.splice(index, 1);
    setForm({ ...form, files: newFiles });
    setFilePreviews(filePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.program_id || !form.title.trim()) {
      toast('Program and title are required', 'warning');
      return;
    }
    if (form.files.length === 0 && !form.link_url.trim()) {
      toast('Please upload a file or provide a link', 'warning');
      return;
    }
    setUploading(true);
    try {
      if (form.files.length > 0) {
        // Upload files using multipart/form-data
        const formData = new FormData();
        formData.append('program_id', form.program_id);
        form.files.forEach((file, i) => formData.append('files', file));
        formData.append('data', JSON.stringify([{
          title: form.title,
          description: form.description,
          file_type: form.file_type,
          link_url: form.link_url,
          audience_groups: form.audience_groups,
          audience_year: form.audience_year,
          audience_month: form.audience_month,
          file_key: 0,
        }]));
        await materialAPI.createMulti(formData);
      } else {
        // Create link-only material
        await materialAPI.create({
          program_id: form.program_id,
          title: form.title,
          description: form.description,
          file_type: 'link',
          link_url: form.link_url,
          audience_groups: form.audience_groups,
          audience_year: form.audience_year,
          audience_month: form.audience_month,
        });
      }
      toast(editingMaterial ? 'Material updated' : 'Material added', 'success');
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to save material', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (material) => {
    const ok = await confirm('Delete this material?', { danger: true, title: 'Delete Material', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await materialAPI.delete(material.id);
      setMaterials(materials.filter((m) => m.id !== material.id));
      toast('Material deleted', 'info');
    } catch (err) {
      toast('Failed to delete material', 'error');
    }
  };

  const columns = [
    { key: 'title', label: 'Title', sortable: true },
    { key: 'program_name', label: 'Program', sortable: true },
    {
      key: 'file_type',
      label: 'Type',
      align: 'center',
      render: (row) => {
        const Icon = fileTypeIcons[row.file_type] || FileText;
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs">
            <Icon className="w-3 h-3" aria-hidden="true" />
            {fileTypeLabels[row.file_type] || row.file_type}
          </span>
        );
      },
    },
    {
      key: 'audience_groups',
      label: 'Audience',
      align: 'center',
      render: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {(row.audience_groups || ['active']).join(', ')}
        </span>
      ),
    },
    { key: 'instructor_name', label: 'Uploaded By', sortable: true, render: (row) => row.instructor_name || '—' },
    { key: 'created_at', label: 'Uploaded', align: 'center', sortable: true, render: (row) => <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(row.created_at).toLocaleDateString()}</span> },
  ];

  const handleDownload = async (row) => {
    if (row.link_url) return window.open(row.link_url, '_blank', 'noopener,noreferrer');
    try {
      const res = await fileAPI.material(row.id);
      openBlobDownload(res, row.title || 'material');
    } catch (err) {
      toast(err.response?.data?.error || 'Unable to download material', 'error');
    }
  };

  const rowActions = [
    { key: 'download', label: 'Download', icon: Download, variant: 'primary', onClick: handleDownload, disabled: (row) => !row.file_path && !row.link_url },
    { key: 'delete', label: 'Delete', icon: Trash2, variant: 'danger', onClick: handleDelete },
  ];

  const filteredMaterials = materials.filter((m) =>
    (m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     m.program_name?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!programFilter || m.program_id === programFilter) &&
    (!typeFilter || m.file_type === typeFilter)
  );

  const programOptions = [{ value: '', label: 'All Programs' }, ...programs.map(p => ({ value: p.id, label: p.title }))];
  const typeOptions = [{ value: '', label: 'All Types' }, ...Object.entries(fileTypeLabels).map(([v, l]) => ({ value: v, label: l }))];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Materials Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Upload and organize course materials</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} icon={Upload}>
          Add Material
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="card flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} options={programOptions} className="w-full sm:w-48" />
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={typeOptions} className="w-full sm:w-40" />
        </div>
      </div>

      {/* Materials Table */}
      <DataTable
        columns={columns}
        data={filteredMaterials}
        keyField="id"
        loading={loading}
        emptyMessage="No materials found"
        rowActions={rowActions}
        pagination={{ page: 1, pageSize: 15, total: filteredMaterials.length }}
      />

      {/* Add/Edit Material Modal */}
      {showForm && (
        <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingMaterial ? 'Edit Material' : 'Add New Material'} size="xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select label="Program *" value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })} options={programOptions} required />
            <Input label="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g., Web Development - Module 1" />
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Brief description..." />
            <Select label="File Type" value={form.file_type} onChange={(e) => setForm({ ...form, file_type: e.target.value })} options={typeOptions.filter(o => o.value)} />
            <Input label="External Link (optional)" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} type="url" placeholder="https://example.com/resource" />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Upload Files</label>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.mp4,.mov,.jpg,.jpeg,.png,.zip"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {filePreviews.length > 0 && (
                <div className="mt-2 space-y-2">
                  {filePreviews.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <Button type="button" variant="danger" size="sm" icon={Trash2} onClick={() => removeFile(i)} className="p-1" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <fieldset>
                <legend className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Audience Groups</legend>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.audience_groups.includes('active')} onChange={(e) => setForm({ ...form, audience_groups: e.target.checked ? [...form.audience_groups, 'active'] : form.audience_groups.filter(g => g !== 'active') })} className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active Students</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.audience_groups.includes('alumni')} onChange={(e) => setForm({ ...form, audience_groups: e.target.checked ? [...form.audience_groups, 'alumni'] : form.audience_groups.filter(g => g !== 'alumni') })} className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Alumni</span>
                  </label>
                </div>
              </fieldset>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Alumni Cohort (if alumni selected)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input label="Completion Year" value={form.audience_year} onChange={(e) => setForm({ ...form, audience_year: e.target.value })} placeholder="2024" type="number" min="2020" max="2030" />
                  <Select label="Completion Month" value={form.audience_month} onChange={(e) => setForm({ ...form, audience_month: e.target.value })} options={[{value:'',label:'All Months'},...Array.from({length:12},(_,i)=>({value:String(i+1).padStart(2,'0'),label:new Date(2000,i).toLocaleString('default',{month:'long'})}))]}/>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={uploading}>
                {editingMaterial ? 'Update Material' : 'Upload Material'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
