/**
 * BlogPost — public single post page (by slug)
 */

import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { blogAPI } from '../../api';
import DOMPurify from 'dompurify';
import ShareLinks from '../../components/ShareLinks';

export default function BlogPost({ type = 'blog' }) {
  const base = type === 'article' ? '/articles' : '/blog';
  const label = type === 'article' ? 'Articles' : 'Blog';
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setNotFound(false); setPost(null); setError('');
    blogAPI.get(slug).then((r) => { if (active) { if (r.data.content_type !== type) setNotFound(true); else setPost(r.data); } }).catch(e => { if (active) { if (e.response?.status === 404) setNotFound(true); else setError('Unable to load this post. Please reload to try again.'); } });
    return () => { active = false; };
  }, [slug,type]);

  useEffect(() => { if (post) document.title = `${post.title} | JT NextGen Tech Hub`; }, [post]);

  if (notFound || error) {
    return (
      <div className="py-20 text-center">
        <p role="alert" className="text-gray-400 text-lg mb-4">{error || 'Post not found.'}</p>
        <Link to={base} className="btn-primary">Back to {label}</Link>
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
          <Link to={base} className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium mb-8">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to {label}
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
              <div className="post-content text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(post.content)}} />
              <ShareLinks title={post.title} path={`${base}/${post.slug}`} />
            </div>
          </motion.article>
        </div>
      </section>
    </motion.div>
  );
}
