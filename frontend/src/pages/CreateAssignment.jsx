import { motion } from 'framer-motion';
import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { assignmentAPI, classAPI, programAPI } from '../api';
import { Card, Button, Input, Select, Textarea } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
const RichTextEditor = lazy(() => import('../components/RichTextEditor'));

export default function CreateAssignment() {
  const [form, setForm] = useState({ title: '', description: '', program_id: '', class_id: '', instructions: '', rubric: '', max_score: 100, due_date: '' });
  const [instructionsHTML, setInstructionsHTML] = useState('');
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([programAPI.getAll(), classAPI.getAll()])
      .then(([programRes, classRes]) => {
        setPrograms(programRes.data || []);
        setClasses(classRes.data || []);
      })
      .catch(() => setError('Could not load programmes and classes. Refresh and try again.'));
  }, []);

  const classOptions = useMemo(() => classes
    .filter((item) => !form.program_id || item.program_id === form.program_id)
    .map((item) => ({ value: item.id, label: `${item.name} (${item.code})` })), [classes, form.program_id]);

  const programOptions = useMemo(() => programs.map((program) => ({ value: program.id, label: program.title })), [programs]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      return setError('Title and description are required');
    }
    if (!form.program_id) {
      return setError('Please choose the programme this assignment belongs to');
    }
    setLoading(true);
    setError('');
    try {
      const res = await assignmentAPI.create({
        ...form,
        max_score: parseInt(form.max_score) || 100,
        instructions: instructionsHTML,
      });
      navigate(`/instructor/edit/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const updateClass = (e) => {
    const classId = e.target.value;
    const selected = classes.find((item) => item.id === classId);
    setForm((prev) => ({ ...prev, class_id: classId, program_id: selected?.program_id || prev.program_id }));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Assignment</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Set up a new exercise or assignment for your students</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-200">{error}</div>}

        <Card>
          <div className="space-y-4">
            <Input label="Assignment Title" value={form.title} onChange={update('title')} placeholder="e.g., Introduction to Programming - Week 1" required />
            <Textarea label="Description" value={form.description} onChange={update('description')} placeholder="Brief description of the assignment" rows={3} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Programme" value={form.program_id} onChange={(e) => setForm((prev) => ({ ...prev, program_id: e.target.value, class_id: '' }))} options={programOptions} placeholder="Choose programme" required />
              <Select label="Class" value={form.class_id} onChange={updateClass} options={[{ value: '', label: 'All active students in programme' }, ...classOptions]} helperText="Choose a class for roster-specific work, or leave blank for the whole programme." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Maximum Score" type="number" value={form.max_score} onChange={update('max_score')} min="1" max="1000" />
              <Input label="Due Date" type="datetime-local" value={form.due_date} onChange={update('due_date')} />
            </div>
          </div>
        </Card>

        <Card>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Instructions & Details</label>
          <Suspense fallback={<div className="h-[350px] flex items-center justify-center"><LoadingSpinner /></div>}>
            <RichTextEditor content={instructionsHTML} onChange={setInstructionsHTML} placeholder="Provide detailed instructions for students..." />
          </Suspense>
        </Card>

        <Card>
          <Textarea label="Marking Rubric" value={form.rubric} onChange={update('rubric')} rows={6} placeholder={`Define the marking criteria here. The AI will use this to grade submissions.\n\nExample:\n- Code correctness (40%)\n- Code style & organization (20%)\n- Documentation & comments (20%)\n- Problem-solving approach (20%)`} />
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={loading}>Create Assignment</Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        </div>
      </form>
    </motion.div>
  );
}
