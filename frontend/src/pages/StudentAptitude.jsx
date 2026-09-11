import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, Clock, Send } from 'lucide-react';
import { onboardingAPI } from '../api';
import { aptitudeFields } from '../lib/onboardingAssessment';
import { useToast } from '../context/ToastContext';

const initialAnswers = {
  strengths: '',
  greatest_strength: '',
  weaknesses: '',
  weakness_response: '',
  improvement_plan: '',
  consent: false,
};

export default function StudentAptitude() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assessments, setAssessments] = useState([]);
  const [answers, setAnswers] = useState(initialAnswers);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAssessments();
  }, []);

  const openAssessment = useMemo(() => {
    const selected = assessments.find((item) => item.id === assessmentId);
    if (selected) return selected;
    return assessments.find((item) => ['recommended', 'needs_followup'].includes(item.status));
  }, [assessments, assessmentId]);

  useEffect(() => {
    if (!openAssessment) return;
    setAnswers({
      strengths: openAssessment.strengths || '',
      greatest_strength: openAssessment.greatest_strength || '',
      weaknesses: openAssessment.weaknesses || '',
      weakness_response: openAssessment.weakness_response || '',
      improvement_plan: openAssessment.improvement_plan || '',
      consent: false,
    });
  }, [openAssessment?.id]);

  const loadAssessments = async () => {
    setLoading(true);
    try {
      const res = await onboardingAPI.my();
      setAssessments(res.data || []);
    } catch {
      setError('Failed to load aptitude assessments');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setAnswers((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError('');
  };

  const validate = () => {
    const errors = {};
    aptitudeFields.forEach((item) => {
      if (answers[item.name].trim().length < 20) {
        errors[item.name] = `${item.label} needs a more complete answer of at least 20 characters`;
      }
    });
    if (!answers.consent) errors.consent = 'Consent is required to submit your aptitude assessment';
    return errors;
  };

  const showErrors = (errors) => {
    const firstField = [...aptitudeFields.map((item) => item.name), 'consent'].find((field) => errors[field]);
    setFieldErrors(errors);
    setError(firstField ? errors[firstField] : '');
    return Boolean(firstField);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!openAssessment) return;
    const errors = validate();
    if (showErrors(errors)) return;

    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      await onboardingAPI.submit(openAssessment.id, answers);
      toast('Aptitude assessment submitted for admin review', 'success');
      navigate('/student');
    } catch (err) {
      const response = err.response?.data || {};
      if (response.fieldErrors) {
        showErrors(response.fieldErrors);
      } else {
        setError(response.error || 'Failed to submit aptitude assessment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="card">Loading aptitude assessments...</div>;
  }

  if (!openAssessment) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Aptitude Assessment</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">No aptitude test has been recommended for you right now.</p>
        </div>
        <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">You are all set for now.</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Admissions will notify you here if an aptitude test is needed.</p>
          </div>
          <Link to="/student" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const isClosed = !['recommended', 'needs_followup'].includes(openAssessment.status);

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Aptitude Assessment</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {openAssessment.program_title || 'Admissions'} recommended this test as part of your application review.
          </p>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${openAssessment.status === 'needs_followup' ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-700'}`}>
          <Clock className="h-3.5 w-3.5" /> {openAssessment.status === 'needs_followup' ? 'Follow-up requested' : 'Recommended'}
        </span>
      </div>

      <div className="card">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Candidate readiness questions</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Answer honestly. Admins review this for admissions readiness, not course grading.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-5">
          {aptitudeFields.map((item) => (
            <label key={item.name} className="block">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{item.hint}</span>
              <textarea
                rows={4}
                value={answers[item.name]}
                onChange={update(item.name)}
                maxLength={1200}
                disabled={isClosed || submitting}
                aria-invalid={Boolean(fieldErrors[item.name])}
                placeholder={item.placeholder}
                className={`mt-2 min-h-[118px] w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm leading-6 text-gray-900 outline-none transition-colors placeholder:text-gray-400 dark:bg-gray-800 dark:text-white ${fieldErrors[item.name] ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-500/10' : 'border-gray-200 dark:border-gray-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10'}`}
              />
              <div className="mt-1 flex items-start justify-between gap-3">
                <FieldError message={fieldErrors[item.name]} />
                <span className={`shrink-0 text-xs ${answers[item.name].trim().length < 20 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {answers[item.name].trim().length}/20 min
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className={`card border ${fieldErrors.consent ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : 'border-transparent'}`}>
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={answers.consent} onChange={update('consent')} disabled={isClosed || submitting} className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
          <span className="text-sm leading-6 text-gray-600 dark:text-gray-300">
            I confirm these responses are my own and consent to their use for admissions readiness review.
          </span>
        </label>
        <FieldError message={fieldErrors.consent} />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isClosed || submitting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Send className="h-4 w-4" />}
          Submit for Review
        </button>
      </div>
    </form>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <span className="text-xs font-medium text-red-600">{message}</span>;
}
