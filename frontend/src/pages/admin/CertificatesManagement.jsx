/**
 * CertificatesManagement — Admin page for managing certificates
 *
 * Features:
 * - Table view of all issued certificates
 * - Generate certificates for completed enrollments
 * - Status management (valid, revoked)
 * - Serial number display
 * - Filter by program and status
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Award, Loader2, Eye } from 'lucide-react';
import { adminAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/admin/Table';
import { Card, Button, Select, Modal } from '../../components/ui';

export default function CertificatesManagement() {
  const { toast } = useToast();
  const [certificates, setCertificates] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [generating, setGenerating] = useState(false);
  const [viewingCertificate, setViewingCertificate] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [certRes, enrollRes] = await Promise.all([
        adminAPI.getCertificates(),
        adminAPI.getEnrollments(),
      ]);
      setCertificates(certRes.data || []);
      setEnrollments(enrollRes.data || []);
      // Programs fetched separately
    } catch (err) {
      toast('Failed to load certificates', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch programs
  useEffect(() => {
    import('../../api').then(({ programAPI }) => {
      programAPI.getAll().then(res => setPrograms(res.data || [])).catch(() => {});
    });
  }, []);

  const generateCertificates = async () => {
    const completed = enrollments.filter((e) => e.status === 'completed' && !certificates.find((c) => c.student_id === e.student_id && c.program_id === e.program_id));
    if (completed.length === 0) return toast('No completed enrollments without certificates.', 'warning');
    setGenerating(true);
    try {
      for (const e of completed) {
        await adminAPI.createCertificate({ student_id: e.student_id, program_id: e.program_id });
      }
      const res = await adminAPI.getCertificates();
      setCertificates(res.data || []);
      toast(`${completed.length} certificate(s) generated!`, 'success');
    } catch (err) {
      toast('Failed to generate certificates', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await adminAPI.updateCertificate(id, { status });
      setCertificates(certificates.map(c => c.id === id ? { ...c, status } : c));
      toast('Certificate status updated', 'success');
    } catch (err) {
      toast('Failed to update status', 'error');
    }
  };

  const columns = [
    { key: 'serial_number', label: 'Serial Number', sortable: true, render: (row) => <code className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{row.serial_number}</code> },
    { key: 'student_name', label: 'Student', sortable: true },
    { key: 'student_email', label: 'Email', sortable: true },
    { key: 'program_title', label: 'Program', sortable: true },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (row) => (
        <select
          value={row.status}
          onChange={(e) => updateStatus(row.id, e.target.value)}
          className="text-xs px-2 py-1 rounded-full border-0 focus:ring-1 focus:ring-brand-500 bg-white dark:bg-gray-800 cursor-pointer"
        >
          <option value="valid">Valid</option>
          <option value="revoked">Revoked</option>
        </select>
      ),
    },
    { key: 'issue_date', label: 'Issued', align: 'center', render: (row) => <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(row.issue_date).toLocaleDateString()}</span> },
  ];

  const rowActions = [
    { key: 'view', label: 'View', icon: Eye, variant: 'primary', onClick: (row) => setViewingCertificate(row) },
  ];

  const filteredCertificates = certificates.filter((c) =>
    (c.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     c.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     c.program_title?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!statusFilter || c.status === statusFilter) &&
    (!programFilter || c.program_id === programFilter)
  );

  const statusOptions = [{ value: '', label: 'All Statuses' }, { value: 'valid', label: 'Valid' }, { value: 'revoked', label: 'Revoked' }];
  const programOptions = [{ value: '', label: 'All Programs' }, ...programs.map(p => ({ value: p.id, label: p.title }))];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Certificate Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Issue and manage certificates</p>
        </div>
        <Button onClick={generateCertificates} icon={Award} loading={generating}>
          Generate for Completed
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="card flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by serial, student, or program..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={statusOptions} className="w-full sm:w-40" />
          <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} options={programOptions} className="w-full sm:w-48" />
        </div>
      </div>

      {/* Certificates Table */}
      <DataTable
        columns={columns}
        data={filteredCertificates}
        keyField="id"
        loading={loading}
        emptyMessage="No certificates found"
        rowActions={rowActions}
        pagination={{ page: 1, pageSize: 15, total: filteredCertificates.length }}
      />

      {/* View Certificate Modal */}
      {viewingCertificate && (
        <Modal isOpen={!!viewingCertificate} onClose={() => setViewingCertificate(null)} title="Certificate Details" size="lg">
          <div className="space-y-4">
            <div className="text-center p-6 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-200 dark:border-brand-800">
              <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">{viewingCertificate.serial_number}</div>
              <div className="text-gray-500 dark:text-gray-400 mt-1">Certificate of Completion</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</p><p className="font-medium">{viewingCertificate.student_name}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</p><p>{viewingCertificate.student_email}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Program</p><p className="font-medium">{viewingCertificate.program_title}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</p><p className={`font-medium ${viewingCertificate.status === 'valid' ? 'text-emerald-600' : 'text-red-600'}`}>{viewingCertificate.status}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Issued</p><p>{new Date(viewingCertificate.issue_date).toLocaleDateString()}</p></div>
            </div>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button variant="secondary" onClick={() => setViewingCertificate(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}