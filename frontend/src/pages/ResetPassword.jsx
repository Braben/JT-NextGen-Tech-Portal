import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../api';
import { Lock, Eye, EyeOff, ArrowRight, Sparkles, ShieldCheck, Check } from 'lucide-react';

export default function ResetPassword() {
  const [search] = useSearchParams();
  const tokenFromUrl = search.get('token') || '';
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword({ token, new_password: password });
      setSuccess('Password reset successfully. Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-core relative overflow-hidden selection:bg-brand-500/30">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-core" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
        <motion.div animate={{ x: [0,28,0], y: [0,-18,0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }} className="absolute -top-32 -left-32 w-[580px] h-[580px] bg-brand-600/25 rounded-full blur-[110px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-core via-transparent to-transparent" />
      </div>
      <div className="relative z-10 flex w-full min-h-screen items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55 }} className="w-full max-w-[420px]">
          <div className="relative">
            <div className="absolute -inset-[1px] rounded-[26px] bg-gradient-to-br from-brand-500/30 via-white/10 to-transparent opacity-60" />
            <div className="accent-card relative rounded-[24px] bg-surface backdrop-blur-xl border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.35)] overflow-hidden">
              <div className="p-7 sm:p-8">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-[11px] font-semibold tracking-wide text-brand-700"><Sparkles className="w-3 h-3" /> RESET PASSWORD</div>
                <h1 className="text-[22px] font-black tracking-tight text-gray-900 mt-3 leading-none">Set new password</h1>
                <p className="text-[13px] text-gray-500 mt-1.5">Enter your reset token and new password</p>

                {error && <div className="mt-4 px-3.5 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700">{error}</div>}
                {success && <div className="mt-4 px-3.5 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[13px] text-emerald-700 flex items-center gap-2"><Check className="w-4 h-4" /> {success}</div>}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="text-[12px] font-semibold tracking-wide text-gray-700 mb-1.5">RESET TOKEN</label>
                    <input type="text" value={token} onChange={(e)=> setToken(e.target.value)} placeholder="Paste token from email" required className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-[13px] font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10" />
                    <p className="text-[11px] text-gray-400 mt-1">Check server logs in dev mode for token</p>
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold tracking-wide text-gray-700 mb-1.5 flex items-center justify-between"><span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-gray-400" /> NEW PASSWORD</span><button type="button" onClick={()=> setShow(!show)} className="text-[11px] font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1">{show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {show ? 'Hide' : 'Show'}</button></label>
                    <input type={show ? 'text' : 'password'} value={password} onChange={(e)=> setPassword(e.target.value)} placeholder="••••••••" required className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10" />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold tracking-wide text-gray-700 mb-1.5">CONFIRM PASSWORD</label>
                    <input type={show ? 'text' : 'password'} value={confirm} onChange={(e)=> setConfirm(e.target.value)} placeholder="••••••••" required className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10" />
                  </div>
                  <button type="submit" disabled={loading} className="w-full rounded-xl bg-gray-900 hover:bg-black text-white font-semibold py-3.5 text-[14px] flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Resetting…</> : <>Reset password <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-6"><Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">Back to login</Link></p>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />
              <div className="px-7 py-3.5 flex items-center justify-center gap-2 text-[11px] text-gray-400"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Link expires in 15 minutes</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
