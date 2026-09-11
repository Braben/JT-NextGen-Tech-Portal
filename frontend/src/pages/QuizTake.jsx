import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { quizAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function QuizTake() {
  const { id, submissionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');

  const isResultsView = Boolean(submissionId);

  useEffect(() => {
    if (isResultsView) {
      Promise.all([quizAPI.get(id), quizAPI.getSubmission(submissionId)])
        .then(([qRes, sRes]) => {
          setQuiz(qRes.data);
          setSubmission(sRes.data);
        })
        .catch(() => navigate('/quizzes'))
        .finally(() => setLoading(false));
    } else {
      quizAPI.get(id)
        .then((res) => {
          setQuiz(res.data);
          if (res.data.questions) {
            setAnswers(res.data.questions.map((q) => ({ question_id: q.id, answer: q.type === 'multiple_choice' ? '' : '' })));
          }
        })
        .catch(() => navigate('/quizzes'))
        .finally(() => setLoading(false));
    }
  }, [id, submissionId]);

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => prev.map((a) => (a.question_id === questionId ? { ...a, answer: value } : a)));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await quizAPI.submit(id, { answers });
      navigate(`/quizzes/${id}/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit quiz');
      setSubmitting(false);
      setConfirm(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!quiz) return null;

  if (isResultsView && submission) {
    const totalPoints = quiz.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || 0;
    const earnedPoints = submission.answers?.reduce((sum, a) => sum + (a.points_earned || 0), 0) || 0;
    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
          <p className="text-gray-500 text-sm mt-1">Results & Review</p>
        </div>

        <div className="card mb-6 text-center">
          <p className="text-4xl font-bold text-brand-600 mb-2">{percentage}%</p>
          <p className="text-gray-500 text-sm">
            {earnedPoints} / {totalPoints} points
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4 max-w-xs mx-auto">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ${
                percentage >= 70 ? 'bg-green-500' : percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          {quiz.questions?.map((q, qi) => {
            const a = submission.answers?.find((ans) => ans.question_id === q.id);
            const correctOpt = q.options?.find((o) => o.is_correct);
            const isCorrect = q.type === 'multiple_choice' ? a?.answer === correctOpt?.option_text : null;

            return (
              <motion.div key={q.id} variants={item} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-400">Q{qi + 1}</span>
                      {q.type === 'multiple_choice' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          isCorrect ? 'bg-green-100 text-green-700' : isCorrect === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isCorrect ? 'Correct' : isCorrect === false ? 'Incorrect' : 'Ungraded'}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 font-medium">{q.question}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-500 ml-3 flex-shrink-0">{a?.points_earned || 0}/{q.points}</span>
                </div>

                {q.type === 'multiple_choice' ? (
                  <div className="space-y-1.5 mt-2">
                    {q.options?.map((o) => {
                      const isSelected = a?.answer === o.option_text;
                      const isCorrectOption = o.is_correct;
                      let bg = 'border-gray-200 bg-white';
                      if (isCorrectOption) bg = 'border-green-300 bg-green-50';
                      else if (isSelected && !isCorrectOption) bg = 'border-red-300 bg-red-50';
                      return (
                        <div key={o.id || o.option_text} className={`border rounded-lg px-3 py-2 text-sm ${bg} flex items-center gap-2`}>
                          <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                            isSelected && isCorrectOption ? 'border-green-500 bg-green-500' :
                            isSelected ? 'border-red-500 bg-red-500' :
                            isCorrectOption ? 'border-green-500' : 'border-gray-300'
                          }`}>
                            {isCorrectOption && (
                              <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            )}
                          </span>
                          <span className={isSelected && !isCorrectOption ? 'text-red-700' : isCorrectOption ? 'text-green-700 font-medium' : 'text-gray-700'}>
                            {o.option_text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Your answer:</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{a?.answer || '(No answer provided)'}</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        <div className="mt-6">
          <button onClick={() => navigate('/quizzes')} className="btn-secondary">Back to Quizzes</button>
        </div>
      </div>
    );
  }

  const allAnswered = answers.length > 0 && answers.every((a) => a.answer !== '');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
        {quiz.description && <p className="text-gray-500 text-sm mt-1">{quiz.description}</p>}
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
          {quiz.time_limit && <span>Time limit: {quiz.time_limit} minutes</span>}
          <span>Questions: {quiz.questions?.length || 0}</span>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200 mb-4">{error}</div>}

      {!confirm ? (
        <>
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
            {quiz.questions?.map((q, qi) => {
              const currentAnswer = answers.find((a) => a.question_id === q.id);
              return (
                <motion.div key={q.id} variants={item} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-400">Q{qi + 1}</span>
                        <span className="text-xs text-gray-400">{q.points} pt{q.points > 1 ? 's' : ''}</span>
                      </div>
                      <p className="text-gray-900 font-medium">{q.question}</p>
                    </div>
                  </div>

                  {q.type === 'multiple_choice' ? (
                    <div className="space-y-2 mt-2">
                      {q.options?.map((o) => (
                        <label
                          key={o.id || o.option_text}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            currentAnswer?.answer === o.option_text
                              ? 'border-brand-300 bg-brand-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question_${q.id}`}
                            value={o.option_text}
                            checked={currentAnswer?.answer === o.option_text}
                            onChange={(e) => setAnswer(q.id, e.target.value)}
                            className="w-4 h-4 text-brand-600 border-gray-300 focus:ring-brand-500"
                          />
                          <span className="text-sm text-gray-700">{o.option_text}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <textarea
                        className="input-field"
                        rows={4}
                        placeholder="Write your answer..."
                        value={currentAnswer?.answer || ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => setConfirm(true)}
              disabled={!allAnswered}
              className="btn-primary"
            >
              Submit Quiz
            </button>
            <button onClick={() => navigate('/quizzes')} className="btn-secondary">Cancel</button>
          </div>
        </>
      ) : (
        <div className="card text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Submit Quiz?</h2>
          <p className="text-gray-500 text-sm mb-2">You answered {answers.filter((a) => a.answer !== '').length} of {quiz.questions?.length} questions.</p>
          <p className="text-gray-400 text-xs mb-6">This action cannot be undone.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              {submitting ? 'Submitting...' : 'Confirm Submit'}
            </button>
            <button onClick={() => setConfirm(false)} className="btn-secondary">Go Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}
