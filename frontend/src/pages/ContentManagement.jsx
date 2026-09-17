import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { FiPlus, FiEdit, FiTrash2, FiEye } from 'react-icons/fi';
import { blogAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { Button, Input, Textarea, Select, Card } from '../components/ui';
import RichTextEditor from '../components/RichTextEditor';

export default function ContentManagement({ type = 'blog' }) {
  const admin = useAuth().user?.role === 'admin';
  const { toast } = useToast();
  const confirm = useConfirm();
  const [rows,setRows] = useState([]), [loading,setLoading] = useState(true), [error,setError] = useState('');
  const [form,setForm] = useState(null), [saving,setSaving] = useState(false), [preview,setPreview] = useState(false);
  const label = type === 'article' ? 'Articles' : 'Blog';
  const load = useCallback(async()=>{
    setLoading(true); setError('');
    try { setRows((await blogAPI.manage()).data); } catch(e) { setError(e.response?.data?.error || 'Could not load posts. Please retry.'); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ setForm(null); load(); },[type,load]);
  const edit = (row) => { setError(''); setPreview(false); setForm(row ? { ...row, cover_image: row.cover_image || '', review_status: !admin && row.published ? 'draft' : row.review_status } : { title:'',excerpt:'',content:'',cover_image:'',content_type:type,review_status:'draft' }); };
  const update = key => e => setForm(f=>({...f,[key]:e.target.value}));
  const save = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const { title,excerpt,content,cover_image,review_status } = form;
      await blogAPI.save(form.id,{title,excerpt,content,cover_image,review_status,content_type:type});
      setForm(null); toast(review_status === 'published' ? 'Post published' : review_status === 'pending' ? 'Article submitted for admin review' : 'Draft saved','success'); await load();
    } catch(e) { setError(e.response?.data?.error || 'Could not save this post. Your work is still in the editor.'); }
    finally { setSaving(false); }
  };
  const remove = async row => {
    if (!await confirm(`Delete “${row.title}”?`,{title:'Delete post',danger:true,confirmText:'Delete'})) return;
    try { await blogAPI.remove(row.id); await load(); } catch(e) { setError(e.response?.data?.error || 'Could not delete post'); }
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-ink">{label}</h1><p className="text-gray-600 dark:text-gray-300">{admin ? 'Create, review, and publish content for the public site.' : 'Write articles and send them to an admin for publication.'}</p></div><Button icon={FiPlus} onClick={()=>edit(null)} disabled={saving || !!form}>New {type === 'article' ? 'article' : 'blog post'}</Button></div>
    <Link className="text-brand-700 dark:text-turquoise underline" to={type === 'article' ? '/articles' : '/blog'}>View public {label.toLowerCase()}</Link>
    {error && <div role="alert" className="card text-red-700 dark:text-red-300">{error} {!form && <Button variant="outline" onClick={load}>Retry</Button>}</div>}
    {form ? <Card><form onSubmit={save} className="space-y-5">
      <h2 className="text-xl font-semibold">{form.id ? 'Edit post' : 'Create post'}</h2>
      {!admin && form.published === 1 && <p className="text-sm text-gray-600 dark:text-gray-300">Saving changes will take this article offline until an admin approves it again.</p>}
      <Input label="Title" value={form.title} onChange={update('title')} required maxLength={200} />
      <Textarea label="Excerpt" value={form.excerpt} onChange={update('excerpt')} maxLength={500} rows={2} />
      <Input label="Cover image URL" type="url" value={form.cover_image} onChange={update('cover_image')} placeholder="https://example.com/image.jpg" helperText="Optional. Use a publicly accessible image URL." />
      <div><p className="mb-2 font-medium">Content</p><RichTextEditor content={form.content} onChange={content=>setForm(f=>({...f,content}))} /></div>
      <Select label="Publication status" value={form.review_status} onChange={update('review_status')} options={[{value:'draft',label:'Draft'},{value:'pending',label:admin ? 'Pending review' : 'Submit for admin review'},...(admin ? [{value:'published',label:'Published — visible to everyone'}] : [])]} />
      <div className="flex flex-wrap gap-3"><Button type="submit" loading={saving}>Save {type === 'article' ? 'article' : 'post'}</Button><Button variant="outline" icon={FiEye} onClick={()=>setPreview(!preview)}>Preview</Button><Button variant="secondary" disabled={saving} onClick={()=>setForm(null)}>Cancel</Button></div>
      {preview && <article className="card space-y-4"><h2 className="text-2xl font-bold">{form.title}</h2>{/^https?:\/\//i.test(form.cover_image) && <img src={form.cover_image} alt="Cover preview" className="max-h-64 rounded-lg object-cover" />}<p>{form.excerpt}</p><div className="post-content" dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(form.content)}} /></article>}
    </form></Card> : loading ? <p role="status">Loading posts...</p> : <div className="grid gap-4 xl:grid-cols-2">
      {rows.filter(r=>r.content_type === type).map(row=><Card key={row.id}><div className="space-y-3"><span className="status-badge bg-brand-50 text-brand-800 dark:text-turquoise">{row.review_status}</span><h2 className="text-lg font-semibold">{row.title}</h2><p className="text-sm text-gray-600 dark:text-gray-300">By {row.author_name} · {new Date(row.updated_at).toLocaleDateString()}</p><p>{row.excerpt}</p><div className="flex flex-wrap gap-2"><Button variant="outline" icon={FiEdit} onClick={()=>edit(row)}>Edit / review</Button><Button variant="danger" icon={FiTrash2} onClick={()=>remove(row)}>Delete</Button>{row.published === 1 && <Link className="self-center text-brand-700 dark:text-turquoise underline" to={`/${type === 'article' ? 'articles' : 'blog'}/${row.slug}`}>View published post</Link>}</div></div></Card>)}
      {!rows.some(r=>r.content_type === type) && <p>No {label.toLowerCase()} yet. Create your first post.</p>}
    </div>}
  </div>;
}
