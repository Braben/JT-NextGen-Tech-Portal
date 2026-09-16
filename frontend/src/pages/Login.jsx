import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import { Eye, EyeOff, Sparkles, ShieldCheck, Users, BookOpen, ArrowRight, Zap, GraduationCap, Layers, Mail, Lock } from 'lucide-react';

export default function Login() {
  const demoCredentialsAvailable = Boolean(
    import.meta.env.VITE_DEMO_ADMIN_EMAIL &&
    import.meta.env.VITE_DEMO_INSTRUCTOR_EMAIL &&
    import.meta.env.VITE_DEMO_STUDENT_EMAIL &&
    import.meta.env.VITE_DEMO_PASSWORD
  );
  const showDemoAccess = demoCredentialsAvailable && (import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      const r = data.user.role;
      navigate(r === 'admin' ? '/admin' : r === 'instructor' ? '/instructor' : '/student');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    const map = {
      admin: import.meta.env.VITE_DEMO_ADMIN_EMAIL,
      instructor: import.meta.env.VITE_DEMO_INSTRUCTOR_EMAIL,
      student: import.meta.env.VITE_DEMO_STUDENT_EMAIL,
    };
    setEmail(map[role]);
    setPassword(import.meta.env.VITE_DEMO_PASSWORD || '');
  };

  return (
    <div className="min-h-screen flex bg-core relative overflow-hidden selection:bg-brand-500/30">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-core" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
        <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.08, 1] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }} className="absolute -top-32 -left-32 w-[580px] h-[580px] bg-brand-600/25 rounded-full blur-[110px]" />
        <motion.div animate={{ x: [0, -25, 0], y: [0, 18, 0], scale: [1, 1.1, 1] }} transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 1 }} className="absolute top-[18%] -right-40 w-[620px] h-[620px] bg-emerald-500/15 rounded-full blur-[120px]" />
        <motion.div animate={{ x: [0, 18, 0], y: [0, -14, 0] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }} className="absolute bottom-0 left-[22%] w-[760px] h-[480px] bg-navy-700/30 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-core via-transparent to-transparent" />
      </div>

      <div className="relative z-10 flex w-full min-h-screen">
        <div className="hidden lg:flex lg:w-[54%] flex-col justify-between p-10 xl:p-14">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex items-center gap-3">
            <BrandLogo className="w-56" />
          </motion.div>

          <div className="max-w-[560px]">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur text-xs text-white/80 mb-7">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Cohort 2025 now open — limited seats
              <span className="hidden xl:inline-flex items-center gap-1 ml-1 text-white/60">Apply today <ArrowRight className="w-3 h-3" /></span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.6 }} className="text-[42px] xl:text-[52px] font-black tracking-[-0.03em] leading-[0.95] text-white">
              Shape your<br />
              <span className="bg-gradient-to-r from-brand-400 via-emerald-300 to-brand-500 bg-clip-text text-transparent">future</span> with<br />
              code & creativity.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className="text-[15px] leading-6 text-white/60 mt-5 max-w-[480px]">
              Industry-led programs, hands-on projects, and mentorship that gets you hired. Join 12,000+ learners building the next generation of tech talent.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.6 }} className="grid grid-cols-3 gap-3 mt-9">
              {[
                { icon: BookOpen, title: '12 Programs', sub: 'Beginner → Advanced' },
                { icon: Users, title: '4.9/5 Rating', sub: 'From 3k reviews' },
                { icon: ShieldCheck, title: 'Certificate', sub: 'Verified & shareable' },
              ].map((f) => (
                <div key={f.title} className="rounded-2xl bg-white/[0.06] border border-white/[0.08] backdrop-blur p-4">
                  <f.icon className="w-5 h-5 text-brand-400 mb-3" />
                  <div className="text-sm font-semibold text-white leading-none">{f.title}</div>
                  <div className="text-xs text-white/50 mt-1">{f.sub}</div>
                </div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }} className="mt-8 flex items-center gap-5 text-xs text-white/45">
              <div className="flex -space-x-2">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="w-7 h-7 rounded-full bg-navy-800 border-2 border-[#070F1F] flex items-center justify-center text-[10px] font-bold text-white/70">{String.fromCharCode(64+i)}</div>
                ))}
              </div>
              <span>Trusted by 500+ hiring partners</span>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-xs text-white/30">
            © 2025 JT NextGen • Crafted for the next generation of builders
          </motion.div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, ease: [0.22,1,0.36,1] }} className="w-full max-w-[420px]">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
              <BrandLogo className="w-48" />
            </div>

            <div className="relative">
              <div className="absolute -inset-[1px] rounded-[26px] bg-gradient-to-br from-brand-500/30 via-white/10 to-transparent opacity-60 blur-[0.5px]" />
              <div className="relative rounded-[24px] bg-surface backdrop-blur-xl border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.35),0_1px_0_rgba(255,255,255,0.6)_inset] overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-70" />
                <div className="absolute -top-24 -right-24 w-56 h-56 bg-brand-500/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-emerald-500/10 rounded-full blur-2xl" />

                <div className="relative p-7 sm:p-8">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-[11px] font-semibold tracking-wide text-brand-700">
                        <Sparkles className="w-3 h-3" /> WELCOME BACK
                      </div>
                      <h1 className="text-[22px] font-black tracking-tight text-gray-900 mt-3 leading-none">Sign in to your account</h1>
                      <p className="text-[13px] text-gray-500 mt-1.5">Enter your credentials to continue</p>
                    </div>
                    <div className="hidden sm:flex w-10 h-10 rounded-xl bg-gray-900 text-white items-center justify-center shrink-0">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="mb-4 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] leading-4 text-red-700">
                        <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 text-xs font-bold">!</span>
                        <span className="py-0.5">{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-[12px] font-semibold tracking-wide text-gray-700 mb-1.5 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> EMAIL</label>
                      <div className={`group relative rounded-xl border bg-white transition-all ${focused==='email' ? 'border-brand-500 ring-4 ring-brand-500/10' : 'border-gray-200 hover:border-gray-300'} ${error && !email ? 'border-red-300' : ''}`}>
                        <input type="email" value={email} onFocus={()=>setFocused('email')} onBlur={()=>setFocused(null)} onChange={(e)=>setEmail(e.target.value)} placeholder="you@jtnextgen.com" required className="w-full bg-transparent px-3.5 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[12px] font-semibold tracking-wide text-gray-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-gray-400" /> PASSWORD</label>
                        <button type="button" onClick={()=>setShowPassword(!showPassword)} className="text-[12px] font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1">
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <div className={`group relative rounded-xl border bg-white transition-all ${focused==='password' ? 'border-brand-500 ring-4 ring-brand-500/10' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type={showPassword ? 'text' : 'password'} value={password} onFocus={()=>setFocused('password')} onBlur={()=>setFocused(null)} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" required className="w-full bg-transparent px-3.5 py-3 pr-10 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none" />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"><Lock className="w-4 h-4" /></span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-[12px] text-gray-600 cursor-pointer select-none">
                          <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" /> Remember me
                        </label>
                        <Link to="/forgot-password" className="text-[12px] font-medium text-gray-500 hover:text-brand-700">Forgot password?</Link>
                      </div>
                    </div>

                    <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }} className="relative w-full overflow-hidden rounded-xl bg-gray-900 hover:bg-black text-white font-semibold py-3.5 text-[14px] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-black/10">
                      <span className="absolute inset-0 bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-500 opacity-0 hover:opacity-100 transition-opacity" />
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      <span className="relative flex items-center gap-2">
                        {loading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Signing in…
                          </>
                        ) : (
                          <>
                            Sign In <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </span>
                    </motion.button>
                  </form>

                  {showDemoAccess && <div className="mt-6">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
                      <span className="relative bg-white px-3 text-[11px] font-semibold tracking-widest text-gray-400">OR CONTINUE WITH DEMO</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 mt-4">
                      {[
                        { id: 'admin', label: 'Admin', sub: 'Full access', color: 'from-violet-500 to-fuchsia-500' },
                        { id: 'instructor', label: 'Instructor', sub: 'Teach & grade', color: 'from-brand-500 to-emerald-500' },
                        { id: 'student', label: 'Student', sub: 'Learn & submit', color: 'from-sky-500 to-indigo-500' },
                      ].map((r) => (
                        <button key={r.id} onClick={()=>fillDemo(r.id)} className="group relative rounded-2xl border border-gray-100 bg-page hover:bg-white hover:border-gray-200 hover:shadow-md p-3 text-left transition-all">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${r.color} flex items-center justify-center text-white shadow-sm`}>
                            {r.id==='admin' ? <ShieldCheck className="w-4 h-4" /> : r.id==='instructor' ? <Layers className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                          </div>
                          <div className="text-[12px] font-bold text-gray-900 mt-2 leading-none">{r.label}</div>
                          <div className="text-[11px] text-gray-500">{r.sub}</div>
                          <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                    <p className="text-center text-[11px] text-gray-400 mt-3">Demo access is controlled by environment configuration.</p>
                  </div>}

                  <p className="text-center text-[13px] text-gray-500 mt-6">
                    Don&apos;t have an account? <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1">Create one <ArrowRight className="w-3.5 h-3.5" /></Link>
                  </p>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />
                <div className="px-7 sm:px-8 py-3.5 flex items-center justify-center gap-2 text-[11px] text-gray-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Encrypted & secure • SSO ready
                </div>
              </div>
            </div>

            <p className="text-center text-[11px] text-white/30 mt-4">By signing in you agree to our Terms & Privacy Policy</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
