import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { quizAPI, programAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const emptyQuiz = {
  program_id: '',
  title: '',
  description: '',
  due_date: '',
  time_limit: 30,
  questions: [],
};

const emptyQuestion = {
  question_text: '',
  type: 'multiple_choice',
  points: 1,
  options: [],
};

const emptyOption = {
  option_text: '',
  is_correct: false,
};

export default function Quizzes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...emptyQuiz });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const confirm = useConfirm();

  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';

  useEffect(() => {
    const load = isInstructor
      ? Promise.all([quizAPI.getAll({ all: 'true' }), programAPI.getAll()])
      : quizAPI.getAll({ all: 'true' });
    Promise.resolve(load)
      .then((res) => {
        if (isInstructor) {
          setQuizzes(res[0].data);
          setPrograms(res[1].data || []);
        } else {
          setQuizzes(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await quizAPI.create(form);
      setQuizzes((prev) => [...prev, res.data]);
      setShowModal(false);
      setForm({ ...emptyQuiz });
      toast('Quiz created successfully', 'success');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const addQuestion = () => setForm({ ...form, questions: [...form.questions, { ...emptyQuestion }] });

  const removeQuestion = (qi) => setForm({ ...form, questions: form.questions.filter((_, i) => i !== qi) });

  const updateQuestion = (qi, field) => (e) => {
    const qs = [...form.questions];
    qs[qi] = { ...qs[qi], [field]: e.target.value };
    if (field === 'type' && e.target.value === 'essay') qs[qi].options = [];
    setForm({ ...form, questions: qs });
  };

  const addOption = (qi) => {
    const qs = [...form.questions];
    qs[qi].options = [...qs[qi].options, { ...emptyOption }];
    setForm({ ...form, questions: qs });
  };

  const removeOption = (qi, oi) => {
    const qs = [...form.questions];
    qs[qi].options = qs[qi].options.filter((_, i) => i !== oi);
    setForm({ ...form, questions: qs });
  };

  const updateOption = (qi, oi, field) => (e) => {
    const qs = [...form.questions];
    const value = field === 'is_correct' ? e.target.checked : e.target.value;
    qs[qi].options[oi] = { ...qs[qi].options[oi], [field]: value };
    setForm({ ...form, questions: qs });
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Delete this quiz and all submissions? This cannot be undone.', { danger: true, title: 'Delete quiz', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await quizAPI.delete(id);
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
      toast('Quiz deleted', 'info');
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to delete quiz', 'error');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quizzes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isInstructor ? 'Create and manage quizzes for your programs' : 'Take quizzes and track your scores'}
          </p>
        </div>
        {isInstructor && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Create Quiz
          </button>
        )}
      </div>

      {quizzes.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <p className="text-gray-500 mb-2">No quizzes available</p>
          {isInstructor && (
            <button onClick={() => setShowModal(true)} className="text-brand-600 hover:text-brand-700 text-sm font-medium inline-block">
              Create your first quiz
            </button>
          )}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q) => {
            const sub = q.submission;
            const isGraded = sub?.score != null;
            return (
              <motion.div
                key={q.id}
                variants={item}
                className="card hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  if (isInstructor) return;
                  if (sub && isGraded) navigate(`/quizzes/${q.id}/${sub.id}`);
                  else navigate(`/quizzes/${q.id}`);
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 truncate">{q.title}</h3>
                  {sub ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${isGraded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {isGraded ? `${Math.round(sub.score)}/${q.total_points || 0}` : 'Submitted'}
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0">Pending</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{q.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{q.instructor_name || 'Unknown'}</span>
                  <span>{q.due_date ? new Date(q.due_date).toLocaleDateString() : 'No due date'}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>{q.questions_count || q.questions?.length || 0} questions</span>
                  {q.time_limit && <span>{q.time_limit} min</span>}
                </div>
                {isInstructor && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <span className="text-sm text-gray-400 flex-1 text-center">{q.questionCount || 0} questions</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 pb-10 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="accent-card bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Create Quiz</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200 mb-4">{error}</div>}

            <form onSubmit={handleCreateQuiz} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                  <select className="input-field" value={form.program_id} onChange={updateForm('program_id')} required>
                    <option value="">Select a program</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title *</label>
                  <input type="text" className="input-field" value={form.title} onChange={updateForm('title')} placeholder="e.g., Week 1 Quiz" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea className="input-field" rows={3} value={form.description} onChange={updateForm('description')} placeholder="Brief description of the quiz" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input type="datetime-local" className="input-field" value={form.due_date} onChange={updateForm('due_date')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (minutes)</label>
                    <input type="number" className="input-field" value={form.time_limit} onChange={updateForm('time_limit')} min="1" max="999" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Questions</h3>
                  <button type="button" onClick={addQuestion} className="btn-secondary text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Question
                  </button>
                </div>
                {form.questions.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No questions yet. Click "Add Question" to get started.</p>
                )}
                <div className="space-y-4">
                  {form.questions.map((q, qi) => (
                    <div key={qi} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">Question {qi + 1}</span>
                        <button type="button" onClick={() => removeQuestion(qi)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Question Text</label>
                          <input type="text" className="input-field text-sm" value={q.question_text} onChange={updateQuestion(qi, 'question_text')} placeholder="Enter your question" required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Type</label>
                            <select className="input-field text-sm" value={q.type} onChange={updateQuestion(qi, 'type')}>
                              <option value="multiple_choice">Multiple Choice</option>
                              <option value="essay">Essay</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Points</label>
                            <input type="number" className="input-field text-sm" value={q.points} onChange={updateQuestion(qi, 'points')} min="1" max="999" required />
                          </div>
                        </div>
                        {q.type === 'multiple_choice' && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-xs text-gray-500">Options</label>
                              <button type="button" onClick={() => addOption(qi)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">+ Add Option</button>
                            </div>
                            {q.options.length === 0 && <p className="text-xs text-gray-400">No options added</p>}
                            <div className="space-y-2">
                              {q.options.map((o, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={o.is_correct}
                                    onChange={updateOption(qi, oi, 'is_correct')}
                                    className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                                  />
                                  <input
                                    type="text"
                                    className="input-field text-sm flex-1"
                                    value={o.option_text}
                                    onChange={updateOption(qi, oi, 'option_text')}
                                    placeholder={`Option ${oi + 1}`}
                                    required
                                  />
                                  <button type="button" onClick={() => removeOption(qi, oi)} className="text-gray-400 hover:text-red-600 flex-shrink-0">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Creating...' : 'Create Quiz'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}
