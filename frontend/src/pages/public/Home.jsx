import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { programAPI, blogAPI, eventAPI } from '../../api';
import { ArrowRight, Sparkles, Check, ShieldCheck, Clock, Award, Users, BookOpen, Target, Lightbulb, Eye, GraduationCap, Play, Quote, ChevronLeft, ChevronRight, Calendar, MapPin, Search, Star, Zap, Layers, ChevronDown } from 'lucide-react';
import api from '../../api';
import { requireList } from '../../api/responseValidation';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] } }),
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const fallbackTestimonials = [
  { name: 'Michael Owusu', role: 'Web Development · Cohort 2024', message: 'From zero to building real-world apps in 3 months. The mentors push you to ship, not just watch tutorials.', avatar: 'MO' },
  { name: 'Ama Serwaa', role: 'Design · Brand Studio', message: 'I can now deliver paid branding work. Practical, project-based — exactly what the industry needs.', avatar: 'AS' },
  { name: 'Yaw Boateng', role: 'Digital Skills · Entrepreneur', message: 'Transformed how I run my business — from sheets to automation. Zero to confident in one cohort.', avatar: 'YB' },
];

const faqs = [
  { q: 'Who can enroll?', a: 'JHS/SHS graduates, tertiary students, job seekers and anyone hungry for practical digital skills — no gatekeeping.' },
  { q: 'How long is a program?', a: '3 months of hands-on, project-based training with mentor reviews every week.' },
  { q: 'Morning or evening?', a: 'Both. Choose the session that fits your schedule — same curriculum, same certificate.' },
  { q: 'Will I get a certificate?', a: 'Yes — a verified Certificate of Competency, shareable on LinkedIn and verifiable via QR.' },
  { q: 'Do I need prior knowledge?', a: 'No for beginner tracks. We start from fundamentals and layer up to portfolio-grade projects.' },
  { q: 'Where are you located?', a: 'Kpongunor hub + hybrid support — serving surrounding communities with on-site labs.' },
];

const stats = [
  { k: '12+', v: 'Programs', sub: 'Beginner → Advanced' },
  { k: '500+', v: 'Hiring partners', sub: 'Internships & roles' },
  { k: '4.9/5', v: 'Avg rating', sub: '3k+ reviews' },
  { k: '12k+', v: 'Alumni', sub: 'Building globally' },
];

const heroLabImage = 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80';

export default function Home() {
  const [programs, setPrograms] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [contentError, setContentError] = useState(false);
  const [testimonials, setTestimonials] = useState(fallbackTestimonials);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const onError = () => setContentError(true);
    programAPI.getAll().then((r) => setPrograms(requireList(r.data).slice(0, 6))).catch(onError);
    blogAPI.getAll().then((r) => setBlogs(requireList(r.data).slice(0, 3))).catch(onError);
    eventAPI.getPublic().then((r) => setEvents(requireList(r.data))).catch(onError);
    api.get('/testimonials').then((r) => {
      const rows = requireList(r.data);
      if (rows.length) {
        setTestimonials(rows.map(t => ({
          name: t.name,
          role: t.role,
          message: t.message,
          avatar: (t.name || 'U').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase(),
        })));
      }
    }).catch(() => {});
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="relative left-1/2 right-1/2 -mx-[50vw] w-screen -mt-6">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap'); h1,h2,h3{font-family:'Plus Jakarta Sans',Inter,sans-serif} body{font-family:Inter,sans-serif}`}</style>
      <motion.div style={{ scaleX }} className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-600 via-emerald-400 to-brand-600 origin-left z-[60] pointer-events-none" />
      <Hero />
      {contentError && <div role="alert" className="mx-auto max-w-7xl px-6 py-4 text-center text-red-700">Some content could not be loaded. Please try again later.</div>}
      <TrustBar />
      <ProgramsSection programs={programs} />
      <ValueSection />
      <EventsSection events={events} />
      <BlogSection blogs={blogs} />
      <TestimonialsSection testimonials={testimonials} />
      <FAQSection />
      <CTASection />
    </motion.div>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const yBlob = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacityHero = useTransform(scrollYProgress, [0, 0.8], [1, 0.92]);
  return (
    <motion.section ref={ref} style={{ opacity: opacityHero }} className="relative overflow-hidden bg-[#070F1F] text-white">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[#070F1F]" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
        {!reduce && (
          <>
            <motion.div style={{ y: yBlob }} animate={{ x: [0,28,0], y: [0,-18,0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} className="absolute -top-40 -left-32 w-[640px] h-[640px] bg-brand-600/25 rounded-full blur-[110px]" />
            <motion.div style={{ y: useTransform(scrollYProgress, [0,1], [0, -60]) }} animate={{ x: [0,-24,0], y: [0,16,0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }} className="absolute top-[18%] -right-40 w-[680px] h-[680px] bg-emerald-500/14 rounded-full blur-[120px]" />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#070F1F]/60" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-10 sm:pt-14 sm:pb-14 lg:pt-16 lg:pb-16">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-8 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur text-xs text-white/85">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Welcome to JT NextGen Tech Hub
              <span className="hidden sm:inline-flex items-center gap-1 text-white/60">Enrollment open <ArrowRight className="w-3 h-3" /></span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.6, ease: [0.22,1,0.36,1] }} className="mt-6 text-[30px] leading-[0.95] sm:text-[44px] lg:text-[52px] font-extrabold tracking-[-0.03em] text-balance">
              JT NextGen Tech Hub
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.7 }} className="block bg-gradient-to-r from-brand-400 via-emerald-300 to-brand-500 bg-clip-text text-transparent">practical digital skills</motion.span>
              training.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.6 }} className="mt-4 text-[15px] leading-6 text-white/60 max-w-[560px] text-pretty">
              3-month, project-based training in Kpongunor — morning & evening sessions, mentorship, and a verified certificate to get you hired. <span className="text-white/85 font-medium">Empowering Minds, Transforming Futures.</span>
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.6 }} className="mt-7 flex flex-wrap gap-3">
              <motion.div whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                <Link to="/register" className="inline-flex cursor-pointer items-center justify-center gap-2 bg-white text-navy-900 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 focus-visible:outline-offset-[#070F1F]">Register Now <motion.span animate={{ x: [0,3,0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}><ArrowRight className="w-4 h-4" /></motion.span></Link>
              </motion.div>
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link to="/programs" className="inline-flex cursor-pointer items-center justify-center gap-2 bg-white/10 border border-white/15 text-white px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur hover:bg-white/15 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">View Programs <BookOpen className="w-4 h-4" /></Link>
              </motion.div>
              <Link to="/verify-certificate" className="hidden sm:inline-flex cursor-pointer items-center gap-2 text-xs text-white/60 hover:text-white/85 underline-offset-4 hover:underline px-2 py-3"><ShieldCheck className="w-4 h-4" /> Verify certificate</Link>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.36 }} className="mt-8 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['A','B','C','D'].map((c,i)=><motion.div key={i} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5 + i * 0.07, type: 'spring', stiffness: 300 }} className="w-7 h-7 rounded-full bg-navy-800 border-2 border-[#070F1F] flex items-center justify-center text-[10px] font-bold text-white/70">{c}</motion.div>)}
                </div>
                <div className="leading-none">
                  <div className="flex items-center gap-1 text-white font-semibold"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> 4.9/5</div>
                  <div className="text-white/50">3k+ learner reviews</div>
                </div>
              </div>
              <span className="hidden sm:block h-6 w-px bg-white/10" />
              <div className="flex items-center gap-2 text-white/60"><Award className="w-4 h-4 text-brand-400" /> Certificate of Competency included</div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.18, duration: 0.6, ease: [0.22,1,0.36,1] }} whileHover={{ y: -4, rotate: 0.3 }} className="relative lg:pl-6">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} className="relative rounded-[24px] overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
              <div className="relative h-52 sm:h-64 overflow-hidden">
                <img src={heroLabImage} alt="Learners collaborating in a technology training session" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070F1F] via-[#070F1F]/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Innovation Lab</p>
                    <p className="text-lg font-extrabold text-white">Build real projects with mentors</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-navy-900">
                    <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                    Verified
                  </span>
                </div>
              </div>
              <div className="relative p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-white/70"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live cohort intake</div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white text-navy-900 font-semibold"><Zap className="w-3 h-3 text-brand-600" /> Project-based</span>
                </div>

                <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { title: 'Web Development', icon: Layers, meta: '3 months • Beginner', color: 'from-brand-500 to-emerald-500' },
                    { title: 'Graphic Design', icon: Sparkles, meta: '3 months • Beginner', color: 'from-fuchsia-500 to-violet-500' },
                    { title: 'Digital Marketing', icon: Target, meta: '3 months • Intermediate', color: 'from-sky-500 to-indigo-500' },
                  ].map((c,i) => (
                    <motion.div key={c.title} custom={i} variants={fadeUp} whileHover={{ y: -3, scale: 1.02 }} transition={{ type: 'spring', stiffness: 400 }} className="rounded-2xl bg-white text-navy-900 p-3.5 border border-black/5 shadow-sm cursor-pointer">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white`}><c.icon className="w-4 h-4" /></div>
                      <div className="text-xs font-bold leading-tight mt-2.5">{c.title}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{c.meta}</div>
                    </motion.div>
                  ))}
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="mt-4 rounded-2xl bg-white p-3.5 flex items-center gap-3 border border-black/5">
                  <img src="https://i.pravatar.cc/100?img=12" alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-navy-900 leading-none">Ama Serwaa — Brand Studio</div>
                    <div className="text-xs text-gray-500 mt-1 truncate">“I now deliver paid branding work for clients.”</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-0.5 text-amber-500">{[1,2,3,4,5].map(i=><Star key={i} className="w-3.5 h-3.5 fill-amber-500" />)}</div>
                </motion.div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  {stats.slice(0,3).map((s,i)=>(
                    <motion.div key={s.k} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.5 + i*0.07 }} className="rounded-2xl bg-white/10 border border-white/10 backdrop-blur p-3 text-center">
                      <div className="text-sm font-extrabold text-white">{s.k}</div>
                      <div className="text-[11px] text-white/70">{s.v}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="px-4 sm:px-5 pb-4">
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="rounded-xl bg-[#0B1220] border border-white/10 p-3 flex items-center gap-3 cursor-pointer">
                  <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white"><Play className="w-4 h-4 fill-white" /></motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white">Watch 60-sec overview</div>
                    <div className="text-[11px] text-white/50">How the 3-month journey works</div>
                  </div>
                  <span className="text-xs text-white/60 hidden sm:inline">01:02</span>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

function TrustBar() {
  const items = [
    { icon: ShieldCheck, label: 'Verified certificates' },
    { icon: Users, label: '12k+ alumni' },
    { icon: Award, label: 'Mentor-led' },
    { icon: Clock, label: 'Morning & Evening' },
  ];
  return (
    <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="bg-white border-y border-gray-100 overflow-hidden">
      <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <motion.p variants={fadeUp} className="text-xs font-semibold tracking-widest text-gray-400">TRUSTED BY LEARNERS & PARTNERS</motion.p>
        <div className="flex flex-wrap items-center gap-6 text-sm font-semibold text-gray-400">
          {items.map((it,i)=>(
            <motion.span key={it.label} custom={i} variants={fadeUp} whileHover={{ y: -1, color: '#0f172a' }} className={`inline-flex items-center gap-2 cursor-default ${i===3 ? 'hidden md:inline-flex' : ''}`}><it.icon className="w-4 h-4" /> {it.label}</motion.span>
          ))}
        </div>
      </motion.div>
    </motion.section>
  );
}

function ProgramsSection({ programs }) {
  const reduce = useReducedMotion();
  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-[#f8fafc]">
      <div className="max-w-7xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger} className="flex flex-wrap items-end justify-between gap-4 mb-8 sm:mb-10">
          <motion.div variants={fadeUp}>
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-brand-700"><Sparkles className="w-3.5 h-3.5" /> PROGRAMS</div>
            <h2 className="mt-2 text-[28px] sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-navy-900 text-balance">Our <span className="text-brand-600">Programs</span></h2>
            <p className="mt-3 text-[14px] leading-6 text-gray-500 max-w-[560px]">Practical, affordable, community-focused training — built to get you hired, not just certified.</p>
          </motion.div>
          <motion.div variants={fadeUp}>
            <Link to="/programs" className="hidden sm:inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:border-gray-300 hover:bg-gray-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">View all <motion.span whileHover={{ x: 3 }}><ArrowRight className="w-4 h-4" /></motion.span></Link>
          </motion.div>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {(programs.length ? programs : Array.from({ length: 6 }).map((_,i)=>({ id:`skeleton-${i}`, title: 'Loading…', description: 'Fetching programs', duration: '—', level: '—', slug: '#' })) ).map((p,i)=>(
            <motion.div key={p.id} custom={i} variants={fadeUp} whileHover={{ y: -6, scale: 1.01 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 350, damping: 22 }} className="group relative rounded-[20px] bg-white border border-gray-100 p-6 shadow-[0_8px_24px_rgba(16,42,67,0.06)] hover:shadow-[0_16px_40px_rgba(16,42,67,0.10)] hover:border-brand-200">
              <motion.div whileHover={{ rotate: 8, scale: 1.08 }} className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-600 group-hover:text-white group-hover:border-brand-600 transition-colors"><ArrowRight className="w-4 h-4" /></motion.div>
              <motion.div whileHover={{ scale: 1.05 }} className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center"><BookOpen className="w-5 h-5" /></motion.div>
              <h3 className="mt-4 pr-10 text-[16px] font-bold leading-tight text-navy-900 group-hover:text-brand-700 transition-colors line-clamp-2">{p.title}</h3>
              <p className="mt-2 text-[13px] leading-5 text-gray-500 line-clamp-2 min-h-[40px]">{p.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100 px-2.5 py-1 text-xs font-medium"><Clock className="w-3 h-3" /> {p.duration}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 text-gray-700 border border-gray-100 px-2.5 py-1 text-xs font-medium">{p.level}</span>
              </div>
              <Link to={`/programs/${p.slug}`} className="absolute inset-0 rounded-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 focus-visible:outline-offset-2" aria-label={`View ${p.title}`}><span className="sr-only">View {p.title}</span></Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-8 flex justify-center sm:hidden">
          <motion.div whileTap={{ scale: 0.97 }}><Link to="/programs" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-navy-900 text-white px-6 py-3 text-sm font-semibold">View all programs <ArrowRight className="w-4 h-4" /></Link></motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function ValueSection() {
  const items = [
    { title: 'Our Vision', text: 'A digitally empowered generation solving real problems for their communities.', icon: Eye, gradient: 'from-brand-500 to-emerald-500' },
    { title: 'Our Mission', text: 'Affordable, practical tech education that anyone can access — and everyone can finish.', icon: Target, gradient: 'from-violet-500 to-fuchsia-500' },
    { title: 'Our Objective', text: 'Employability, innovation and confidence — measured in shipped projects, not theory.', icon: Lightbulb, gradient: 'from-sky-500 to-indigo-500' },
  ];
  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger} className="max-w-3xl">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-brand-700"><GraduationCap className="w-4 h-4" /> ABOUT US</motion.div>
          <motion.h2 variants={fadeUp} className="mt-2 text-[28px] sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-navy-900">A community-driven <span className="text-brand-600">innovation hub</span> for the next generation.</motion.h2>
          <motion.p variants={fadeUp} className="mt-3 text-gray-500 text-[14px] leading-6">We blend mentorship, real briefs and career support so learners leave with a portfolio — not just a certificate.</motion.p>
        </motion.div>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className="mt-8 grid gap-6 md:grid-cols-3">
          {items.map((it, i)=>(
            <motion.div key={it.title} custom={i} variants={fadeUp} whileHover={{ y: -6, scale: 1.01 }} whileTap={{ scale: 0.99 }} className="rounded-[20px] border border-gray-100 bg-[#f8fafc] p-6 hover:bg-white hover:shadow-[0_16px_40px_rgba(16,42,67,0.08)] hover:border-gray-200 group">
              <motion.div whileHover={{ rotate: 5, scale: 1.06 }} className={`w-11 h-11 rounded-xl bg-gradient-to-br ${it.gradient} flex items-center justify-center text-white shadow-sm`}><it.icon className="w-5 h-5" /></motion.div>
              <h3 className="mt-4 text-[16px] font-bold text-navy-900">{it.title}</h3>
              <p className="mt-2 text-[13px] leading-5 text-gray-500">{it.text}</p>
              <motion.div whileHover={{ x: 4 }} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-navy-900">Learn more <ArrowRight className="w-3.5 h-3.5" /></motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function EventsSection({ events }) {
  if (!events?.length) return null;
  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <motion.div variants={fadeUp}>
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-brand-700"><Calendar className="w-3.5 h-3.5" /> EVENTS</div>
            <h2 className="mt-2 text-[26px] sm:text-3xl font-extrabold tracking-tight text-navy-900">Upcoming <span className="text-brand-600">Events</span></h2>
          </motion.div>
          <motion.div variants={fadeUp}><Link to="/contact" className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-navy-900"><MapPin className="w-4 h-4" /> Kpongunor & hybrid</Link></motion.div>
        </motion.div>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.slice(0,6).map((ev,i)=>(
            <motion.div key={ev.id} custom={i} variants={fadeUp} whileHover={{ y: -3, scale: 1.01 }} className="rounded-[16px] border border-gray-100 bg-[#f8fafc] p-4 flex gap-3.5 hover:bg-white hover:shadow-sm hover:border-gray-200">
              <div className="shrink-0 w-[56px] h-[56px] rounded-xl bg-navy-900 text-white flex flex-col items-center justify-center leading-none">
                <span className="text-[18px] font-extrabold">{new Date(ev.event_date).getDate()}</span>
                <span className="text-[10px] tracking-widest font-semibold opacity-80">{new Date(ev.event_date).toLocaleString('en', { month:'short' }).toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold leading-tight text-navy-900 line-clamp-1">{ev.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ev.description}</p>
                <p className="text-xs font-medium text-brand-700 mt-2">{new Date(ev.event_date).toLocaleDateString()} {ev.start_time ? `· ${ev.start_time}${ev.end_time?`–${ev.end_time}`:''}` : ''}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function BlogSection({ blogs }) {
  if (!blogs?.length) return null;
  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-[#f8fafc]">
      <div className="max-w-7xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <motion.div variants={fadeUp}>
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-brand-700"><Layers className="w-3.5 h-3.5" /> NEWS</div>
            <h2 className="mt-2 text-[26px] sm:text-3xl font-extrabold tracking-tight text-navy-900">Latest <span className="text-brand-600">News</span></h2>
          </motion.div>
          <motion.div variants={fadeUp}><Link to="/blog" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gray-50">View all posts <ArrowRight className="w-4 h-4" /></Link></motion.div>
        </motion.div>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-6 md:grid-cols-3">
          {blogs.map((p,i)=>(
            <motion.div key={p.id} custom={i} variants={fadeUp} whileHover={{ y: -5 }} className="group">
              <Link to={`/blog/${p.slug}`} className="cursor-pointer block rounded-[20px] overflow-hidden bg-white border border-gray-100 hover:border-gray-200 hover:shadow-[0_16px_40px_rgba(16,42,67,0.08)] transition-all">
                <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.4 }} className="h-44 bg-gradient-to-br from-navy-900 via-navy-800 to-brand-700 relative overflow-hidden">
                  {p.cover_image ? <img src={p.cover_image} alt={p.title} className="w-full h-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center"><span className="text-white/20 text-5xl font-black">JT</span></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </motion.div>
                <div className="p-5">
                  <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString()} · {p.author_name || 'JT Editorial'}</p>
                  <h3 className="mt-2 font-bold leading-tight text-navy-900 group-hover:text-brand-700 line-clamp-2">{p.title}</h3>
                  {p.excerpt && <p className="mt-2 text-sm leading-5 text-gray-500 line-clamp-2">{p.excerpt}</p>}
                  <motion.span whileHover={{ x: 3 }} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">Read more <ArrowRight className="w-3.5 h-3.5" /></motion.span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function TestimonialsSection({ testimonials = fallbackTestimonials }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const regionRef = useRef(null);

  useEffect(() => {
    if (paused || reduce) return;
    const id = setInterval(()=> setActive((p)=>(p+1)%testimonials.length), 5000);
    return ()=> clearInterval(id);
  }, [paused, reduce]);

  const go = (dir) => setActive((p)=> dir==='next' ? (p+1)%testimonials.length : (p-1+testimonials.length)%testimonials.length);

  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-navy-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-900 to-brand-900/40" />
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="relative max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-brand-200"><Quote className="w-3.5 h-3.5" /> TESTIMONIALS</div>
          <h2 className="mt-2 text-[28px] sm:text-3xl lg:text-4xl font-extrabold tracking-tight">Real stories, <span className="text-brand-300">real growth</span></h2>
          <p className="mt-3 text-sm leading-6 text-white/60">Verified learners — photo, name, role and outcome. No stock quotes.</p>
        </div>

        <div className="mt-8 relative rounded-[20px] bg-white/10 backdrop-blur border border-white/10 p-6 sm:p-8 lg:p-10" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={()=>setPaused(false)} ref={regionRef} role="region" aria-roledescription="carousel" aria-label="Testimonials">
          <div className="absolute top-4 right-4 hidden sm:flex items-center gap-2">
            <button onClick={()=>go('prev')} aria-label="Previous testimonial" className="cursor-pointer w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={()=>go('next')} aria-label="Next testimonial" className="cursor-pointer w-8 h-8 rounded-full bg-white text-navy-900 hover:bg-gray-100 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={active} initial={{ opacity:0, x: reduce?0:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x: reduce?0:-16 }} transition={{ duration:0.35 }} aria-live="polite" aria-atomic="true">
              <Quote className="w-8 h-8 text-white/15 mb-4" />
              <p className="text-[18px] sm:text-[20px] leading-7 font-medium text-white text-pretty">“{testimonials[active].message}”</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-sm font-bold text-white">{testimonials[active].avatar}</div>
                <div>
                  <div className="text-sm font-semibold leading-none">{testimonials[active].name}</div>
                  <div className="text-xs text-white/60 mt-1">{testimonials[active].role}</div>
                </div>
                <div className="ml-auto hidden sm:flex items-center gap-1 text-amber-400">{[1,2,3,4,5].map(i=><Star key={i} className="w-3.5 h-3.5 fill-amber-400" />)}</div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2" role="tablist" aria-label="Testimonial slides">
              {testimonials.map((_, i)=>(
                <button key={i} role="tab" aria-selected={active===i} aria-label={`Go to slide ${i+1} of ${testimonials.length}`} onClick={()=>setActive(i)} className={`cursor-pointer h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${active===i ? 'w-7 bg-white' : 'w-2 bg-white/35 hover:bg-white/60'}`} />
              ))}
              <span className="ml-2 text-xs text-white/50 hidden sm:inline" aria-live="polite">{active+1} / {testimonials.length}</span>
            </div>
            <div className="flex sm:hidden items-center gap-2">
              <button onClick={()=>go('prev')} aria-label="Previous" className="cursor-pointer w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={()=>go('next')} aria-label="Next" className="cursor-pointer w-8 h-8 rounded-full bg-white text-navy-900 flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-white/50">
              <button onClick={()=>setPaused(!paused)} className="cursor-pointer underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded px-1">{paused ? 'Play' : 'Pause'}</button>
              <span aria-hidden>• 5s</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [open, setOpen] = useState(0);
  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-[#f8fafc]">
      <div className="max-w-4xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center max-w-2xl mx-auto">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-brand-700"><Search className="w-3.5 h-3.5" /> FAQ</motion.div>
          <motion.h2 variants={fadeUp} className="mt-2 text-[28px] sm:text-3xl font-extrabold tracking-tight text-navy-900">Frequently asked questions</motion.h2>
          <motion.p variants={fadeUp} className="mt-3 text-sm text-gray-500">Everything you need to know before you enroll.</motion.p>
        </motion.div>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mt-8 space-y-3">
          {faqs.map((f,i)=>(
            <motion.div key={i} custom={i} variants={fadeUp} layout className={`rounded-2xl border bg-white overflow-hidden ${open===i ? 'border-brand-200 shadow-[0_12px_32px_rgba(16,42,67,0.08)]' : 'border-gray-100 hover:border-gray-200'}`}>
              <button onClick={()=> setOpen(open===i ? -1 : i)} className="cursor-pointer w-full flex items-center justify-between gap-4 p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 focus-visible:outline-offset-2">
                <span className="text-[14px] font-semibold text-navy-900">{f.q}</span>
                <motion.span animate={{ rotate: open===i ? 180 : 0 }} transition={{ duration: 0.2 }} className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${open===i ? 'bg-navy-900 text-white border-navy-900' : 'bg-gray-50 text-gray-500 border-gray-200'}`}><ChevronDown className="w-4 h-4" /></motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open===i && (
                  <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration:0.25, ease: [0.22,1,0.36,1] }} className="overflow-hidden">
                    <div className="px-5 pb-5 pt-0">
                      <div className="h-px bg-gray-100 mb-3" />
                      <p className="text-[13.5px] leading-6 text-gray-600 text-pretty">{f.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-10">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, ease: [0.22,1,0.36,1] }} className="relative overflow-hidden rounded-[24px] bg-navy-900 text-white p-7 sm:p-10 lg:p-12">
          <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.22, 0.15] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-transparent to-emerald-500/15 pointer-events-none" />
          <motion.div animate={{ x: [0, 12, 0], y: [0, -10, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }} className="absolute -top-28 -right-28 w-[420px] h-[420px] bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-brand-200"><Zap className="w-3.5 h-3.5" /> READY TO START?</motion.div>
              <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.08 }} className="mt-2 text-[26px] sm:text-3xl lg:text-[32px] font-extrabold tracking-tight leading-tight text-balance">Start your tech journey with one click.</motion.h2>
              <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.14 }} className="mt-3 text-sm leading-6 text-white/60 max-w-[520px]">Join hundreds of learners in Kpongunor — morning & evening sessions, mentorship, and a portfolio that gets you noticed.</motion.p>
            </div>
            <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex flex-wrap gap-3 lg:justify-end">
              <motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.97 }}><Link to="/register" className="cursor-pointer inline-flex items-center justify-center gap-2 bg-white text-navy-900 px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Get Started <motion.span animate={{ x: [0,3,0] }} transition={{ duration: 1.5, repeat: Infinity }}><ArrowRight className="w-4 h-4" /></motion.span></Link></motion.div>
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}><Link to="/contact" className="cursor-pointer inline-flex items-center justify-center gap-2 bg-white/10 border border-white/15 text-white px-7 py-3.5 rounded-xl font-semibold text-sm backdrop-blur hover:bg-white/15 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Contact Us</Link></motion.div>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="relative mt-8 flex flex-wrap items-center gap-4 text-xs text-white/60 border-t border-white/10 pt-6">
            <span className="inline-flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> No prior experience needed</span>
            <span className="hidden sm:block h-3 w-px bg-white/10" />
            <span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brand-300" /> Certificate included</span>
            <span className="hidden sm:block h-3 w-px bg-white/10" />
            <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4 text-white/60" /> 3 months • Morning/Evening</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
