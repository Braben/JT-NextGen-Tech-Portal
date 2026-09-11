import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } };

export default function About() {
  useEffect(() => { document.title = 'About Us | JT NextGen Tech Hub'; }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <div className="py-12 md:py-20 px-4 md:px-6 bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-brand-800 mb-6">About <span className="text-brand-600">JT NextGen Tech Hub</span></h1>
          <p className="max-w-3xl mx-auto text-gray-600 dark:text-gray-400 text-lg">A community-driven technology training and innovation center equipping young people with practical, employable digital skills.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">Who We Are</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Talent is everywhere, opportunity is not. We bridge that gap through affordable, hands-on tech education.</p>
            <p className="text-gray-600 dark:text-gray-400">Our programs focus on real-world skills, mentorship, and community-based learning.</p>
            <div className="bg-brand-50 rounded-2xl shadow-sm p-6 mt-6">
              <h3 className="text-xl font-semibold mb-3 text-brand-700">What We Do</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                {['Practical tech training', 'Career mentorship', 'Beginner-friendly programs', 'Community empowerment'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="text-brand-600">&check;</span> {item}</li>
                ))}
              </ul>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-gradient-to-br from-brand-100 to-brand-50 rounded-3xl p-8">
            <div className="grid grid-cols-2 gap-4">
              {['Our Vision', 'Our Mission', 'Our Objective'].map((title, i) => (
                <motion.div key={i} whileHover={{ y: -4 }} className={`bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm ${i === 2 ? 'col-span-2' : ''}`}>
                  <h3 className="font-semibold text-brand-700 mb-2">{title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {i === 0 && 'To raise a digitally empowered generation capable of solving real problems.'}
                    {i === 1 && 'To provide affordable, practical tech education accessible to all.'}
                    {i === 2 && 'To promote employability, innovation, and confidence in every learner.'}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="bg-gradient-to-br from-brand-700 to-brand-800 rounded-3xl py-10 md:py-16 px-4 md:px-8 text-white text-center mb-20">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">Our Impact So Far</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[{ value: '100+', label: 'Students Trained' }, { value: '10', label: 'Tech Programs' }, { value: '15+', label: 'Communities Reached' }].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.1 }}>
                <div className="text-5xl font-bold text-brand-200">{s.value}</div>
                <p className="text-brand-100 mt-2">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div {...fadeUp} className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-brand-800 mb-4">Ready to Start Your Tech Journey?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Join hundreds of learners shaping their future through digital skills.</p>
          <Link to="/register" className="btn-primary px-10 py-3 text-lg inline-block hover:scale-105 active:scale-95 transition-transform">Get Started Today</Link>
        </motion.div>
      </div>
    </div>
    </motion.div>
  );
}
