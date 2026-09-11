/**
 * ClassAllocation - role-aware programme/class allocation workspace.
 *
 * Admins manage class setup and student allocation, instructors communicate
 * with assigned classes, and students get a focused view of their own class
 * plus the related discussion room.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { adminAPI, classAPI, programAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input, Modal, Select, Textarea } from '../components/ui';

const blankClass = {
  program_id: '',
  instructor_id: '',
  name: '',
  code: '',
  session: 'Morning',
  capacity: 25,
  start_date: '',
  end_date: '',
  status: 'planned',
};

const statusOptions = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const sessionOptions = [
  { value: 'Morning', label: 'Morning' },
  { value: 'Evening', label: 'Evening' },
];

function roleForumPath(role, categoryId) {
  if (!categoryId) return null;
  if (role === 'admin') return `/admin/forums/${categoryId}`;
  if (role === 'instructor') return `/instructor/forums/${categoryId}`;
  return `/student/forums/${categoryId}`;
}

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function classLoadError(err) {
  return err.response?.data?.error || err.message || 'Something went wrong';
}

export default function ClassAllocation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [showClassModal, setShowClassModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classForm, setClassForm] = useState(blankClass);
  const [rosterState, setRosterState] = useState({ classRow: null, students: [], selected: [] });
  const [messageState, setMessageState] = useState({ classRow: null, content: '' });
  const [fieldErrors, setFieldErrors] = useState({});

  const isAdmin = user?.role === 'admin';
  const isInstructor = user?.role === 'instructor';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [classAPI.getAll()];
      if (isAdmin) requests.push(programAPI.getAll(), adminAPI.getUsers('instructor'), adminAPI.getEnrollments());
      const [classRes, programRes, instructorRes, enrollmentRes] = await Promise.all(requests);
      setClasses(classRes.data || []);
      if (isAdmin) {
        setPrograms(programRes.data || []);
        setInstructors(instructorRes.data || []);
        setEnrollments(enrollmentRes.data || []);
      }
    } catch (err) {
      toast(classLoadError(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredClasses = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return classes;
    return classes.filter((item) => [
      item.name,
      item.code,
      item.program_title,
      item.instructor_name,
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [classes, query]);

  const stats = useMemo(() => {
    const active = classes.filter((item) => item.status === 'active').length;
    const seats = classes.reduce((sum, item) => sum + Number(item.capacity || 0), 0);
    const allocated = classes.reduce((sum, item) => sum + Number(item.allocated_count || 0), 0);
    const unallocated = enrollments.filter((item) => !item.class_id && !['completed', 'dropped'].includes(item.status)).length;
    return { active, seats, allocated, unallocated };
  }, [classes, enrollments]);

  const openClassModal = (row = null) => {
    setSelectedClass(row);
    setShowClassModal(true);
    setFieldErrors({});
    setClassForm(row ? {
      program_id: row.program_id,
      instructor_id: row.instructor_id || '',
      name: row.name || '',
      code: row.code || '',
      session: row.session || 'Morning',
      capacity: row.capacity || 25,
      start_date: row.start_date || '',
      end_date: row.end_date || '',
      status: row.status || 'planned',
    } : blankClass);
  };

  const saveClass = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      if (selectedClass) await classAPI.update(selectedClass.id, classForm);
      else await classAPI.create(classForm);
      toast(selectedClass ? 'Class updated' : 'Class created', 'success');
      setShowClassModal(false);
      setSelectedClass(null);
      await loadData();
    } catch (err) {
      setFieldErrors(err.response?.data?.fieldErrors || {});
      toast(classLoadError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openRoster = async (row) => {
    setRosterState({ classRow: row, students: [], selected: [] });
    try {
      const res = await classAPI.getRoster(row.id);
      setRosterState({ classRow: res.data.class, students: res.data.students || [], selected: [] });
    } catch (err) {
      toast(classLoadError(err), 'error');
    }
  };

  const allocateSelected = async () => {
    if (!rosterState.classRow || !rosterState.selected.length) return;
    setSaving(true);
    try {
      await classAPI.allocate(rosterState.classRow.id, rosterState.selected);
      toast('Students allocated to class', 'success');
      await loadData();
      await openRoster(rosterState.classRow);
    } catch (err) {
      toast(classLoadError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendClassMessage = async (event) => {
    event.preventDefault();
    if (!messageState.classRow || !messageState.content.trim()) return;
    setSaving(true);
    try {
      const res = await classAPI.sendMessage(messageState.classRow.id, messageState.content);
      toast(`Message sent to ${res.data.sent} student(s)`, 'success');
      setMessageState({ classRow: null, content: '' });
    } catch (err) {
      toast(classLoadError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const availableEnrollments = useMemo(() => {
    if (!rosterState.classRow) return [];
    return enrollments.filter((item) =>
      item.program_id === rosterState.classRow.program_id &&
      item.class_id !== rosterState.classRow.id &&
      !['completed', 'dropped'].includes(item.status)
    );
  }, [enrollments, rosterState.classRow]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Programme Classes</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isAdmin && 'Create cohorts, allocate students, and keep class communication in one place.'}
            {isInstructor && 'Review assigned classes, rosters, messages, and discussions.'}
            {!isAdmin && !isInstructor && 'Your allocated class, instructor, messages, and discussion space.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input-field pl-9 sm:w-72"
              placeholder="Search classes"
              aria-label="Search classes"
            />
          </div>
          {isAdmin && <Button icon={Plus} onClick={() => openClassModal()}>New Class</Button>}
        </div>
      </div>

      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Classes" value={classes.length} detail="Configured cohorts" icon={BookOpen} />
          <Stat label="Active" value={stats.active} detail="Currently running" icon={CheckCircle2} tone="emerald" />
          <Stat label="Seats Used" value={`${stats.allocated}/${stats.seats || 0}`} detail="Allocated capacity" icon={Users} tone="indigo" />
          <Stat label="Unallocated" value={stats.unallocated} detail="Needs class placement" icon={CalendarDays} tone="amber" />
        </div>
      )}

      {filteredClasses.length === 0 ? (
        <EmptyState isAdmin={isAdmin} onCreate={() => openClassModal()} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredClasses.map((row) => (
            <ClassCard
              key={row.id}
              row={row}
              role={user?.role}
              canEdit={isAdmin}
              canMessage={isAdmin || isInstructor}
              onEdit={() => openClassModal(row)}
              onRoster={() => openRoster(row)}
              onMessage={() => setMessageState({ classRow: row, content: '' })}
            />
          ))}
        </div>
      )}

      <Modal isOpen={isAdmin && showClassModal} onClose={() => { setShowClassModal(false); setSelectedClass(null); setClassForm(blankClass); }} title={selectedClass ? 'Edit Class' : 'New Class'} size="lg">
        <form onSubmit={saveClass} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Program"
              value={classForm.program_id}
              onChange={(event) => setClassForm((prev) => ({ ...prev, program_id: event.target.value }))}
              options={programs.map((program) => ({ value: program.id, label: program.title }))}
              placeholder="Choose program"
              disabled={Boolean(selectedClass)}
              error={fieldErrors.program_id}
              required
            />
            <Select
              label="Instructor"
              value={classForm.instructor_id}
              onChange={(event) => setClassForm((prev) => ({ ...prev, instructor_id: event.target.value }))}
              options={[{ value: '', label: 'Unassigned' }, ...instructors.map((instructor) => ({ value: instructor.id, label: instructor.name }))]}
              error={fieldErrors.instructor_id}
            />
            <Input label="Class name" value={classForm.name} onChange={(event) => setClassForm((prev) => ({ ...prev, name: event.target.value }))} error={fieldErrors.name} required />
            <Input label="Class code" value={classForm.code} onChange={(event) => setClassForm((prev) => ({ ...prev, code: event.target.value }))} error={fieldErrors.code} required />
            <Select label="Session" value={classForm.session} onChange={(event) => setClassForm((prev) => ({ ...prev, session: event.target.value }))} options={sessionOptions} error={fieldErrors.session} required />
            <Input label="Capacity" type="number" min="1" max="500" value={classForm.capacity} onChange={(event) => setClassForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))} error={fieldErrors.capacity} required />
            <Input label="Start date" type="date" value={classForm.start_date} onChange={(event) => setClassForm((prev) => ({ ...prev, start_date: event.target.value }))} />
            <Input label="End date" type="date" value={classForm.end_date} onChange={(event) => setClassForm((prev) => ({ ...prev, end_date: event.target.value }))} />
            <Select label="Status" value={classForm.status} onChange={(event) => setClassForm((prev) => ({ ...prev, status: event.target.value }))} options={statusOptions} error={fieldErrors.status} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowClassModal(false); setSelectedClass(null); setClassForm(blankClass); }}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Class</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(rosterState.classRow)} onClose={() => setRosterState({ classRow: null, students: [], selected: [] })} title={rosterState.classRow?.name || 'Class Roster'} size="xl">
        <div className="space-y-5">
          <RosterList students={rosterState.students} />
          {isAdmin && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Assign Students</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Students can be placed here or moved from another class in this programme.</p>
                </div>
                <Button size="sm" disabled={!rosterState.selected.length} loading={saving} onClick={allocateSelected}>Allocate</Button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {availableEnrollments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">No available students for this programme.</p>
                ) : availableEnrollments.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      checked={rosterState.selected.includes(item.id)}
                      onChange={(event) => setRosterState((prev) => ({
                        ...prev,
                        selected: event.target.checked
                          ? [...prev.selected, item.id]
                          : prev.selected.filter((id) => id !== item.id),
                      }))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{item.student_name}</span>
                      <span className="block truncate text-xs text-gray-500">{item.student_email} - {item.class_name ? `currently ${item.class_name}` : item.status}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={Boolean(messageState.classRow)} onClose={() => setMessageState({ classRow: null, content: '' })} title={`Message ${messageState.classRow?.name || 'Class'}`} size="lg">
        <form onSubmit={sendClassMessage} className="space-y-4">
          <Textarea
            label="Message"
            value={messageState.content}
            onChange={(event) => setMessageState((prev) => ({ ...prev, content: event.target.value }))}
            rows={6}
            maxLength={4000}
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMessageState({ classRow: null, content: '' })}>Cancel</Button>
            <Button type="submit" icon={Send} loading={saving}>Send to Class</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Stat({ label, value, detail, icon: Icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  };
  return (
    <div className="card flex items-start gap-4">
      <div className={`rounded-lg p-2.5 ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{detail}</p>
      </div>
    </div>
  );
}

function ClassCard({ row, role, canEdit, canMessage, onEdit, onRoster, onMessage }) {
  const forumPath = roleForumPath(role, row.forum_category_id);
  const seatsUsed = Number(row.allocated_count || 0);
  const capacity = Number(row.capacity || 0);
  const utilization = capacity ? Math.min(100, Math.round((seatsUsed / capacity) * 100)) : 0;

  return (
    <article className="card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">{row.name}</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{row.code}</span>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold capitalize text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{row.status}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{row.program_title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>}
          <Button size="sm" variant="outline" icon={Users} onClick={onRoster}>Roster</Button>
          {canMessage && <Button size="sm" icon={MessageSquare} onClick={onMessage}>Message</Button>}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Info label="Instructor" value={row.instructor_name || 'Unassigned'} />
        <Info label="Session" value={row.session || 'Not set'} />
        <Info label="Start" value={formatDate(row.start_date)} />
        <Info label="End" value={formatDate(row.end_date)} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-200">Seats</span>
          <span className="text-gray-500 dark:text-gray-400">{seatsUsed}/{capacity}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${utilization}%` }} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {forumPath && (
          <Link to={forumPath} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Class discussion
          </Link>
        )}
      </div>
    </article>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function RosterList({ students }) {
  return (
    <div>
      <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Current Roster</h3>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        {students.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No students allocated yet.</p>
        ) : students.map((student) => (
          <div key={student.id} className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 last:border-0 dark:border-gray-700">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{student.student_name}</p>
              <p className="truncate text-xs text-gray-500">{student.student_email}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold capitalize text-gray-600 dark:bg-gray-800 dark:text-gray-300">{student.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ isAdmin, onCreate }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
      <Users className="mx-auto h-10 w-10 text-gray-300" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">No classes yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
        Classes turn approved enrollments into real cohorts with a roster, instructor, message channel, and discussion page.
      </p>
      {isAdmin && <Button className="mt-5" icon={Plus} onClick={onCreate}>Create First Class</Button>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
    </div>
  );
}
