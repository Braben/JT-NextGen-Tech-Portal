import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../api';
import { Mail, ArrowRight, ArrowLeft, ShieldCheck, Sparkles, Check } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [devInfo, setDevInfo] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage(''); setDevInfo(null);
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword({ email });
      setMessage(res.data.message || 'If that email exists, a reset link has been sent');
      if (res.data.token) setDevInfo(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request reset');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-core relative overflow-hidden selection:bg-brand-500/30">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-core" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
        <motion.div animate={{ x: [0,28,0], y: [0,-18,0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }} className="absolute -top-32 -left-32 w-[580px] h-[580px] bg-brand-600/25 rounded-full blur-[110px]" />
        <motion.div animate={{ x: [0,-24,0], y: [0,16,0] }} transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 1 }} className="absolute top-[18%] -right-40 w-[620px] h-[620px] bg-emerald-500/15 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-core via-transparent to-transparent" />
      </div>
      <div className="relative z-10 flex w-full min-h-screen items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, ease: [0.22,1,0.36,1] }} className="w-full max-w-[420px]">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center"><span className="text-white font-black">JT</span></div>
            <span className="text-white font-semibold">JT NextGen</span>
          </div>
          <div className="relative">
            <div className="absolute -inset-[1px] rounded-[26px] bg-gradient-to-br from-brand-500/30 via-white/10 to-transparent opacity-60" />
            <div className="relative rounded-[24px] bg-surface backdrop-blur-xl border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.35)] overflow-hidden">
              <div className="p-7 sm:p-8">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-[11px] font-semibold tracking-wide text-brand-700"><Sparkles className="w-3 h-3" /> FORGOT PASSWORD</div>
                <h1 className="text-[22px] font-black tracking-tight text-gray-900 mt-3 leading-none">Reset your password</h1>
                <p className="text-[13px] text-gray-500 mt-1.5">Enter your email to receive a reset link</p>

                {error && <div className="mt-4 px-3.5 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700">{error}</div>}
                {message && <div className="mt-4 px-3.5 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[13px] text-emerald-700 flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" /> <span>{message}</span></div>}
                {devInfo?.resetUrl && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                    <div className="font-semibold text-amber-800">Dev mode — reset link:</div>
                    <a href={devInfo.resetUrl} className="text-brand-700 hover:underline break-all">{devInfo.resetUrl}</a>
                    <div className="mt-1 text-[11px] text-amber-700">Token: {devInfo.token.slice(0,16)}… (expires 15m)</div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="text-[12px] font-semibold tracking-wide text-gray-700 mb-1.5 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> EMAIL</label>
                    <input type="email" value={email} onChange={(e)=> setEmail(e.target.value)} placeholder="you@jtnextgen.com" required className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all" />
                  </div>
                  <button type="submit" disabled={loading} className="w-full rounded-xl bg-gray-900 hover:bg-black text-white font-semibold py-3.5 text-[14px] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</> : <>Send reset link <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>

                <div className="mt-6 flex items-center justify-between text-sm">
                  <Link to="/login" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back to login</Link>
                  <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800">Create account</Link>
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />
              <div className="px-7 py-3.5 flex items-center justify-center gap-2 text-[11px] text-gray-400"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secure • Link expires in 15 minutes</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
