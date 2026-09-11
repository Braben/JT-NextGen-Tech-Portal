import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { forumAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Forums() {
  const { categoryId, topicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = getForumBasePath(location.pathname);

  if (topicId) return <TopicDetail topicId={topicId} basePath={basePath} onBack={() => navigate(`${basePath}/${categoryId}`)} />;
  if (categoryId) return <CategoryView categoryId={categoryId} basePath={basePath} />;
  return <CategoryList basePath={basePath} />;
}

function getForumBasePath(pathname) {
  if (pathname.startsWith('/admin/forums')) return '/admin/forums';
  if (pathname.startsWith('/instructor/forums')) return '/instructor/forums';
  if (pathname.startsWith('/student/forums')) return '/student/forums';
  return '/forums';
}

function CategoryList({ basePath }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'general', session: '' });
  const { user } = useAuth();

  useEffect(() => {
    forumAPI.getCategories().then(r => setCategories(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    await forumAPI.createCategory(form);
    setShowCreate(false);
    setForm({ name: '', description: '', type: 'general', session: '' });
    const r = await forumAPI.getCategories();
    setCategories(r.data);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forums</h1>
          <p className="text-gray-500 text-sm mt-1">Discuss topics with your cohort and the community</p>
        </div>
        {(user.role === 'admin' || user.role === 'instructor') && (
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">New Category</button>
        )}
      </div>

      {showCreate && (
        <div className="card mb-6 border-brand-200">
          <h3 className="font-semibold text-gray-900 mb-3">New Forum Category</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input type="text" className="input-field" placeholder="Category name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            <input type="text" className="input-field" placeholder="Description (optional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            <select className="input-field" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              <option value="general">General</option>
              <option value="cohort">Cohort</option>
            </select>
            {form.type === 'cohort' && (
              <select className="input-field" value={form.session} onChange={e => setForm(p => ({ ...p, session: e.target.value }))}>
                <option value="">Select session</option>
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
              </select>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={`${basePath}/${c.id}`} className="card hover:border-brand-200 hover:shadow-sm transition-all block">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                    {c.class_id && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Class</span>}
                    {c.type === 'cohort' && !c.class_id && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{c.session}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.type === 'general' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{c.type}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{c.description}</p>
                  <p className="text-xs text-gray-400 mt-2">{c.topic_count || 0} topics</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CategoryView({ categoryId, basePath }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });

  useEffect(() => {
    forumAPI.getCategory(categoryId).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [categoryId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    await forumAPI.createTopic(categoryId, form);
    setShowNew(false);
    setForm({ title: '', content: '' });
    const r = await forumAPI.getCategory(categoryId);
    setData(r.data);
  };

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-center py-20 text-gray-400">Category not found</div>;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to={basePath} className="hover:text-brand-600">Forums</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{data.name}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          <p className="text-gray-500 text-sm mt-1">{data.description}</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary text-sm">New Topic</button>
      </div>

      {showNew && (
        <div className="card mb-6 border-brand-200">
          <h3 className="font-semibold text-gray-900 mb-3">Create New Topic</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input type="text" className="input-field" placeholder="Topic title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
            <textarea className="input-field min-h-[120px]" placeholder="Write your topic content..." value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} required />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Post Topic</button>
              <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {data.topics.length === 0 ? (
          <div className="text-center py-12"><p className="text-gray-400">No topics yet. Be the first to post!</p></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.topics.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link to={`${basePath}/${categoryId}/topics/${t.id}`} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{t.user_name?.charAt(0)?.toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.is_pinned === 1 && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">Pinned</span>}
                      {t.is_closed === 1 && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Closed</span>}
                      <h3 className="font-medium text-gray-900 truncate">{t.title}</h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{t.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{t.user_name}</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      <span>{t.reply_count} replies</span>
                      <span>{t.likes_count || 0} likes</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopicDetail({ topicId, basePath, onBack }) {
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const { user } = useAuth();

  const loadTopic = () => forumAPI.getTopic(topicId).then(r => setTopic(r.data));

  useEffect(() => { loadTopic().catch(() => {}).finally(() => setLoading(false)); }, [topicId]);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    await forumAPI.createReply(topicId, { content: reply });
    setReply('');
    loadTopic();
  };

  const handlePin = async () => { await forumAPI.pinTopic(topicId); loadTopic(); };
  const handleClose = async () => { await forumAPI.closeTopic(topicId); loadTopic(); };
  const handleLikeTopic = async () => { await forumAPI.likeTopic(topicId); loadTopic(); };
  const handleLikeReply = async (replyId) => { await forumAPI.likeReply(replyId); loadTopic(); };
  const handleRateReply = async (replyId, rating) => { await forumAPI.rateReply(replyId, rating); loadTopic(); };

  if (loading) return <LoadingSpinner />;
  if (!topic) return <div className="text-center py-20 text-gray-400">Topic not found</div>;

  const isMod = user.role === 'admin' || user.role === 'instructor';

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to={basePath} className="hover:text-brand-600">Forums</Link>
        <span>/</span>
        <button onClick={onBack} className="hover:text-brand-600">{topic.category_name || 'Category'}</button>
        <span>/</span>
        <span className="text-gray-700 font-medium truncate max-w-[200px]">{topic.title}</span>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card mb-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-bold flex-shrink-0">{topic.user_name?.charAt(0)?.toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{topic.title}</h1>
              {topic.is_pinned === 1 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-medium">Pinned</span>}
              {topic.is_closed === 1 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Closed</span>}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
              <span>{topic.user_name}</span>
              <span className="capitalize">({topic.user_role})</span>
              <span>{new Date(topic.created_at).toLocaleDateString()}</span>
            </div>
            <div className="mt-4 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{topic.content}</div>
            <div className="flex items-center gap-4 mt-4">
              <motion.button whileTap={{ scale: 0.8 }} onClick={handleLikeTopic}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${topic.user_liked ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                <svg className={`w-4 h-4 ${topic.user_liked ? 'fill-current text-red-500' : ''}`} fill={topic.user_liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>{topic.likes_count || 0}</span>
              </motion.button>
              {isMod && (
                <div className="flex gap-2">
                  <button onClick={handlePin} className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:bg-yellow-50 text-gray-600">{topic.is_pinned === 1 ? 'Unpin' : 'Pin'}</button>
                  <button onClick={handleClose} className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:bg-red-50 text-gray-600">{topic.is_closed === 1 ? 'Reopen' : 'Close'}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="space-y-3 mb-6">
        <AnimatePresence>
          {topic.replies.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="card">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-bold flex-shrink-0">{r.user_name?.charAt(0)?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{r.user_name}</span>
                    <span className="text-xs text-gray-400 capitalize">({r.user_role})</span>
                    <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{r.content}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <motion.button whileTap={{ scale: 0.8 }} onClick={() => handleLikeReply(r.id)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${r.user_liked ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                      <svg className={`w-3.5 h-3.5 ${r.user_liked ? 'fill-current text-red-500' : ''}`} fill={r.user_liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      <span>{r.likes_count || 0}</span>
                    </motion.button>
                    <StarRating reply={r} onRate={handleRateReply} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {topic.is_closed === 1 ? (
        <div className="text-center py-4 bg-gray-50 rounded-lg text-sm text-gray-500">This topic is closed for new replies</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
          <form onSubmit={handleReply}>
            <textarea className="input-field min-h-[100px]" placeholder="Write your reply..." value={reply} onChange={e => setReply(e.target.value)} required />
            <button type="submit" className="btn-primary mt-3 text-sm">Post Reply</button>
          </form>
        </motion.div>
      )}
    </div>
  );
}

function StarRating({ reply, onRate }) {
  const [hover, setHover] = useState(0);
  const rating = reply.user_rating || 0;

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button key={star} type="button" whileTap={{ scale: 0.7 }}
          onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)} onClick={() => onRate(reply.id, star)}
          className={`transition-colors ${hover ? (star <= hover ? 'text-yellow-400' : 'text-gray-300') : (star <= rating ? 'text-yellow-400' : 'text-gray-300')}`}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </motion.button>
      ))}
      {reply.rating_count > 0 && (
        <span className="ml-1 text-gray-400">({reply.rating_avg})</span>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}
