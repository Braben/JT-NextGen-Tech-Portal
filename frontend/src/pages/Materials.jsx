import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fileAPI, materialAPI, openBlobDownload, programAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

export default function Materials() {
  const { user } = useAuth();
  if (user.role === 'student') return <StudentMaterials />;
  if (user.role === 'instructor') return <InstructorMaterials />;
  if (user.role === 'admin') return <InstructorMaterials />;
  return <div className="text-center py-20 text-gray-400">Access restricted</div>;
}

function StudentMaterials() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    materialAPI.getAll()
      .then((res) => {
        const data = res.data || [];
        const grouped = data.reduce((acc, m) => {
          const key = m.program_name || 'General';
          if (!acc[key]) acc[key] = [];
          acc[key].push(m);
          return acc;
        }, {});
        setGroups(Object.entries(grouped));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Course Materials</h1>
      <p className="text-gray-500 text-sm mb-6">Learning resources from your enrolled programs</p>

      {groups.length === 0 ? (
        <div className="card bg-gray-50 border-dashed border-gray-200 text-center py-12">
          <p className="text-gray-400 font-medium">No materials available yet</p>
          <p className="text-gray-400 text-sm mt-1">Materials will appear here when instructors upload them</p>
        </div>
      ) : (
        groups.map(([program, items]) => (
          <div key={program} className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-brand-500" />
              <h2 className="text-lg font-semibold text-gray-900">{program}</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((m, i) => (
                <MaterialCard key={m.id} material={m} index={i} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** One row in the add-materials form: a link OR a local file. */
function MaterialItemRow({ item, index, onUpdate, onRemove, showRemove, allowAudience }) {
  const fileRef = useRef(null);
  const badgeColor = {
    document: 'bg-blue-100 text-blue-700',
    video: 'bg-purple-100 text-purple-700',
    link: 'bg-cyan-100 text-cyan-700',
    slides: 'bg-orange-100 text-orange-700',
    other: 'bg-gray-100 text-gray-600',
  };

  const toggleGroup = (group) => {
    const groups = item.audience_groups || ['active'];
    const next = groups.includes(group) ? groups.filter((g) => g !== group) : [...groups, group];
    onUpdate(index, { audience_groups: next.length ? next : ['active'] });
  };

  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Material {index + 1}</span>
          {item.file ? (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${badgeColor[item.file_type] || 'bg-gray-100 text-gray-600'}`}>
              {item.file.name}
            </span>
          ) : (
            item.link_url && (
              <span className="text-xs text-cyan-600 font-medium truncate max-w-[180px]">{item.link_url}</span>
            )
          )}
        </div>
        {showRemove && (
          <button type="button" onClick={() => onRemove(index)} className="text-gray-400 hover:text-red-500 transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        )}
      </div>

      <div className="space-y-2">
        <input type="text" className="input-field text-sm" placeholder="Title (e.g. Chapter 1 Slides) *"
          value={item.title} onChange={(e) => onUpdate(index, { title: e.target.value })} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Source</label>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => fileRef.current?.click()}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${item.file ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-brand-300'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                {item.file ? 'Change file' : 'File'}
              </button>
              <span className="text-xs text-gray-400 self-center">or</span>
              <button type="button"
                onClick={() => { onUpdate(index, { link_url: item.link_url ? '' : 'https://' }); }}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${item.link_url ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'border-gray-200 text-gray-600 hover:border-cyan-300'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.657.986.986 0 01-.686.293H10.5a4 4 0 01-5.657 0l-2-2a4 4 0 010-5.657.986.986 0 01.686-.293h1.657" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 010-5.657.986.986 0 01.686-.293h.828a4 4 0 005.657 0l2-2a4 4 0 010-5.657.986.986 0 01.686-.293H21a4 4 0 013.657 3.515" /></svg>
                Link
              </button>
            </div>
            <input ref={fileRef} type="file" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const ext = f.name.split('.').pop().toLowerCase();
                  const map = { mp4: 'video', mov: 'video', avi: 'video', pdf: 'document', doc: 'document', docx: 'document', ppt: 'slides', pptx: 'slides', key: 'slides' };
                  const detected = map[ext] || item.file_type || 'document';
                  onUpdate(index, { file: f, link_url: '', file_type: detected });
                }
                e.target.value = '';
              }} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Type</label>
            <select className="input-field text-sm" value={item.file_type}
              onChange={(e) => onUpdate(index, { file_type: e.target.value })}>
              <option value="document">Document</option>
              <option value="video">Video</option>
              <option value="slides">Slides</option>
              <option value="link">Link</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {item.link_url !== '' && item.link_url !== null && typeof item.link_url === 'string' && item.link_url !== undefined ? (
          <input type="url" className="input-field text-sm" placeholder="https://example.com/file.pdf"
            value={item.link_url} onChange={(e) => onUpdate(index, { link_url: e.target.value })} />
        ) : null}
        <input type="text" className="input-field text-sm" placeholder="Description (optional)"
          value={item.description} onChange={(e) => onUpdate(index, { description: e.target.value })} />

        {allowAudience && (
          <div className="pt-1 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Who can see this? (admin visibility)</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button"
                onClick={() => toggleGroup('active')}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${(item.audience_groups || ['active']).includes('active') ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
                Active students
              </button>
              <button type="button"
                onClick={() => toggleGroup('alumni')}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${(item.audience_groups || []).includes('alumni') ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>
                Alumni
              </button>

              {(item.audience_groups || []).includes('alumni') && (
                <span className="flex items-center gap-1.5 text-xs ml-2">
                  <span className="text-gray-400">Cohort:</span>
                  <input type="number" min="2020" max="2100" placeholder="Year"
                    className="input-field text-xs w-20 py-1"
                    value={item.audience_year || ''}
                    onChange={(e) => onUpdate(index, { audience_year: e.target.value })} />
                  <select className="input-field text-xs w-28 py-1"
                    value={item.audience_month || ''}
                    onChange={(e) => onUpdate(index, { audience_month: e.target.value })}>
                    <option value="">Any month</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={String(m).padStart(2, '0')}>
                        {new Date(2021, m - 1, 1).toLocaleString('en', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <span className="text-gray-400">(leave blank = all years/months)</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InstructorMaterials() {
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [materials, setMaterials] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [program_id, setProgramId] = useState('');
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const emptyItem = () => ({
    _id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: '', description: '', link_url: '', file_type: 'document',
    file: null,
    audience_groups: ['active'], audience_year: '', audience_month: '',
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([materialAPI.getAll({ mine: true }), programAPI.getAll()])
      .then(([mRes, pRes]) => {
        setMaterials(mRes.data || []);
        setPrograms(pRes.data || []);
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load materials' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const openForm = () => {
    setProgramId('');
    setItems([emptyItem()]);
    setMessage(null);
    setShowForm(true);
  };

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!program_id) {
      setMessage({ type: 'error', text: 'Select a program' });
      return;
    }
    const validItems = items.filter((it) => it.title.trim() && (it.file || it.link_url.trim()));
    if (validItems.length === 0) {
      setMessage({ type: 'error', text: 'Add at least one material with a title and a file or link' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      // Build FormData: one entry per item. Files are appended in order and
      // referenced by their item index via file_key.
      const formData = new FormData();
      formData.append('program_id', program_id);
      const data = validItems.map((it, i) => {
        const entry = {
          title: it.title,
          description: it.description,
          file_type: it.file_type,
          link_url: it.link_url,
          audience_groups: it.audience_groups || ['active'],
          audience_year: it.audience_year || '',
          audience_month: it.audience_month || '',
        };
        if (it.file) entry.file_key = i;
        return entry;
      });
      formData.append('data', JSON.stringify(data));
      validItems.forEach((it) => { if (it.file) formData.append('files', it.file); });

      const res = await materialAPI.createMulti(formData);
      setShowForm(false);
      setMessage({ type: 'success', text: res.data.message || 'Materials added successfully' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to upload materials' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setMessage(null), 6000);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Delete this material? Students will lose access.', { danger: true, title: 'Delete material', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await materialAPI.delete(id);
      toast('Material deleted', 'success');
      loadData();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to delete material', 'error');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Course Materials</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your uploaded learning resources</p>
        </div>
        <button onClick={() => { if (showForm) { setShowForm(false); } else { openForm(); } }} className="btn-primary flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {showForm ? 'Cancel' : 'Add Materials'}
        </button>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm mb-4 border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message.text}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            key="add-materials-form"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="card mb-6 border-brand-200"
          >
            <h3 className="font-semibold text-gray-900 mb-1">Add Materials</h3>
            <p className="text-xs text-gray-400 mb-3">Add several materials at once — each can be a link or a file on your computer.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="max-w-sm">
                <label className="block text-xs text-gray-500 font-medium mb-1">Program *</label>
                <select className="input-field" value={program_id} onChange={(e) => setProgramId(e.target.value)} required>
                  <option value="">Select program</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>

              <div className="space-y-3">
                {items.map((item, i) => (
                  <MaterialItemRow key={item._id || i} item={item} index={i}
                    allowAudience={user?.role === 'admin'}
                    onUpdate={updateItem} onRemove={removeItem} showRemove={items.length > 1} />
                ))}
              </div>

              <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add another material
              </button>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submitting} className="btn-primary text-sm">
                  {submitting ? 'Uploading...' : `Upload ${items.length} material${items.length !== 1 ? 's' : ''}`}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {materials.length === 0 ? (
        <div className="card bg-gray-50 border-dashed border-gray-200 text-center py-12">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-gray-400 font-medium">No materials yet</p>
          <p className="text-gray-400 text-sm mt-1">Click "Add Materials" to upload your first resource</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m, i) => (
            <MaterialCard key={m.id} material={m} index={i} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialCard({ material: m, index, onDelete }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const badgeColor = {
    document: 'bg-blue-100 text-blue-700',
    video: 'bg-purple-100 text-purple-700',
    link: 'bg-cyan-100 text-cyan-700',
    slides: 'bg-orange-100 text-orange-700',
    other: 'bg-gray-100 text-gray-600',
  };

  const canManage = (user?.role === 'instructor' || user?.role === 'admin') && onDelete;
  const downloadMaterial = async () => {
    try {
      const res = await fileAPI.material(m.id);
      openBlobDownload(res, `${m.title || 'material'}`);
    } catch (err) {
      toast(err.response?.data?.error || 'You do not have access to this file', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index || 0) * 0.05 }}
      className="card flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{m.title}</h3>
          {m.program_name && (
            <p className="text-xs text-gray-400 mt-0.5">{m.program_name}</p>
          )}
        </div>
        {m.file_type && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${badgeColor[m.file_type] || 'bg-gray-100 text-gray-600'}`}>
            {m.file_type}
          </span>
        )}
      </div>

      {m.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{m.description}</p>
      )}

      {m.instructor_name && (
        <p className="text-xs text-gray-400 mb-3">
          {m.uploader_role === 'admin' ? (
            <>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-white font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                System
              </span>
              <span className="ml-1">posted by admin</span>
            </>
          ) : (
            <>
              <span className="font-medium text-gray-500">by</span> {m.instructor_name}
            </>
          )}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2 pt-3 border-t border-gray-50">
        {m.link_url ? (
          <a href={m.link_url} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs px-4 py-1.5 inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            Open
          </a>
        ) : (
          m.file_path && (
            <button type="button" onClick={downloadMaterial} className="btn-primary text-xs px-4 py-1.5 inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download
            </button>
          )
        )}
        {canManage && (
          <button onClick={() => onDelete(m.id)} className="btn-danger text-xs px-3 py-1.5 ml-auto">
            Delete
          </button>
        )}
      </div>
    </motion.div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}
