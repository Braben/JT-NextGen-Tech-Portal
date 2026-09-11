import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { assignmentAPI, submissionAPI } from '../api';
import RichTextEditor from '../components/RichTextEditor';
import { useChatbot } from '../context/ChatbotContext';

export default function SubmitAssignment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setAssignmentContext } = useChatbot();
  const [assignment, setAssignment] = useState(null);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    Promise.all([assignmentAPI.get(id), submissionAPI.my()])
      .then(([aRes, sRes]) => {
        setAssignment(aRes.data);
        setAssignmentContext({ id: aRes.data.id, title: aRes.data.title });
        const found = sRes.data.find((s) => s.assignment_id === id);
        if (found) {
          setExistingSubmission(found);
          setContent(found.content || '');
        }
      })
      .catch(() => navigate('/student'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content && !file) {
      return setError('Please provide your answer or upload a file');
    }
    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('assignment_id', id);
      if (content) formData.append('content', content);
      if (file) formData.append('file', file);

      if (existingSubmission) {
        await submissionAPI.update(existingSubmission.id, formData);
        setSuccess('Submission updated successfully!');
      } else {
        await submissionAPI.create(formData);
        setSuccess('Assignment submitted successfully!');
      }
      setTimeout(() => navigate('/student'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!assignment) return <p className="text-gray-500 dark:text-gray-400 text-center py-10">Assignment not found</p>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{assignment.title}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{assignment.description}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
          <span>Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleString() : 'No deadline'}</span>
          <span>Max Score: {assignment.max_score}</span>
          <span>Instructor: {assignment.instructor_name}</span>
        </div>
      </div>

      {assignment.instructions && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Instructions</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(assignment.instructions) }} />
        </div>
      )}

      {existingSubmission && existingSubmission.status === 'graded' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-medium text-sm">This assignment has been graded. Score: {Math.round(existingSubmission.score)}/{assignment.max_score}</p>
          {existingSubmission.feedback && <p className="text-green-700 text-sm mt-1">Feedback: {existingSubmission.feedback}</p>}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-medium">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>}

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Your Answer</h3>
          <RichTextEditor content={content} onChange={setContent} placeholder="Type your answer here..." />
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Upload File (optional)</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-brand-400 transition-colors">
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.rtf,.odt" onChange={(e) => setFile(e.target.files[0])} className="hidden" />
            {file ? (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-xs text-red-600 hover:text-red-700 mt-2">
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-brand-600 hover:text-brand-700 font-medium text-sm">
                  Click to upload
                </button>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX, DOC, TXT, RTF, ODT (max 10MB)</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Submitting...' : existingSubmission ? 'Update Submission' : 'Submit Assignment'}
          </button>
          <button type="button" onClick={() => navigate('/student')} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </motion.div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}
