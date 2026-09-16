import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, MapPin, Phone, Send, ShieldCheck, CheckCircle2, MessageCircle } from 'lucide-react';
import { adminAPI } from '../../api';

const contactMethods = [
  { icon: MapPin, label: 'Visit Us', value: 'Manya Kpongunor, Odumase Krobo', detail: 'Off Kpongunor Salem Road' },
  { icon: Phone, label: 'Call Us', value: '+233 543 946 424', detail: 'Admissions and program enquiries' },
  { icon: Mail, label: 'Email Us', value: 'info@nextgentechhub.com', detail: 'We usually reply within one business day' },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { document.title = 'Contact Us | JT NextGen Tech Hub'; }, []);

  const update = (field) => (event) => {
    setSent(false);
    setError('');
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminAPI.submitContact(form);
      setSent(true);
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send your message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-page">
      <div className="bg-core text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-300" />
              Talk to admissions
            </div>
            <h1 className="mt-5 text-[34px] sm:text-[46px] font-extrabold leading-tight tracking-tight">Get the right program guidance before you enroll.</h1>
            <p className="mt-4 max-w-2xl text-sm sm:text-base leading-7 text-white/65">
              Ask about programs, schedules, fees, certificates, or the best path for your current skill level.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-16">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
          <div className="accent-card rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-navy-900">Contact Information</h2>
            <p className="mt-1 text-sm text-gray-500">Choose the channel that works best for you.</p>

            <div className="mt-6 space-y-4">
              {contactMethods.map((item) => (
                <div key={item.label} className="accent-card flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-navy-900">{item.value}</p>
                    <p className="text-xs text-gray-500">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="https://wa.me/233543946424?text=Hello%20JT%20NextGen%20Tech%20Hub,%20I%20would%20like%20to%20make%20an%20enquiry."
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <MessageCircle className="h-4 w-4" />
              Chat on WhatsApp
            </a>
          </div>

          <div className="accent-card rounded-2xl border border-gray-100 bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-navy-900">Send a Message</h2>
                <p className="mt-1 text-sm text-gray-500">We will use this to follow up with you directly.</p>
              </div>
              <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-white">
                <Send className="h-5 w-5" />
              </div>
            </div>

            <AnimatePresence>
              {sent && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  Message sent. We will get back to you shortly.
                </motion.div>
              )}
              {error && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Full Name</span>
                <input type="text" value={form.name} onChange={update('name')} required autoComplete="name" className="mt-1.5 input-field bg-white text-gray-900" placeholder="Your name" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</span>
                <input type="email" value={form.email} onChange={update('email')} required autoComplete="email" className="mt-1.5 input-field bg-white text-gray-900" placeholder="you@example.com" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</span>
                <input type="tel" value={form.phone} onChange={update('phone')} autoComplete="tel" className="mt-1.5 input-field bg-white text-gray-900" placeholder="+233 24 000 0000" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Message</span>
                <textarea rows={5} value={form.message} onChange={update('message')} required className="mt-1.5 input-field min-h-[140px] resize-y bg-white text-gray-900" placeholder="Tell us what you would like to learn or ask." />
              </label>
              <button type="submit" disabled={loading} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-navy-900 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? 'Sending...' : 'Send Message'}
                <Send className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Your contact details are used only for admissions follow-up.
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
