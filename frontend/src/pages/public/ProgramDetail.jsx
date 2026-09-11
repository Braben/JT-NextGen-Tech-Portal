import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { programAPI } from '../../api';

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } };

export default function ProgramDetail() {
  const { slug } = useParams();
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    programAPI.get(slug).then((r) => { setProgram(r.data); document.title = `${r.data.title} | JT NextGen Tech Hub`; }).catch(() => {}).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
  if (!program) return <div className="text-center py-20 text-gray-500 dark:text-gray-400">Program not found.</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <section className="py-12 md:py-20 px-4 md:px-6 bg-white dark:bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <motion.div {...fadeUp}>
          <Link to="/programs" className="text-brand-600 hover:underline text-sm inline-block hover:translate-x-[-2px] transition-transform">&larr; Back to Programs</Link>
          <h1 className="text-3xl md:text-5xl font-bold text-brand-800 mt-6 mb-4">{program.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">{program.description}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.1 }}
          className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-brand-700 mb-3">Program Details</h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p><strong>Duration:</strong> {program.duration}</p>
              <p><strong>Level:</strong> {program.level}</p>
              <p><strong>Target Audience:</strong> {program.audience}</p>
            </div>
          </div>
          <div className="bg-brand-50 p-6 rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-brand-700 mb-3">What You'll Learn</h3>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1 text-sm">
              {(program.outcomes || []).map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </div>
        </motion.div>

        <motion.div {...fadeUp} className="flex gap-4 flex-wrap">
          <Link to="/register" className="btn-primary px-8 py-3 inline-block hover:scale-105 active:scale-95 transition-transform">Register for this Program</Link>
          <Link to="/contact" className="btn-secondary px-8 py-3 inline-block hover:scale-105 active:scale-95 transition-transform">Ask a Question</Link>
        </motion.div>
      </div>
    </section>
    </motion.div>
  );
}
