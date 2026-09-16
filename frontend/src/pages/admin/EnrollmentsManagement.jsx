/**
 * EnrollmentsManagement — Admin page for managing student enrollments
 *
 * Features:
 * - Filterable, sortable, paginated table
 * - Status management (pending, active, completed, dropped)
 * - Program and session display
 * - Bulk actions support
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Download, Eye, Save, Search, Send } from 'lucide-react';
import { adminAPI, enrollmentAPI, programAPI, classAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/admin/Table';
import { Button, Select, Modal } from '../../components/ui';

export default function EnrollmentsManagement() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [enrollments, setEnrollments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assessmentFilter, setAssessmentFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [viewingEnrollment, setViewingEnrollment] = useState(null);
  const [gradeForm, setGradeForm] = useState({ score: '', max_score: 100, feedback: '', status: 'reviewed' });
  const [grading, setGrading] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState('');
  const [placement, setPlacement] = useState({ program_id: '', class_id: '', session: 'Morning' });
  const [placementSaving, setPlacementSaving] = useState(false);
  const [placementError, setPlacementError] = useState('');

  const loadClasses = async () => {
    setClassesLoading(true);
    setClassesError('');
    try {
      const res = await classAPI.getAll();
      setClasses(res.data || []);
    } catch {
      setClassesError('Could not load classes. Please retry.');
    } finally {
      setClassesLoading(false);
    }
  };

  const savePlacement = async (event) => {
    event.preventDefault();
    if (placementSaving || classesLoading || classesError) return;
    const enrollment = viewingEnrollment;
    setPlacementSaving(true);
    setPlacementError('');
    try {
      const { data } = await enrollmentAPI.update(enrollment.id, { ...placement, class_id: placement.class_id || null });
      const selectedClass = classes.find((item) => item.id === data.class_id);
      const updated = {
        ...data,
        program_title: programs.find((item) => item.id === data.program_id)?.title || enrollment.program_title,
        class_name: selectedClass?.name || null,
        class_code: selectedClass?.code || null,
        class_status: selectedClass?.status || null,
        class_forum_category_id: selectedClass?.forum_category_id || null,
        instructor_name: selectedClass?.instructor_name || null,
      };
      setEnrollments((current) => current.map((row) => row.id === enrollment.id ? { ...row, ...updated } : row));
      setViewingEnrollment((current) => current?.id === enrollment.id ? { ...current, ...updated } : current);
      toast('Program, class, and session updated', 'success');
    } catch (err) {
      setPlacementError(err.response?.data?.error || 'Could not save enrollment changes. Please try again.');
    } finally {
      setPlacementSaving(false);
    }
  };

  useEffect(() => {
    const statusParam = searchParams.get('filter');
    const assessmentParam = searchParams.get('assessment');
    if (['pending', 'active', 'completed', 'dropped'].includes(statusParam)) setStatusFilter(statusParam);
    if (['recommended', 'submitted', 'reviewed', 'needs_followup'].includes(assessmentParam)) setAssessmentFilter(assessmentParam);
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [enrollRes, programRes] = await Promise.all([
        adminAPI.getEnrollments(),
        programAPI.getAll(),
      ]);
      setEnrollments(enrollRes.data || []);
      setPrograms(programRes.data || []);
    } catch (err) {
      toast('Failed to load enrollments', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id, status) => {
    try {
      await enrollmentAPI.update(id, { status });
      setEnrollments((current) => current.map(e => e.id === id ? { ...e, status } : e));
      setViewingEnrollment((current) => current?.id === id ? { ...current, status } : current);
      toast(`Enrollment status updated to ${status}`, 'success');
    } catch (err) {
      toast('Failed to update status', 'error');
    }
  };

  const exportCsv = () => {
    if (!filteredEnrollments.length) {
      toast('No enrollments to export', 'warning');
      return;
    }
    const headers = ['Student', 'Email', 'Program', 'Class', 'Session', 'Enrollment Status', 'Aptitude Status', 'Score'];
    const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = filteredEnrollments.map((row) => [
      row.student_name,
      row.student_email,
      row.program_title,
      row.class_name || '',
      row.session,
      row.status,
      row.assessment_status || 'missing',
      row.assessment_score != null ? `${row.assessment_score}/${row.assessment_max_score || 100}` : '',
    ].map(escapeCell).join(','));
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enrollments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openEnrollment = (row) => {
    setViewingEnrollment(row);
    setPlacement({ program_id: row.program_id, class_id: row.class_id || '', session: row.session || 'Morning' });
    setPlacementError('');
    loadClasses();
    setGradeForm({
      score: row.assessment_score ?? '',
      max_score: row.assessment_max_score || 100,
      feedback: row.assessment_feedback || '',
      status: row.assessment_status === 'needs_followup' ? 'needs_followup' : 'reviewed',
    });
  };

  const submitAssessmentGrade = async (e) => {
    e.preventDefault();
    if (!viewingEnrollment?.assessment_id) return;
    setGrading(true);
    try {
      const res = await adminAPI.gradeOnboardingAssessment(viewingEnrollment.assessment_id, gradeForm);
      const updated = {
        ...viewingEnrollment,
        assessment_status: res.data.status,
        assessment_score: res.data.score,
        assessment_max_score: res.data.max_score,
        assessment_feedback: res.data.feedback,
        reviewed_at: res.data.reviewed_at,
      };
      setViewingEnrollment(updated);
      setEnrollments((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast('Aptitude assessment graded', 'success');
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to grade assessment', 'error');
    } finally {
      setGrading(false);
    }
  };

  const recommendAssessment = async () => {
    if (!viewingEnrollment?.id || viewingEnrollment.assessment_id) return;
    setRecommending(true);
    try {
      const res = await adminAPI.recommendOnboardingAssessment(viewingEnrollment.id);
      const updated = {
        ...viewingEnrollment,
        assessment_id: res.data.id,
        assessment_status: res.data.status,
        assessment_score: res.data.score,
        assessment_max_score: res.data.max_score,
        assessment_feedback: res.data.feedback,
        date_of_birth: res.data.date_of_birth,
        gender: res.data.gender,
        education_level: res.data.education_level,
        computing_experience: res.data.computing_experience,
      };
      setViewingEnrollment(updated);
      setEnrollments((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast('Aptitude assessment recommended to student', 'success');
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to recommend aptitude assessment', 'error');
    } finally {
      setRecommending(false);
    }
  };

  const columns = [
    { key: 'student_name', label: 'Student', sortable: true },
    { key: 'student_email', label: 'Email', sortable: true },
    { key: 'program_title', label: 'Program', sortable: true },
    {
      key: 'class_name',
      label: 'Class',
      sortable: true,
      render: (row) => (
        <span className={row.class_name ? 'text-sm text-gray-700 dark:text-gray-200' : 'text-sm text-gray-400'}>
          {row.class_name ? `${row.class_name} (${row.class_code})` : 'Unallocated'}
        </span>
      ),
    },
    { key: 'session', label: 'Session', align: 'center' },
    {
      key: 'assessment_status',
      label: 'Aptitude',
      sortable: true,
      align: 'center',
      render: (row) => <AssessmentBadge row={row} />,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (row) => (
        <select
          value={row.status}
          onChange={(e) => updateStatus(row.id, e.target.value)}
          className="text-xs px-2 py-1 rounded-full border-0 focus:ring-1 focus:ring-brand-500 bg-white dark:bg-gray-800 cursor-pointer"
          aria-label={`Change status for ${row.student_name}`}
        >
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="dropped">Dropped</option>
        </select>
      ),
    },
    {
      key: 'enrolled_at',
      label: 'Enrolled Date',
      sortable: true,
      align: 'center',
      render: (row) => <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(row.enrolled_at).toLocaleDateString()}</span>,
    },
  ];

  const rowActions = [
    {
      key: 'view',
      label: 'Review',
      icon: Eye,
      variant: 'primary',
      onClick: openEnrollment,
    },
  ];

  const filteredEnrollments = enrollments.filter((e) =>
    (e.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     e.student_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     e.program_title?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!statusFilter || e.status === statusFilter) &&
    (!assessmentFilter || e.assessment_status === assessmentFilter) &&
    (!programFilter || e.program_id === programFilter)
  );

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'dropped', label: 'Dropped' },
  ];
  const assessmentOptions = [
    { value: '', label: 'All Assessments' },
    { value: 'recommended', label: 'Recommended' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'needs_followup', label: 'Needs Follow-up' },
  ];

  const programOptions = [{ value: '', label: 'All Programs' }, ...programs.map(p => ({ value: p.id, label: p.title }))];
  const pendingAssessments = enrollments.filter((item) => item.assessment_status === 'submitted').length;
  const recommendedAssessments = enrollments.filter((item) => item.assessment_status === 'recommended').length;
  const reviewedAssessments = enrollments.filter((item) => item.assessment_status === 'reviewed').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Enrollment Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Review applications, grade aptitude tests, and manage student enrollments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={Download} size="sm" onClick={exportCsv}>Export CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Applications</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{enrollments.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total enrollment requests</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Recommended Aptitude</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{recommendedAssessments}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Waiting for student response</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Submitted Aptitude</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">{pendingAssessments}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ready for admin grading</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Reviewed</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{reviewedAssessments}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ready for enrollment decision</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by student, email, or program..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            placeholder="Filter by status"
            className="w-full sm:w-40"
          />
          <Select
            value={assessmentFilter}
            onChange={(e) => setAssessmentFilter(e.target.value)}
            options={assessmentOptions}
            placeholder="Filter by aptitude"
            className="w-full sm:w-44"
          />
          <Select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            options={programOptions}
            placeholder="Filter by program"
            className="w-full sm:w-48"
          />
        </div>
      </div>

      {/* Enrollments Table */}
      <DataTable
        columns={columns}
        data={filteredEnrollments}
        keyField="id"
        loading={loading}
        emptyMessage="No enrollments found"
        rowActions={rowActions}
        pagination={{
          page: 1,
          pageSize: 15,
          total: filteredEnrollments.length,
        }}
      />

      {/* View Enrollment Modal */}
      {viewingEnrollment && (
        <Modal isOpen={!!viewingEnrollment} onClose={() => setViewingEnrollment(null)} title="Application Review" size="xl">
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</p>
                <p className="font-medium text-gray-900 dark:text-white">{viewingEnrollment.student_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</p>
                <p className="text-gray-600 dark:text-gray-400">{viewingEnrollment.student_email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Program</p>
                <p className="font-medium text-gray-900 dark:text-white">{viewingEnrollment.program_title}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Session</p>
                <p className="text-gray-600 dark:text-gray-400">{viewingEnrollment.session}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</p>
                <select
                  value={viewingEnrollment.status}
                  onChange={(e) => updateStatus(viewingEnrollment.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="dropped">Dropped</option>
                </select>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Enrolled</p>
                <p className="text-gray-600 dark:text-gray-400">{new Date(viewingEnrollment.enrolled_at).toLocaleDateString()}</p>
              </div>
            </div>

            <form onSubmit={savePlacement} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Change program, class, or session</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Changing the program or session clears the class selection. Choose a matching class or leave the student unallocated.</p>
              {classesError && <div role="alert" className="text-sm text-red-600">{classesError} <button type="button" onClick={loadClasses} className="underline">Retry</button></div>}
              {placementError && <p role="alert" className="text-sm text-red-600">{placementError}</p>}
              <fieldset disabled={placementSaving || classesLoading || Boolean(classesError)} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select label="Program" required value={placement.program_id} options={programs.map((item) => ({ value: item.id, label: item.title }))}
                  onChange={(event) => { setPlacement((current) => ({ ...current, program_id: event.target.value, class_id: '' })); setPlacementError(''); }} />
                <Select label="Session" required value={placement.session} options={['Morning', 'Evening'].map((value) => ({ value, label: value }))}
                  onChange={(event) => { setPlacement((current) => ({ ...current, session: event.target.value, class_id: '' })); setPlacementError(''); }} />
                <Select label="Class" value={placement.class_id} options={[
                  { value: '', label: classesLoading ? 'Loading classes...' : 'Unallocated' },
                  ...classes.filter((item) => item.program_id === placement.program_id && item.session === placement.session && (['planned', 'active'].includes(item.status) || item.id === viewingEnrollment.class_id))
                    .map((item) => ({ value: item.id, label: `${item.name} (${item.code})` })),
                ]} onChange={(event) => { setPlacement((current) => ({ ...current, class_id: event.target.value })); setPlacementError(''); }} />
              </fieldset>
              <Button type="submit" icon={Save} loading={placementSaving} disabled={classesLoading || Boolean(classesError)}>Save enrollment changes</Button>
            </form>

            {viewingEnrollment.assessment_id ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-brand-600" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Aptitude Test</h3>
                  </div>
                  <AssessmentBadge row={viewingEnrollment} />
                </div>
                <div className="grid gap-4 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <InfoBlock label="Date of Birth" value={viewingEnrollment.date_of_birth || 'Not supplied'} />
                    <InfoBlock label="Gender" value={viewingEnrollment.gender || 'Not supplied'} />
                    <InfoBlock label="Education" value={viewingEnrollment.education_level || 'Not supplied'} />
                    <InfoBlock label="Computing Experience" value={viewingEnrollment.computing_experience || 'Not supplied'} />
                  </div>

                  {viewingEnrollment.assessment_status === 'recommended' ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                      The aptitude test has been recommended. The grading form will appear after the student submits their responses.
                    </div>
                  ) : (
                    <>
                      <AssessmentAnswer label="Strengths" value={viewingEnrollment.strengths} />
                      <AssessmentAnswer label="Greatest Strength" value={viewingEnrollment.greatest_strength} />
                      <AssessmentAnswer label="Weaknesses" value={viewingEnrollment.weaknesses} />
                      <AssessmentAnswer label="Weakness Impact and Response" value={viewingEnrollment.weakness_response} />
                      <AssessmentAnswer label="Improvement Plan" value={viewingEnrollment.improvement_plan} />

                      <form onSubmit={submitAssessmentGrade} className="accent-card rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.4fr] gap-3">
                          <label>
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Score</span>
                            <input type="number" min="0" max={gradeForm.max_score || 100} value={gradeForm.score} onChange={(e) => setGradeForm((current) => ({ ...current, score: e.target.value }))} required className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </label>
                          <label>
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Max Score</span>
                            <input type="number" min="1" max="1000" value={gradeForm.max_score} onChange={(e) => setGradeForm((current) => ({ ...current, max_score: e.target.value }))} required className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </label>
                          <label>
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Review Status</span>
                            <select value={gradeForm.status} onChange={(e) => setGradeForm((current) => ({ ...current, status: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                              <option value="reviewed">Reviewed</option>
                              <option value="needs_followup">Needs Follow-up</option>
                            </select>
                          </label>
                        </div>
                        <label className="mt-3 block">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Admin Feedback</span>
                          <textarea rows={3} value={gradeForm.feedback} onChange={(e) => setGradeForm((current) => ({ ...current, feedback: e.target.value }))} placeholder="Readiness notes, recommended support, or follow-up instructions..." className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </label>
                        <div className="mt-4 flex justify-end">
                          <Button type="submit" icon={Save} disabled={grading}>
                            {grading ? 'Saving...' : 'Save Grade'}
                          </Button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">No aptitude assessment requested</p>
                    <p className="mt-1">Recommend the test only when admissions needs a readiness review for this applicant.</p>
                  </div>
                  <Button icon={Send} onClick={recommendAssessment} disabled={recommending}>
                    {recommending ? 'Recommending...' : 'Recommend Aptitude'}
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button variant="secondary" onClick={() => setViewingEnrollment(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AssessmentBadge({ row }) {
  if (!row.assessment_id) {
    return <span className="inline-flex text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Not requested</span>;
  }
  if (row.assessment_status === 'recommended') {
    return <span className="inline-flex text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Recommended</span>;
  }
  if (row.assessment_status === 'reviewed') {
    return <span className="inline-flex text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">{row.assessment_score ?? '-'} / {row.assessment_max_score || 100}</span>;
  }
  if (row.assessment_status === 'needs_followup') {
    return <span className="inline-flex text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100">Follow-up</span>;
  }
  return <span className="inline-flex text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Submitted</span>;
}

function InfoBlock({ label, value }) {
  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">{value}</p>
    </div>
  );
}

function AssessmentAnswer({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm leading-6 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
        {value || 'No response supplied.'}
      </p>
    </div>
  );
}
