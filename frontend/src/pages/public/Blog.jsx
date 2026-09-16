/**
 * Blog — public blog list page
 *
 * Shows all published blog posts from the API, newest first.
 * Cards link to the individual post page.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { blogAPI } from '../../api';

const fadeUp = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

export default function Blog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'Blog | JT NextGen Tech Hub'; }, []);

  useEffect(() => {
    blogAPI.getAll().then((r) => setPosts(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <section className="py-12 md:py-20 px-4 md:px-6 bg-gray-50 dark:bg-gray-800/50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h1 className="text-4xl font-bold text-brand-800 mb-4">News &amp; Blog</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">Updates, announcements, and insights from JT NextGen Tech Hub.</p>
          </motion.div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
          ) : posts.length === 0 ? (
            <p className="text-center text-gray-400 py-20">No blog posts yet. Check back soon!</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p, i) => (
                <motion.div key={p.id} {...fadeUp} transition={{ delay: i * 0.05 }}>
                  <Link to={`/blog/${p.slug}`} className="accent-card block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-brand-200 transition-all group">
                    <div className="h-44 bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center overflow-hidden">
                      {p.cover_image ? (
                        <img src={p.cover_image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <span className="text-5xl text-white/30 font-bold group-hover:scale-110 transition-transform duration-300">JT</span>
                      )}
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-gray-400 mb-2">{new Date(p.created_at).toLocaleDateString()} &middot; {p.author_name}</p>
                      <h2 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-brand-700 transition-colors">{p.title}</h2>
                      {p.excerpt && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-3">{p.excerpt}</p>}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
}