import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  Layers,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { programAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { educationOptions } from '../../lib/onboardingAssessment';
import { requireList } from '../../api/responseValidation';

const storageKey = 'jtng.registrationDraft.v2';

const initialForm = {
  firstname: '',
  lastname: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  program_id: '',
  session: 'Morning',
  date_of_birth: '',
  gender: '',
  education_level: '',
  computing_experience: '',
  consent: false,
};

const pages = [
  { key: 'account', title: 'Account', description: 'Secure login details', path: '/register/account' },
  { key: 'profile', title: 'Profile', description: 'Program and background', path: '/register/profile' },
  { key: 'review', title: 'Review', description: 'Confirm and submit', path: '/register/review' },
];

const pageFields = {
  account: ['firstname', 'lastname', 'email', 'phone', 'password', 'confirmPassword'],
  profile: ['program_id', 'session', 'date_of_birth', 'gender', 'education_level', 'computing_experience'],
  review: ['consent'],
};

const fieldPage = Object.entries(pageFields).reduce((index, [page, fields]) => {
  fields.forEach((field) => { index[field] = page; });
  return index;
}, {});

const labels = {
  firstname: 'First name',
  lastname: 'Last name',
  email: 'Email',
  phone: 'Phone / WhatsApp',
  password: 'Password',
  confirmPassword: 'Confirm password',
  program_id: 'Program',
  session: 'Session',
  date_of_birth: 'Date of birth',
  gender: 'Gender',
  education_level: 'Highest level of education',
  computing_experience: 'Computing experience',
  consent: 'Consent',
};

function readDraft() {
  try {
    return { ...initialForm, ...(JSON.parse(sessionStorage.getItem(storageKey)) || {}) };
  } catch {
    return initialForm;
  }
}

function normalizeServerField(field) {
  if (!field) return '';
  if (field === 'name') return 'firstname';
  if (field.startsWith('profile.')) return field.replace('profile.', '');
  if (field.startsWith('onboarding.')) return field.replace('onboarding.', '');
  return field;
}

export default function Register() {
  const { page = 'account' } = useParams();
  const navigate = useNavigate();
  const { register } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState('');
  const [form, setForm] = useState(readDraft);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const pageIndex = pages.findIndex((item) => item.key === page);
  const currentPage = pages[pageIndex];
  const selectedProgram = useMemo(() => programs.find((program) => program.id === form.program_id), [programs, form.program_id]);
  const passwordStrength = form.password.length === 0 ? 0 : form.password.length < 6 ? 1 : form.password.length < 9 ? 2 : 3;
  const progress = currentPage ? Math.round(((pageIndex + 1) / pages.length) * 100) : 0;

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true);
    setProgramsError('');
    try {
      const { data } = await programAPI.getAll();
      setPrograms(requireList(data));
      if (!data.length) setProgramsError('No programs are currently available. Please contact admissions.');
    } catch {
      setProgramsError('Programs could not be loaded. Please retry before continuing.');
    } finally {
      setProgramsLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Register | JT NextGen Tech Hub';
    loadPrograms();
  }, [loadPrograms]);

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(form)); } catch { /* Continue when browser storage is unavailable. */ }
  }, [form]);

  if (!currentPage) return <Navigate to="/register/account" replace />;

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError('');
  };

  const setValue = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError('');
  };

  const validatePage = (targetPage = page) => {
    const errors = {};

    if (targetPage === 'account') {
      if (!form.firstname.trim()) errors.firstname = 'First name is required';
      if (!form.lastname.trim()) errors.lastname = 'Last name is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address';
      if (!form.phone.trim()) errors.phone = 'Phone or WhatsApp number is required';
      if (form.password.length < 6) errors.password = 'Password must be at least 6 characters';
      if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    }

    if (targetPage === 'profile') {
      if (!form.program_id) errors.program_id = 'Please select a program';
      else if (programsLoading) errors.program_id = 'Please wait for programs to load';
      else if (programsError) errors.program_id = programsError;
      else if (!selectedProgram) errors.program_id = 'Please select an available program';
      if (!form.session) errors.session = 'Please select a session';
      if (!form.date_of_birth) errors.date_of_birth = 'Date of birth is required';
      if (!form.gender) errors.gender = 'Please select a gender option';
      if (!form.education_level) errors.education_level = 'Highest level of education is required';
      if (!form.computing_experience) errors.computing_experience = 'Please tell us if you have computing experience';
    }

    if (targetPage === 'review' && !form.consent) {
      errors.consent = 'Consent is required to process your application';
    }

    return errors;
  };

  const firstErrorMessage = (errors) => {
    const firstField = Object.values(pageFields).flat().find((field) => errors[field]);
    if (!firstField) return '';
    return `${labels[firstField]}: ${errors[firstField]}`;
  };

  const showValidationErrors = (errors) => {
    const firstField = Object.values(pageFields).flat().find((field) => errors[field]);
    setFieldErrors(errors);
    setError(firstErrorMessage(errors));
    if (firstField && fieldPage[firstField] !== page) navigate(`/register/${fieldPage[firstField]}`);
    return Boolean(firstField);
  };

  const goNext = () => {
    const errors = validatePage(page);
    if (showValidationErrors(errors)) return;
    setFieldErrors({});
    setError('');
    navigate(pages[Math.min(pageIndex + 1, pages.length - 1)].path);
  };

  const goBack = () => {
    setError('');
    navigate(pages[Math.max(pageIndex - 1, 0)].path);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    if (page !== 'review') {
      goNext();
      return;
    }

    // Final submission validates every URL-backed page because the user may
    // arrive directly at /register/review from history or a copied link.
    const errors = pages.reduce((all, item) => ({ ...all, ...validatePage(item.key) }), {});
    if (showValidationErrors(errors)) return;

    setLoading(true);
    setError('');
    setFieldErrors({});
    try {
      await register({
        name: `${form.firstname} ${form.lastname}`.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        program_id: form.program_id,
        session: form.session,
        consent: form.consent,
        profile: {
          date_of_birth: form.date_of_birth,
          gender: form.gender,
          education_level: form.education_level,
          computing_experience: form.computing_experience,
        },
      });
      try { sessionStorage.removeItem(storageKey); } catch { /* Registration already succeeded. */ }
      navigate('/register/submitted', { replace: true, state: { applicationSubmitted: true } });
    } catch (err) {
      const response = err.response?.data || {};
      const serverFieldErrors = Object.entries(response.fieldErrors || {}).reduce((mapped, [field, message]) => {
        const normalized = normalizeServerField(field);
        if (normalized) mapped[normalized] = message;
        return mapped;
      }, {});
      if (Object.keys(serverFieldErrors).length) {
        showValidationErrors(serverFieldErrors);
      } else {
        setError(response.error || (err.code === 'ECONNABORTED' || !err.response
          ? 'We could not confirm your application. Your account may have been created; try signing in before submitting again.'
          : 'Registration failed. Please review the form and try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-core selection:bg-brand-500/30">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(22,163,74,0.14),transparent_42%,rgba(30,64,175,0.14))]" />
        <div className="absolute inset-0 bg-gradient-to-t from-core via-transparent to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <Link to="/home" className="inline-flex w-fit items-center gap-3 text-white">
          <BrandLogo className="w-56" />
        </Link>

        <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.86fr_1.14fr]">
          <aside className="hidden lg:block">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="max-w-[520px]">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Guided application
              </div>
              <h1 className="text-[44px] font-black leading-[0.95] tracking-tight text-white xl:text-[54px]">
                Register first. Take aptitude when admissions recommends it.
              </h1>
              <p className="mt-5 max-w-[470px] text-sm leading-7 text-white/62">
                The application now starts with account, program, session, and learning background. Admins can recommend the aptitude test from enrollment review when it is useful for the applicant.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  ['Less friction', 'Students are not forced into a long essay test before creating an account.'],
                  ['Admin decision point', 'Admissions can recommend aptitude only for the applications that need review.'],
                  ['Clear next step', 'Recommended tests appear later as a separate student task.'],
                ].map(([title, description]) => (
                  <div key={title} className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white"><Check className="h-3.5 w-3.5" /></span>
                    <div>
                      <p className="text-sm font-semibold leading-none text-white">{title}</p>
                      <p className="mt-1 text-xs text-white/50">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </aside>

          <motion.section initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55 }} className="w-full">
            <div className="relative mx-auto max-w-[760px]">
              <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-br from-brand-500/30 via-white/10 to-transparent opacity-70" />
              <div className="accent-card relative overflow-hidden rounded-[26px] border border-white/60 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35),0_1px_0_rgba(255,255,255,0.6)_inset]">
                <div className="border-b border-gray-100 px-5 py-5 sm:px-7">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-brand-700">
                        <Sparkles className="h-3 w-3" /> REGISTRATION
                      </div>
                      <h2 className="mt-3 text-2xl font-black tracking-tight text-ink">{currentPage.title}</h2>
                      <p className="mt-1 text-sm text-gray-500">{currentPage.description}</p>
                    </div>
                    <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-core text-white sm:flex">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {pages.map((item, index) => (
                        <Link
                          key={item.key}
                          to={index <= pageIndex ? item.path : '#'}
                          onClick={(event) => { if (index > pageIndex) event.preventDefault(); }}
                          className={`rounded-xl border px-3 py-2 text-left transition-colors ${index === pageIndex ? 'border-brand-200 bg-brand-50' : index < pageIndex ? 'border-emerald-100 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index <= pageIndex ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                              {index < pageIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-gray-800">{item.title}</p>
                              <p className="truncate text-[11px] text-gray-500">{item.description}</p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <form onSubmit={submit} noValidate className="px-5 py-5 sm:px-7 sm:py-6">
                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-5 text-red-700">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">!</span>
                        <span>{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    <motion.div key={page} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                      {page === 'account' && (
                        <AccountPage form={form} focused={focused} fieldErrors={fieldErrors} passwordStrength={passwordStrength} showPassword={showPassword} showConfirmPassword={showConfirmPassword} setFocused={setFocused} setShowPassword={setShowPassword} setShowConfirmPassword={setShowConfirmPassword} update={update} />
                      )}
                      {page === 'profile' && (
                        <>
                          {programsLoading && <p role="status" className="mb-4 text-sm text-gray-600">Loading programs...</p>}
                          {programsError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{programsError} <button type="button" onClick={loadPrograms} disabled={programsLoading} className="font-semibold underline">Retry</button></div>}
                          <ProfilePage form={form} programs={programs} selectedProgram={selectedProgram} focused={focused} fieldErrors={fieldErrors} setFocused={setFocused} setValue={setValue} update={update} />
                        </>
                      )}
                      {page === 'review' && (
                        <ReviewPage form={form} selectedProgram={selectedProgram} fieldErrors={fieldErrors} update={update} />
                      )}
                    </motion.div>
                  </AnimatePresence>

                  <div className="mt-6 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {pageIndex > 0 && (
                        <button type="button" onClick={goBack} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50">
                          <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                      )}
                    </div>
                    {page !== 'review' ? (
                      <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-core px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
                        Continue <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-core px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <CheckCircle2 className="h-4 w-4" />}
                        Submit Application
                      </button>
                    )}
                  </div>

                  <p className="mt-5 text-center text-[13px] text-gray-500">
                    Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">Sign in</Link>
                  </p>
                </form>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

function AccountPage({ form, focused, fieldErrors, passwordStrength, showPassword, showConfirmPassword, setFocused, setShowPassword, setShowConfirmPassword, update }) {
  return (
    <div className="space-y-4">
      <SectionHeading icon={User} title="Account details" subtitle="Used for secure login and admissions follow-up." />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField icon={User} label="First Name" field="firstname" value={form.firstname} error={fieldErrors.firstname} focused={focused} setFocused={setFocused} update={update} placeholder="Ada" autoComplete="given-name" />
        <TextField icon={User} label="Last Name" field="lastname" value={form.lastname} error={fieldErrors.lastname} focused={focused} setFocused={setFocused} update={update} placeholder="Lovelace" autoComplete="family-name" />
      </div>
      <TextField icon={Mail} label="Email" field="email" type="email" value={form.email} error={fieldErrors.email} focused={focused} setFocused={setFocused} update={update} placeholder="ada@example.com" autoComplete="email" />
      <TextField icon={Phone} label="Phone / WhatsApp" field="phone" type="tel" value={form.phone} error={fieldErrors.phone} focused={focused} setFocused={setFocused} update={update} placeholder="+233 24 000 0000" autoComplete="tel" />
      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordField label="Password" value={form.password} error={fieldErrors.password} focused={focused} field="password" visible={showPassword} setVisible={setShowPassword} setFocused={setFocused} update={update} />
        <PasswordField label="Confirm Password" value={form.confirmPassword} error={fieldErrors.confirmPassword} focused={focused} field="confirmPassword" visible={showConfirmPassword} setVisible={setShowConfirmPassword} setFocused={setFocused} update={update} />
      </div>
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((item) => (
          <div key={item} className={`h-1.5 flex-1 rounded-full transition-colors ${passwordStrength >= item ? (passwordStrength === 1 ? 'bg-red-400' : passwordStrength === 2 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-gray-100'}`} />
        ))}
        <span className="w-12 text-right text-[11px] text-gray-400">{passwordStrength === 0 ? '' : passwordStrength === 1 ? 'Weak' : passwordStrength === 2 ? 'Good' : 'Strong'}</span>
      </div>
    </div>
  );
}

function ProfilePage({ form, programs, selectedProgram, focused, fieldErrors, setFocused, setValue, update }) {
  return (
    <div className="space-y-4">
      <SectionHeading icon={Layers} title="Program and background" subtitle="This intake helps admissions understand the applicant before any aptitude recommendation." />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <FieldLabel icon={BookOpen}>Program</FieldLabel>
          <div className={`rounded-xl border bg-white px-2 py-1 transition-all ${fieldErrors.program_id ? 'border-red-300 ring-4 ring-red-500/10' : focused === 'program_id' ? 'border-brand-500 ring-4 ring-brand-500/10' : 'border-gray-200 hover:border-gray-300'}`}>
            <select value={form.program_id} onFocus={() => setFocused('program_id')} onBlur={() => setFocused(null)} onChange={update('program_id')} aria-invalid={Boolean(fieldErrors.program_id)} className="w-full bg-transparent px-2 py-2.5 text-sm text-ink outline-none">
              <option value="">Select program</option>
              {programs.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}
            </select>
          </div>
          <FieldError message={fieldErrors.program_id} />
        </label>
        <label className="block">
          <FieldLabel icon={Clock}>Session</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {['Morning', 'Evening'].map((session) => (
              <button key={session} type="button" onClick={() => setValue('session', session)} className={`rounded-xl border py-3 text-sm font-semibold transition-all ${form.session === session ? 'border-core bg-core text-white shadow' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}>
                {session}
              </button>
            ))}
          </div>
          <FieldError message={fieldErrors.session} />
        </label>
      </div>

      {selectedProgram && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <p className="font-semibold">{selectedProgram.title}</p>
          <p className="mt-1 text-xs leading-5 text-brand-800 dark:text-brand-300">{selectedProgram.duration || '3 Months'} - {selectedProgram.level || 'Beginner'} - {selectedProgram.audience || 'Open to motivated learners'}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Date of Birth" field="date_of_birth" type="date" value={form.date_of_birth} error={fieldErrors.date_of_birth} focused={focused} setFocused={setFocused} update={update} />
        <label className="block">
          <FieldLabel icon={GraduationCap}>Highest Level of Education</FieldLabel>
          <div className={`rounded-xl border bg-white px-2 py-1 transition-all ${fieldErrors.education_level ? 'border-red-300 ring-4 ring-red-500/10' : focused === 'education_level' ? 'border-brand-500 ring-4 ring-brand-500/10' : 'border-gray-200 hover:border-gray-300'}`}>
            <select value={form.education_level} onFocus={() => setFocused('education_level')} onBlur={() => setFocused(null)} onChange={update('education_level')} aria-invalid={Boolean(fieldErrors.education_level)} className="w-full bg-transparent px-2 py-2.5 text-sm text-ink outline-none">
              <option value="">Select education level</option>
              {educationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <FieldError message={fieldErrors.education_level} />
        </label>
      </div>

      <ChoiceGroup label="Gender" value={form.gender} error={fieldErrors.gender} options={['Male', 'Female', 'Prefer not to say']} onChange={(gender) => setValue('gender', gender)} />
      <ChoiceGroup label="Do you have any experience in computing?" value={form.computing_experience} error={fieldErrors.computing_experience} options={['Yes', 'No']} onChange={(computing_experience) => setValue('computing_experience', computing_experience)} />
    </div>
  );
}

function ReviewPage({ form, selectedProgram, fieldErrors, update }) {
  return (
    <div className="space-y-4">
      <SectionHeading icon={ShieldCheck} title="Review application" subtitle="Aptitude is not part of public signup. Admins can recommend it after reviewing this application." />
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryItem label="Name" value={`${form.firstname} ${form.lastname}`.trim() || 'Not supplied'} />
        <SummaryItem label="Email" value={form.email || 'Not supplied'} />
        <SummaryItem label="Phone" value={form.phone || 'Not supplied'} />
        <SummaryItem label="Program" value={selectedProgram?.title || 'Not supplied'} />
        <SummaryItem label="Session" value={form.session || 'Not supplied'} />
        <SummaryItem label="Education" value={form.education_level || 'Not supplied'} />
        <SummaryItem label="Computing Experience" value={form.computing_experience || 'Not supplied'} />
        <SummaryItem label="Date of Birth" value={form.date_of_birth || 'Not supplied'} />
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        After submission, your enrollment stays pending. Admissions may recommend an aptitude test from the admin dashboard, and you will receive a notification if it is needed.
      </div>
      <label className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${fieldErrors.consent ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
        <input type="checkbox" checked={form.consent} onChange={update('consent')} aria-invalid={Boolean(fieldErrors.consent)} className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
        <span className="text-sm leading-6 text-gray-600">
          I consent to the collection and processing of my personal data for evaluating my application and preferred program.
        </span>
      </label>
      <FieldError message={fieldErrors.consent} />
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-core text-white">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-base font-bold text-ink">{title}</h3>
        <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function FieldLabel({ icon: Icon, children }) {
  return (
    <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-700">
      {Icon && <Icon className="h-3 w-3 text-gray-400" />}
      {children}
    </span>
  );
}

function FieldError({ id, message }) {
  if (!message) return null;
  return <span id={id} className="mt-1 block text-xs font-medium leading-5 text-red-600">{message}</span>;
}

function TextField({ icon, label, field, value, error, focused, setFocused, update, type = 'text', placeholder = '', autoComplete }) {
  const errorId = `${field}-error`;
  return (
    <label className="block">
      <FieldLabel icon={icon}>{label}</FieldLabel>
      <div className={`rounded-xl border bg-white transition-all ${error ? 'border-red-300 ring-4 ring-red-500/10' : focused === field ? 'border-brand-500 ring-4 ring-brand-500/10' : 'border-gray-200 hover:border-gray-300'}`}>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onFocus={() => setFocused(field)}
          onBlur={() => setFocused(null)}
          onChange={update(field)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="w-full bg-transparent px-3.5 py-3 text-sm text-ink outline-none placeholder:text-gray-400"
        />
      </div>
      <FieldError id={errorId} message={error} />
    </label>
  );
}

function PasswordField({ label, field, value, error, focused, visible, setVisible, setFocused, update }) {
  const errorId = `${field}-error`;
  return (
    <label className="block">
      <FieldLabel icon={Lock}>{label}</FieldLabel>
      <div className={`relative rounded-xl border bg-white transition-all ${error ? 'border-red-300 ring-4 ring-red-500/10' : focused === field ? 'border-brand-500 ring-4 ring-brand-500/10' : 'border-gray-200 hover:border-gray-300'}`}>
        <input
          type={visible ? 'text' : 'password'}
          placeholder="Min 6 characters"
          value={value}
          onFocus={() => setFocused(field)}
          onBlur={() => setFocused(null)}
          onChange={update(field)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="w-full bg-transparent px-3.5 py-3 pr-10 text-sm text-ink outline-none placeholder:text-gray-400"
        />
        <button type="button" onClick={() => setVisible((current) => !current)} className="absolute right-3 top-1/2 -trangray-y-1/2 text-gray-400 hover:text-gray-600" aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FieldError id={errorId} message={error} />
    </label>
  );
}

function ChoiceGroup({ label, value, error, options, onChange }) {
  return (
    <fieldset aria-invalid={Boolean(error)}>
      <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-700">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button key={option} type="button" onClick={() => onChange(option)} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${value === option ? 'border-brand-600 bg-brand-50 text-brand-800' : error ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
            {option}
          </button>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}
import BrandLogo from '../../components/BrandLogo';
