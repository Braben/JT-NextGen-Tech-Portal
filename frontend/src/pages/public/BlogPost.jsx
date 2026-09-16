/**
 * BlogPost — public single post page (by slug)
 */

import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { blogAPI } from '../../api';

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setNotFound(false);
    blogAPI.get(slug).then((r) => setPost(r.data)).catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => { if (post) document.title = `${post.title} | JT NextGen Tech Hub`; }, [post]);

  if (notFound) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-400 text-lg mb-4">Blog post not found.</p>
        <Link to="/blog" className="btn-primary">Back to Blog</Link>
      </div>
    );
  }

  if (!post) {
    return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <section className="py-12 md:py-20 px-4 md:px-6 bg-gray-50 dark:bg-gray-800/50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium mb-8">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Blog
          </Link>

          <motion.article initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="accent-card bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {post.cover_image ? (
              <img src={post.cover_image} alt={post.title} className="w-full h-64 md:h-80 object-cover" />
            ) : (
              <div className="w-full h-64 md:h-80 bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
                <span className="text-6xl text-white/30 font-bold">JT</span>
              </div>
            )}
            <div className="p-6 md:p-10">
              <p className="text-xs text-gray-400 mb-3">{new Date(post.created_at).toLocaleDateString()} &middot; {post.author_name}</p>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-6">{post.title}</h1>
              {post.excerpt && <p className="text-gray-500 dark:text-gray-400 text-lg mb-6">{post.excerpt}</p>}
              <div className="prose max-w-none text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {post.content}
              </div>
            </div>
          </motion.article>
        </div>
      </section>
    </motion.div>
  );
}