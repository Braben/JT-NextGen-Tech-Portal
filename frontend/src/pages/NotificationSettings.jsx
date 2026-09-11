import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { notificationSettingsAPI } from '../api';

export default function NotificationSettings() {
  const [settings, setSettings] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([notificationSettingsAPI.get(), notificationSettingsAPI.getLog()])
      .then(([sRes, lRes]) => {
        setSettings(sRes.data);
        setLog(lRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key) => {
    setSaving(true);
    const updated = { ...settings, [key]: settings[key] ? 0 : 1 };
    setSettings(updated);
    try {
      await notificationSettingsAPI.update(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  const handlePhoneChange = async (phone) => {
    const updated = { ...settings, phone };
    setSettings(updated);
    await notificationSettingsAPI.update(updated);
  };

  if (loading) return <LoadingSpinner />;

  const toggles = [
    { key: 'email_notifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
    { key: 'sms_notifications', label: 'SMS Notifications', desc: 'Receive notifications via SMS' },
    { key: 'notify_assignment', label: 'Assignment Alerts', desc: 'New assignments and deadlines' },
    { key: 'notify_grade', label: 'Grade Alerts', desc: 'When assignments are graded' },
    { key: 'notify_forum', label: 'Forum Activity', desc: 'Replies and updates in forums' },
    { key: 'notify_message', label: 'Direct Messages', desc: 'When someone sends you a message' },
    { key: 'notify_attendance', label: 'Attendance Updates', desc: 'When attendance is marked' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Notification Settings</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Manage how and when you receive notifications</p>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Preferences</h2>
          {saved && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Saved!</span>}
        </div>
        <div className="space-y-4">
          {toggles.map(t => (
            <div key={t.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.label}</p>
                <p className="text-xs text-gray-400">{t.desc}</p>
              </div>
              <button
                onClick={() => handleToggle(t.key)}
                disabled={saving}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings?.[t.key] ? 'bg-brand-600' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings?.[t.key] ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
        </div>
        {settings?.sms_notifications ? (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Phone Number (for SMS)</label>
            <input type="tel" className="input-field max-w-xs" placeholder="+1234567890" value={settings.phone || ''}
              onChange={e => handlePhoneChange(e.target.value)} />
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Notification Log</h2>
        {log.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No notifications sent yet</p>
        ) : (
          <div className="space-y-2">
            {log.map(l => (
              <div key={l.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 dark:text-gray-100 font-medium truncate">{l.subject || l.message}</p>
                  <p className="text-xs text-gray-400">{new Date(l.created_at).toLocaleString()} via {l.channel}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ml-3 ${l.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{l.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function LoadingSpinner() {
  return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>;
}
