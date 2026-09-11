import { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { assignmentAPI, classAPI, gradingAPI, programAPI, submissionAPI } from '../api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { Card, Button, Input, Select, Textarea } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
const RichTextEditor = lazy(() => import('../components/RichTextEditor'));

export default function EditAssignment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ title: '', description: '', program_id: '', class_id: '', instructions: '', rubric: '', max_score: 100, due_date: '' });
  const [instructionsHTML, setInstructionsHTML] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('details');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([assignmentAPI.get(id), submissionAPI.byAssignment(id), programAPI.getAll(), classAPI.getAll()])
      .then(([aRes, sRes, programRes, classRes]) => {
        const a = aRes.data;
        setForm({
          title: a.title,
          description: a.description,
          program_id: a.program_id || '',
          class_id: a.class_id || '',
          max_score: a.max_score,
          due_date: a.due_date || '',
          rubric: a.rubric || '',
        });
        setInstructionsHTML(a.instructions || '');
        setSubmissions(sRes.data || []);
        setPrograms(programRes.data || []);
        setClasses(classRes.data || []);
      })
      .catch(() => navigate('/instructor'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const programOptions = useMemo(() => programs.map((program) => ({ value: program.id, label: program.title })), [programs]);
  const classOptions = useMemo(() => classes
    .filter((item) => !form.program_id || item.program_id === form.program_id)
    .map((item) => ({ value: item.id, label: `${item.name} (${item.code})` })), [classes, form.program_id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await assignmentAPI.update(id, { ...form, instructions: instructionsHTML, max_score: parseInt(form.max_score) || 100 });
      toast('Assignment updated successfully', 'success');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleAIGrade = async (submissionId) => {
    const ok = await confirm('Grade this submission with AI? This may take a moment.', { title: 'AI grading', confirmText: 'Grade with AI' });
    if (!ok) return;
    try {
      await gradingAPI.aiGrade(submissionId);
      toast('AI grade complete', 'success');
      const res = await submissionAPI.byAssignment(id);
      setSubmissions(res.data || []);
    } catch (err) {
      toast(err.response?.data?.error || 'AI grading failed', 'error');
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const updateClass = (e) => {
    const classId = e.target.value;
    const selected = classes.find((item) => item.id === classId);
    setForm((prev) => ({ ...prev, class_id: classId, program_id: selected?.program_id || prev.program_id }));
  };

  if (loading) return <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white line-clamp-1">{form.title || 'Assignment'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage assignment details and review submissions</p>
        </div>
      </div>

      <div className="card mb-6 p-1.5 flex gap-1 overflow-x-auto">
        <TabBtn active={tab === 'details'} onClick={() => setTab('details')}>Details</TabBtn>
        <TabBtn active={tab === 'submissions'} onClick={() => setTab('submissions')}>Submissions ({submissions.length})</TabBtn>
      </div>

      {tab === 'details' && (
        <form onSubmit={handleSave} className="space-y-6">
          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-200">{error}</div>}
          <Card>
            <div className="space-y-4">
              <Input label="Title" value={form.title} onChange={update('title')} required />
              <Textarea label="Description" value={form.description} onChange={update('description')} rows={3} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Programme" value={form.program_id} onChange={(e) => setForm((prev) => ({ ...prev, program_id: e.target.value, class_id: '' }))} options={programOptions} placeholder="Choose programme" helperText={form.program_id ? 'Programme controls student visibility for this assignment.' : 'Legacy assignment: choose a programme before publishing broadly.'} />
                <Select label="Class" value={form.class_id} onChange={updateClass} options={[{ value: '', label: 'All active students in programme' }, ...classOptions]} helperText="Choose a class for roster-specific work, or leave blank for the whole programme." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Max Score" type="number" value={form.max_score} onChange={update('max_score')} />
                <Input label="Due Date" type="datetime-local" value={form.due_date} onChange={update('due_date')} />
              </div>
            </div>
          </Card>
          <Card>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Instructions</label>
            <Suspense fallback={<div className="h-[350px] flex items-center justify-center"><LoadingSpinner /></div>}>
              <RichTextEditor content={instructionsHTML} onChange={setInstructionsHTML} />
            </Suspense>
          </Card>
          <Card>
            <Textarea label="Rubric" value={form.rubric} onChange={update('rubric')} rows={6} />
          </Card>
          <div className="flex gap-3">
            <Button type="submit" loading={saving}>Save Changes</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/instructor')}>Back to Dashboard</Button>
          </div>
        </form>
      )}

      {tab === 'submissions' && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Student Submissions</h2>
          {submissions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-xl">📄</span>
              </div>
              <p className="text-gray-400">No submissions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((s) => (
                <div key={s.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:border-brand-200 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{s.student_name}</p>
                      <p className="text-xs text-gray-400">Submitted: {new Date(s.submitted_at).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">Status: <span className={`font-medium ${s.status === 'graded' ? 'text-green-600' : 'text-amber-600'}`}>{s.status}</span></p>
                    </div>
                    {s.score !== null && (
                      <div className="text-right">
                        <span className={`text-lg font-bold ${s.manually_overridden ? 'text-orange-500' : 'text-brand-600'}`}>{s.score}</span>
                        <span className="text-gray-400 text-sm">/{s.max_score}</span>
                      </div>
                    )}
                  </div>
                  {s.content && <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-300 max-h-32 overflow-y-auto" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(s.content) }} />}
                  {s.feedback && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-medium">Feedback:</span> {s.feedback}</p>
                      {s.strengths && <p className="text-sm text-green-700 dark:text-green-400"><span className="font-medium">Strengths:</span> {s.strengths}</p>}
                      {s.weaknesses && <p className="text-sm text-red-700 dark:text-red-400"><span className="font-medium">Weaknesses:</span> {s.weaknesses}</p>}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/submission/${s.id}`)}>View Details</Button>
                    {s.status !== 'graded' && <Button size="sm" onClick={() => handleAIGrade(s.id)} className="bg-purple-600 hover:bg-purple-700">Grade with AI</Button>}
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/gradebook?submission=${s.id}`)}>Manual Override</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </motion.div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 cursor-pointer ${active ? 'bg-white dark:bg-gray-700 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
      {children}
    </button>
  );
}
