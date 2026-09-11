import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { fileAPI, openBlobDownload, submissionAPI, gradingAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function SubmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [manualGrade, setManualGrade] = useState({ score: 0, feedback: '', strengths: '', weaknesses: '', suggestions: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';

  const downloadSubmission = async () => {
    try {
      const res = await fileAPI.submission(id);
      openBlobDownload(res, `submission-${id}`);
    } catch (err) {
      toast(err.response?.data?.error || 'You do not have access to this file', 'error');
    }
  };

  useEffect(() => {
    submissionAPI.get(id)
      .then((res) => {
        setSubmission(res.data);
        if (res.data.score) setManualGrade((prev) => ({ ...prev, score: res.data.score, feedback: res.data.feedback || '', strengths: res.data.strengths || '', weaknesses: res.data.weaknesses || '', suggestions: res.data.suggestions || '' }));
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAIGrade = async () => {
    setAiLoading(true);
    try {
      await gradingAPI.aiGrade(id);
      const res = await submissionAPI.get(id);
      setSubmission(res.data);
    } catch (err) {
      toast(err.response?.data?.error || 'AI grading failed', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleManualGrade = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await gradingAPI.manualGrade(id, manualGrade);
      const res = await submissionAPI.get(id);
      setSubmission(res.data);
      setManualMode(false);
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to save grade', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!submission) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{submission.assignment_title}</h1>
        <p className="text-gray-500 text-sm mt-1">Submitted by {submission.student_name} on {new Date(submission.submitted_at).toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {submission.content && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Student's Answer</h3>
              <div className="text-sm text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(submission.content) }} />
            </div>
          )}

          {submission.file_path && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Uploaded File</h3>
              <button type="button" onClick={downloadSubmission} className="text-brand-600 hover:text-brand-700 text-sm font-medium flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Download File ({submission.file_type})
              </button>
            </div>
          )}

          {submission.instructions && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Assignment Instructions</h3>
              <div className="text-sm text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(submission.instructions) }} />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Grade</h3>
            {submission.score !== null ? (
              <div className="text-center">
                <span className="text-4xl font-bold text-brand-600">{Math.round(submission.score)}</span>
                <span className="text-gray-400 text-lg">/{submission.max_score}</span>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${submission.manually_overridden ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                    {submission.manually_overridden ? 'Manual' : 'AI'} Grade
                  </span>
                  <span className="text-xs text-gray-400">by {submission.graded_by}</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4 text-sm">Not yet graded</p>
            )}
          </div>

          {submission.feedback && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Detailed Feedback</h3>
              <p className="text-sm text-gray-600">{submission.feedback}</p>
              {submission.strengths && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-green-700 mb-1">Strengths</p>
                  <p className="text-sm text-gray-600">{submission.strengths}</p>
                </div>
              )}
              {submission.weaknesses && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-red-700 mb-1">Weaknesses</p>
                  <p className="text-sm text-gray-600">{submission.weaknesses}</p>
                </div>
              )}
              {submission.suggestions && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-blue-700 mb-1">Suggestions</p>
                  <p className="text-sm text-gray-600">{submission.suggestions}</p>
                </div>
              )}
            </div>
          )}

          {isInstructor && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Instructor Actions</h3>
              <div className="space-y-2">
                {submission.status !== 'graded' && (
                  <button onClick={handleAIGrade} disabled={aiLoading} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                    {aiLoading ? 'AI Grading...' : 'Grade with AI'}
                  </button>
                )}
                <button onClick={() => setManualMode(!manualMode)} className="w-full btn-secondary text-sm">
                  {manualMode ? 'Cancel' : 'Manual Override'}
                </button>
              </div>

              {manualMode && (
                <form onSubmit={handleManualGrade} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Score (out of {submission.max_score})</label>
                    <input type="number" className="input-field text-sm" value={manualGrade.score} onChange={(e) => setManualGrade({ ...manualGrade, score: e.target.value })} max={submission.max_score} required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Feedback</label>
                    <textarea className="input-field text-sm" rows={3} value={manualGrade.feedback} onChange={(e) => setManualGrade({ ...manualGrade, feedback: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Strengths</label>
                    <input type="text" className="input-field text-sm" value={manualGrade.strengths} onChange={(e) => setManualGrade({ ...manualGrade, strengths: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Weaknesses</label>
                    <input type="text" className="input-field text-sm" value={manualGrade.weaknesses} onChange={(e) => setManualGrade({ ...manualGrade, weaknesses: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Suggestions</label>
                    <input type="text" className="input-field text-sm" value={manualGrade.suggestions} onChange={(e) => setManualGrade({ ...manualGrade, suggestions: e.target.value })} />
                  </div>
                  <button type="submit" disabled={saving} className="btn-primary w-full text-sm">
                    {saving ? 'Saving...' : 'Save Grade'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}
