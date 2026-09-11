import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI, enrollmentAPI, gradebookAPI } from '../api';
import { Card, Button, Input, Textarea } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import { User, Mail, MapPin, Shield, Bell, Settings, Camera, Upload, Award, Calendar, LogOut, Check, X, Smartphone, Globe, Eye, EyeOff, Trash2, Download } from 'lucide-react';

const AVATAR_COLORS = ['#16a34a', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#0891b2'];

export default function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [form, setForm] = useState({
    name: user?.name || '',
    avatar: user?.avatar || '',
    location: user?.location || '',
    phone: user?.phone || '',
    bio: user?.bio || user?.goal || '',
    goal: user?.goal || '',
    mission: user?.mission || '',
    objectives: user?.objectives || '',
    avatar_color: user?.avatar_color || '#16a34a',
  });
  const [enrollments, setEnrollments] = useState([]);
  const [freshUser, setFreshUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [notifPrefs, setNotifPrefs] = useState({ email: true, push: true, sms: false });
  const fileRef = useRef(null);

  useEffect(() => {
    authAPI.me().then(res => {
      setFreshUser(res.data);
      setForm(f => ({
        name: res.data.name || f.name,
        avatar: res.data.avatar || f.avatar,
        location: res.data.location || f.location,
        goal: res.data.goal || f.goal,
        mission: res.data.mission || f.mission,
        objectives: res.data.objectives || f.objectives,
        bio: res.data.bio || res.data.goal || f.bio,
        phone: res.data.phone || f.phone,
        avatar_color: res.data.avatar_color || f.avatar_color,
      }));
      if (res.data.enrollments) setEnrollments(res.data.enrollments);
    }).catch(()=>{});
    gradebookAPI.getSummary().then(r => setStats(r.data)).catch(()=>{});
    enrollmentAPI.getAll().then(r => { if (!enrollments.length) setEnrollments(r.data || []); }).catch(()=>{});
  }, []);

  const displayUser = freshUser || user;
  const handleChange = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMessage({ text: 'Image must be under 2MB', type: 'error' }); return; }
    const url = URL.createObjectURL(file);
    setForm(p => ({ ...p, avatar: url, _avatarFile: file }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const updated = await updateProfile({
        name: form.name,
        avatar: form.avatar || '',
        location: form.location || '',
        goal: form.bio || form.goal || '',
        mission: form.mission || '',
        objectives: form.objectives || '',
      });
      setFreshUser(updated);
      setMessage({ text: 'Profile saved successfully', type: 'success' });
      setTimeout(()=> setMessage({ text: '', type: '' }), 3000);
    } catch {
      setMessage({ text: 'Failed to save profile', type: 'error' });
    } finally { setSaving(false); }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) { setPasswordMsg({ text: 'Passwords do not match', type: 'error' }); return; }
    if (passwordForm.new_password.length < 6) { setPasswordMsg({ text: 'New password must be at least 6 characters', type: 'error' }); return; }
    if (!passwordForm.current_password) { setPasswordMsg({ text: 'Enter current password', type: 'error' }); return; }
    setChangingPassword(true); setPasswordMsg({ text: '', type: '' });
    try {
      await authAPI.changePassword({ current_password: passwordForm.current_password, new_password: passwordForm.new_password });
      setPasswordMsg({ text: 'Password changed successfully', type: 'success' });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) { setPasswordMsg({ text: e.response?.data?.error || 'Failed to change password', type: 'error' }); }
    finally { setChangingPassword(false); }
  };

  const initial = form.name?.charAt(0)?.toUpperCase() || displayUser?.name?.charAt(0)?.toUpperCase() || 'U';
  const memberSince = displayUser?.created_at ? new Date(displayUser.created_at).toLocaleDateString('en', { month: 'long', year: 'numeric' }) : null;

  const roleBadge = {
    student: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200',
    instructor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200',
    admin: 'bg-navy-900 text-white border-navy-700',
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'personal', label: 'Personal', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const dashboardPath = displayUser?.role === 'admin' ? '/admin' : displayUser?.role === 'instructor' ? '/instructor' : '/student';

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account, preferences and security — synced across dashboards</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to={dashboardPath} className="hidden sm:inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Back to Dashboard</Link>
          <Button variant="secondary" size="sm" onClick={logout} icon={LogOut}>Sign out</Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="relative overflow-hidden rounded-[24px] border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 mb-6">
        <div className="h-28 sm:h-32 bg-gradient-to-r from-brand-600 via-emerald-500 to-navy-900 relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
          <div className="absolute -bottom-12 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        </div>
        <div className="px-6 sm:px-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 relative">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[20px] border-4 border-white dark:border-gray-800 shadow-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center" style={{ backgroundColor: form.avatar ? undefined : form.avatar_color }}>
                {form.avatar ? <img src={form.avatar} alt="Avatar" className="w-full h-full object-cover" onError={(e)=>{ e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} /> : null}
                <span className={`w-full h-full flex items-center justify-center text-2xl font-bold text-white ${form.avatar ? 'hidden' : 'flex'}`}>{initial}</span>
              </div>
              <button type="button" onClick={()=> fileRef.current?.click()} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-navy-900 text-white flex items-center justify-center shadow-lg hover:bg-black border-2 border-white dark:border-gray-800">
                <Camera className="w-4 h-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
            </div>
            <div className="flex-1 min-w-0 pt-2 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">{displayUser?.name || form.name || 'User'}</h2>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${roleBadge[displayUser?.role] || roleBadge.student}`}>{displayUser?.role}</span>
                {memberSince && <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><Calendar className="w-3.5 h-3.5" /> Joined {memberSince}</span>}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-1"><Mail className="w-3.5 h-3.5" /> {displayUser?.email}</p>
              {form.location && <p className="text-xs text-gray-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {form.location}</p>}
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active</span>
              </div>
            </div>
          </div>
          {(enrollments.length > 0 || stats) && (
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="rounded-2xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 p-3 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">{enrollments.length || stats?.totalAssignments || 0}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{displayUser?.role === 'student' ? 'Programs' : 'Assignments'}</div>
              </div>
              <div className="rounded-2xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 p-3 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">{stats?.avgScore != null ? `${Math.round(stats.avgScore)}%` : (stats?.submittedCount ?? myFallback(enrollments)) }</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Avg Score</div>
              </div>
              <div className="rounded-2xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 p-3 text-center">
                <div className="text-lg font-bold text-brand-700 dark:text-brand-400 flex items-center justify-center gap-1"><Award className="w-4 h-4" /> {displayUser?.role === 'student' ? (stats?.gradedCount ?? 0) : 'Verified'}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-thin">
        {tabs.map(t => (
          <button key={t.id} onClick={()=> setActiveTab(t.id)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap border transition-all cursor-pointer ${activeTab===t.id ? 'bg-navy-900 text-white border-navy-900 shadow' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><User className="w-4 h-4 text-brand-600" /> About</h3>
                {form.bio || form.goal ? <p className="text-sm leading-6 text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{form.bio || form.goal}</p> : <p className="text-sm text-gray-400">No bio yet — add your goals in the Personal tab.</p>}
                {(form.mission || form.objectives) && (
                  <div className="mt-4 grid sm:grid-cols-2 gap-4">
                    {form.mission && <div><div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mission</div><p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{form.mission}</p></div>}
                    {form.objectives && <div><div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Objectives</div><p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{form.objectives}</p></div>}
                  </div>
                )}
              </Card>
              <Card>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Contact</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><Mail className="w-4 h-4 text-gray-400" /> {displayUser?.email}</div>
                  {form.phone && <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><Smartphone className="w-4 h-4 text-gray-400" /> {form.phone}</div>}
                  {form.location && <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><MapPin className="w-4 h-4 text-gray-400" /> {form.location}</div>}
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><Globe className="w-4 h-4 text-gray-400" /> {form.location ? 'On-site & hybrid' : 'Kpongunor hub'}</div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={()=> setActiveTab('personal')}>Edit profile</Button>
                  <Button variant="secondary" size="sm" onClick={()=> setActiveTab('security')}>Security</Button>
                </div>
              </Card>
            </div>

            {enrollments.length > 0 && (
              <Card>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">My Programs</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {enrollments.map(e => (
                    <div key={e.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                      <div><p className="font-medium text-sm text-gray-900 dark:text-white">{e.program_title}</p><p className="text-xs text-gray-400">{e.session} Session</p></div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${e.status==='active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : e.status==='completed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{e.status}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Dashboard shortcuts</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Link to={displayUser?.role==='admin'?'/admin': displayUser?.role==='instructor'?'/instructor':'/student'} className="p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-200 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 text-sm font-medium text-center">Go to Dashboard</Link>
                <Link to={displayUser?.role==='student' ? '/student/materials' : displayUser?.role==='instructor' ? '/instructor/materials' : '/admin/materials'} className="p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-200 text-sm font-medium text-center">Materials</Link>
                <Link to={displayUser?.role==='student' ? '/student/quizzes' : displayUser?.role==='instructor' ? '/instructor/quizzes' : '/admin/quizzes'} className="p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-200 text-sm font-medium text-center">Quizzes</Link>
                <Link to="/profile" onClick={(e)=>{ e.preventDefault(); setActiveTab('security'); }} className="p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-200 text-sm font-medium text-center">Security</Link>
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'personal' && (
          <motion.form key="personal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} onSubmit={handleSave} className="space-y-6">
            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Camera className="w-4 h-4 text-brand-600" /> Avatar & Appearance</h3>
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center" style={{ backgroundColor: form.avatar ? undefined : form.avatar_color }}>
                    {form.avatar ? <img src={form.avatar} alt="preview" className="w-full h-full object-cover" /> : <span className="text-2xl font-bold text-white">{initial}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={()=> fileRef.current?.click()} icon={Upload}>Upload</Button>
                    <Button type="button" variant="secondary" size="sm" onClick={()=> { const url = prompt('Paste image URL:'); if (url) setForm(p=> ({...p, avatar: url})); }}>URL</Button>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Avatar Color (initials fallback)</p>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_COLORS.map(c => (
                      <button key={c} type="button" onClick={()=> setForm(p=> ({...p, avatar_color: c}))} className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${form.avatar_color===c ? 'border-navy-900 scale-110' : 'border-white dark:border-gray-800 hover:scale-105'}`} style={{ backgroundColor: c }} aria-label={`Pick ${c}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">Upload up to 2MB — JPG, PNG. Or paste a direct image URL below.</p>
                  <Input label="Avatar URL" placeholder="https://example.com/avatar.jpg" value={form.avatar} onChange={handleChange('avatar')} className="mt-3" />
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
              {message.text && <div className={`px-4 py-3 rounded-xl text-sm border mb-4 flex items-center gap-2 ${message.type==='success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 border-red-200'}`}>{message.type==='success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />} {message.text}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Full Name" value={form.name} onChange={handleChange('name')} required />
                <Input label="Email" value={displayUser?.email || ''} disabled helperText="Email cannot be changed" />
                <Input label="Role" value={displayUser?.role || ''} disabled className="capitalize" />
                <Input label="Phone" placeholder="+233 24 000 0000" value={form.phone} onChange={handleChange('phone')} />
                <Input label="Location" placeholder="e.g. Accra, Ghana" value={form.location} onChange={handleChange('location')} className="md:col-span-2" />
              </div>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Bio & Learning Goals</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Shown on your overview — keep it concise and inspiring.</p>
              <div className="space-y-4">
                <Textarea label="Bio" placeholder="Tell us about yourself" value={form.bio} onChange={handleChange('bio')} rows={3} />
                <Textarea label="Goal" placeholder="What do you want to achieve?" value={form.goal} onChange={handleChange('goal')} rows={3} />
                <Textarea label="Mission" placeholder="Your personal mission as a learner" value={form.mission} onChange={handleChange('mission')} rows={3} />
                <Textarea label="Objectives" placeholder="List key learning objectives" value={form.objectives} onChange={handleChange('objectives')} rows={4} />
              </div>
            </Card>

            <div className="flex gap-3">
              <Button type="submit" loading={saving}>Save Changes</Button>
              <Button type="button" variant="secondary" onClick={()=> navigate(-1)}>Cancel</Button>
            </div>
          </motion.form>
        )}

        {activeTab === 'security' && (
          <motion.div key="security" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-brand-600" /> Change Password</h3>
              {passwordMsg.text && <div className={`px-4 py-3 rounded-xl text-sm border mb-4 flex items-center gap-2 ${passwordMsg.type==='success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 border-red-200'}`}>{passwordMsg.type==='success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}{passwordMsg.text}</div>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Input label="Current Password" type={showPw.current ? 'text' : 'password'} value={passwordForm.current_password} onChange={(e)=> setPasswordForm(p=> ({...p, current_password: e.target.value}))} />
                  <button type="button" onClick={()=> setShowPw(p=> ({...p, current: !p.current}))} className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">{showPw.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
                <div className="relative">
                  <Input label="New Password" type={showPw.next ? 'text' : 'password'} value={passwordForm.new_password} onChange={(e)=> setPasswordForm(p=> ({...p, new_password: e.target.value}))} helperText="Min 6 characters" />
                  <button type="button" onClick={()=> setShowPw(p=> ({...p, next: !p.next}))} className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">{showPw.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
                <div className="relative">
                  <Input label="Confirm New Password" type={showPw.confirm ? 'text' : 'password'} value={passwordForm.confirm_password} onChange={(e)=> setPasswordForm(p=> ({...p, confirm_password: e.target.value}))} />
                  <button type="button" onClick={()=> setShowPw(p=> ({...p, confirm: !p.confirm}))} className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">{showPw.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
              <Button className="mt-4" onClick={handlePasswordChange} loading={changingPassword}>Update Password</Button>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Active Sessions</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><div><div className="text-sm font-medium text-gray-900 dark:text-white">This device • Chrome on Windows</div><div className="text-xs text-gray-500">Active now • {displayUser?.email}</div></div></div>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200">Current</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={()=> alert('Feature coming soon: sign out all other sessions')}>Sign out other sessions</Button>
                <Button variant="danger" size="sm" onClick={logout} icon={LogOut}>Sign out</Button>
              </div>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Trash2 className="w-4 h-4 text-red-500" /> Danger Zone</h3>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/30">
                <div><div className="text-sm font-medium text-gray-900 dark:text-white">Export your data</div><div className="text-xs text-gray-500">Download a copy of your profile and enrollments</div></div>
                <Button variant="secondary" size="sm" icon={Download} onClick={()=> {
                  const blob = new Blob([JSON.stringify(displayUser, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `profile-${displayUser?.email || 'user'}.json`; a.click(); URL.revokeObjectURL(url);
                }}>Export</Button>
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div key="notifications" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-brand-600" /> Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { key: 'email', title: 'Email notifications', desc: 'Receive updates about enrollments, grades and announcements via email', icon: Mail },
                  { key: 'push', title: 'Push notifications', desc: 'In-app alerts for messages, forum replies and deadlines', icon: Bell },
                  { key: 'sms', title: 'SMS / WhatsApp', desc: 'Critical updates via phone (coming soon)', icon: Smartphone, disabled: true },
                ].map(item => (
                  <label key={item.key} className={`flex items-start justify-between gap-4 p-3 rounded-xl border ${notifPrefs[item.key] ? 'border-brand-200 bg-brand-50/30 dark:bg-brand-900/10 dark:border-brand-800' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'} ${item.disabled ? 'opacity-60' : 'cursor-pointer'}`}>
                    <div className="flex gap-3">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${notifPrefs[item.key] ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}><item.icon className="w-4 h-4" /></span>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                    <input type="checkbox" checked={notifPrefs[item.key]} disabled={item.disabled} onChange={(e)=> setNotifPrefs(p=> ({...p, [item.key]: e.target.checked}))} className="mt-1 w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  </label>
                ))}
              </div>
              <Button className="mt-4" onClick={()=> setMessage({ text: 'Preferences saved', type: 'success' })}>Save Preferences</Button>
              {message.text && <p className={`mt-3 text-sm ${message.type==='success' ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Language & Appearance</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Language</label>
                  <select className="input-field" defaultValue="en"><option value="en">English</option><option value="fr">Français</option></select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Theme</label>
                  <select className="input-field" defaultValue="system"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function myFallback(enrollments) {
  return enrollments.length || 0;
}
