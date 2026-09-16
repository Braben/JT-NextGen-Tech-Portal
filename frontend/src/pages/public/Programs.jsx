import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { programAPI } from '../../api';

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } };

export default function Programs() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Our Programs | JT NextGen Tech Hub';
    programAPI.getAll().then((r) => setPrograms(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <section className="py-12 md:py-20 px-4 md:px-6 bg-gray-50 dark:bg-gray-800/50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-14">
          <h1 className="text-3xl md:text-5xl font-bold text-brand-800">Our <span className="text-brand-600">Programs</span></h1>
          <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Practical, affordable, and community-focused tech training designed to prepare you for real opportunities.</p>
        </motion.div>
        <motion.div variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }} initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-40px' }} className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <motion.div key={p.id} variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}>
              <Link to={`/programs/${p.slug}`} className="accent-card bg-white dark:bg-gray-800 rounded-xl shadow-md hover:-translate-y-1 hover:shadow-lg transition-all duration-300 p-6 border-t-4 border-brand-600 group block">
                <h3 className="text-xl font-semibold text-brand-800 mb-2 group-hover:text-brand-600 transition-colors">{p.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">{p.description}</p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span className="bg-brand-50 text-brand-700 px-2 py-1 rounded">{p.duration}</span>
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">{p.level}</span>
                </div>
                <p className="text-xs text-gray-400">Audience: {p.audience}</p>
                <span className="inline-block mt-3 text-brand-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">&rarr; View Program</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
    </motion.div>
  );
}
