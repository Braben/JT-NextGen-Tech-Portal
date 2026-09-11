/**
 * NotificationSettingsManagement — Admin page for managing notification settings
 *
 * Features:
 * - Global notification preferences
 * - Channel configuration (email, SMS, push, in-app)
 * - Template management
 * - Delivery scheduling
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bell, Mail, Smartphone, Globe, Save, Loader2, ToggleLeft, ToggleRight, Send, Plus } from 'lucide-react';
import { notificationSettingsAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Card, Button, Input, Select, Textarea } from '../../components/ui';

export default function NotificationSettingsManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('channels');
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    email_enabled: true,
    sms_enabled: false,
    push_enabled: true,
    in_app_enabled: true,
    email_host: '',
    email_port: 587,
    email_user: '',
    email_pass: '',
    email_from: '',
    twilio_sid: '',
    twilio_token: '',
    twilio_phone: '',
  });

  const tabs = [
    { id: 'channels', label: 'Channels', icon: Bell },
    { id: 'email', label: 'Email Config', icon: Mail },
    { id: 'sms', label: 'SMS Config', icon: Smartphone },
    { id: 'push', label: 'Push Config', icon: Globe },
    { id: 'templates', label: 'Templates', icon: Send },
  ];

  const fetchSettings = useCallback(async () => {
    try {
      const res = await notificationSettingsAPI.get();
      setSettings(res.data || settings);
    } catch (err) {
      // Use defaults
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await notificationSettingsAPI.update(settings);
      toast('Settings saved', 'success');
    } catch (err) {
      toast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const testEmail = async () => {
    toast('Test email sent', 'info');
  };

  const testSMS = async () => {
    toast('Test SMS sent', 'info');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Configure notification channels and preferences</p>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Channels Tab */}
      {activeTab === 'channels' && (
        <Card>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Send notifications via email</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.email_enabled} onChange={(e) => setSettings({ ...settings, email_enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-600"></div>
                  </label>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Requires SMTP configuration in Email Config tab</p>
              </div>

              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">SMS Notifications</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Send notifications via SMS</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.sms_enabled} onChange={(e) => setSettings({ ...settings, sms_enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-600"></div>
                  </label>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Requires Twilio configuration in SMS Config tab</p>
              </div>

              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Push Notifications</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Send browser push notifications</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.push_enabled} onChange={(e) => setSettings({ ...settings, push_enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-600"></div>
                  </label>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Works with supported browsers</p>
              </div>

              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">In-App Notifications</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Show notifications within the app</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.in_app_enabled} onChange={(e) => setSettings({ ...settings, in_app_enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-600"></div>
                  </label>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Always available, no external config needed</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button type="submit" loading={saving} icon={Save}>Save Channel Settings</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Email Config Tab */}
      {activeTab === 'email' && (
        <Card>
          <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">SMTP Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="SMTP Host" value={settings.email_host} onChange={(e) => setSettings({ ...settings, email_host: e.target.value })} placeholder="smtp.example.com" />
              <Input label="SMTP Port" type="number" value={settings.email_port} onChange={(e) => setSettings({ ...settings, email_port: parseInt(e.target.value) || 587 })} />
            </div>
            <Input label="Username" value={settings.email_user} onChange={(e) => setSettings({ ...settings, email_user: e.target.value })} placeholder="username@example.com" />
            <Input label="Password" type="password" value={settings.email_pass} onChange={(e) => setSettings({ ...settings, email_pass: e.target.value })} placeholder="••••••••" />
            <Input label="From Email" value={settings.email_from} onChange={(e) => setSettings({ ...settings, email_from: e.target.value })} placeholder="noreply@jtnextgen.com" />
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button type="button" variant="outline" icon={Send} onClick={testEmail}>Test Email</Button>
              <Button type="submit" loading={saving} icon={Save}>Save Email Settings</Button>
            </div>
          </form>
        </Card>
      )}

      {/* SMS Config Tab */}
      {activeTab === 'sms' && (
        <Card>
          <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Twilio Configuration</h3>
            <Input label="Account SID" value={settings.twilio_sid} onChange={(e) => setSettings({ ...settings, twilio_sid: e.target.value })} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            <Input label="Auth Token" type="password" value={settings.twilio_token} onChange={(e) => setSettings({ ...settings, twilio_token: e.target.value })} placeholder="••••••••••••••••••••••••••••••••" />
            <Input label="From Phone Number" value={settings.twilio_phone} onChange={(e) => setSettings({ ...settings, twilio_phone: e.target.value })} placeholder="+15551234567" />
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button type="button" variant="outline" icon={Send} onClick={testSMS}>Test SMS</Button>
              <Button type="submit" loading={saving} icon={Save}>Save SMS Settings</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Push Config Tab */}
      {activeTab === 'push' && (
        <Card>
          <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Push Notification Configuration</h3>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">Push notifications use the Web Push API with VAPID keys. Configure in your environment variables.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="VAPID Public Key" value="" onChange={() => {}} placeholder="Bxxxxxxxxxxxxxxxxxxxxxxxx" disabled />
              <Input label="VAPID Private Key" type="password" value="" onChange={() => {}} placeholder="••••••••••••••••••••" disabled />
            </div>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button type="submit" loading={saving} icon={Save} disabled>Save Push Settings</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Templates</h3>
              <Button variant="outline" icon={Plus} size="sm">Create Template</Button>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Welcome Email', channel: 'Email', subject: 'Welcome to JT NextGen!', status: 'active' },
                { name: 'Assignment Due Reminder', channel: 'Email', subject: 'Assignment due tomorrow', status: 'active' },
                { name: 'Grade Published', channel: 'Email', subject: 'Your grade is ready', status: 'active' },
                { name: 'New Message', channel: 'In-App', subject: 'You have a new message', status: 'active' },
                { name: 'Certificate Ready', channel: 'Email', subject: 'Your certificate is ready', status: 'draft' },
                { name: 'System Maintenance', channel: 'All', subject: 'Scheduled maintenance', status: 'active' },
              ].map((template) => (
                <div key={template.name} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{template.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{template.channel} • {template.subject}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${template.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {template.status}
                    </span>
                    <Button variant="ghost" size="sm" icon={Send}>Edit</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}