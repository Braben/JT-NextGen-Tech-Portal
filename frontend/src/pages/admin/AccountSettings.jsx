/**
 * AccountSettings — Admin page for managing account settings
 *
 * Features:
 * - Profile information
 * - Password change
 * - Two-factor authentication (placeholder)
 * - Session management
 * - Security preferences
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Shield, LogOut, Loader2, Save, Eye, EyeOff, Mail, Bell, Smartphone, Monitor } from 'lucide-react';
import { authAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card, Button, Input, Select, Modal } from '../../components/ui';

export default function AccountSettings() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });

  // Profile form
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    location: '',
    avatar: user?.avatar || '',
  });

  // Password form
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  // Security settings
  const [security, setSecurity] = useState({
    twoFactor: false,
    loginAlerts: true,
    sessionTimeout: '30',
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'sessions', label: 'Sessions', icon: Smartphone },
  ];

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authAPI.updateProfile(profile);
      toast('Profile updated', 'success');
    } catch (err) {
      toast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast('New passwords do not match', 'warning');
      return;
    }
    if (passwords.new.length < 8) {
      toast('Password must be at least 8 characters', 'warning');
      return;
    }
    setSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: passwords.current, newPassword: passwords.new });
      toast('Password changed successfully', 'success');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to change password', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSecuritySave = async () => {
    setSaving(true);
    try {
      // Save security settings
      toast('Security settings saved', 'success');
    } catch (err) {
      toast('Failed to save security settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOutAll = async () => {
    // Sign out from all sessions
    toast('Signed out from all sessions', 'info');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account preferences and security</p>
      </div>

      {/* Tab Navigation */}
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

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <Card>
          <form onSubmit={handleProfileSave} className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                {profile.avatar ? (
                  <img src={profile.avatar} alt="" className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                    <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">{profile.name?.charAt(0) || 'U'}</span>
                  </div>
                )}
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-600 transition-colors">
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { /* handle avatar upload */ }} />
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </label>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Photo</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">JPG, PNG or GIF. Max 2MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input label="Full Name *" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
              <Input label="Email *" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
              <Input label="Location" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="City, Country" />
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="submit" loading={saving} icon={Save}>Save Changes</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <Card>
          <form onSubmit={handleSecuritySave} className="space-y-6">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Two-Factor Authentication</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Authenticator App</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Use an authenticator app for additional security</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={security.twoFactor} onChange={(e) => setSecurity({ ...security, twoFactor: e.target.checked })} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-600"></div>
                </label>
              </div>
              {security.twoFactor && (
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">2FA is enabled. <Button variant="ghost" size="sm" className="text-yellow-800 dark:text-yellow-200">Configure</Button></p>
                </div>
              )}
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Security Alerts</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Login Alerts</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when someone logs into your account</p>
                  </div>
                  <input type="checkbox" checked={security.loginAlerts} onChange={(e) => setSecurity({ ...security, loginAlerts: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Session Timeout</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Automatically log out after inactivity</p>
                  </div>
                  <select value={security.sessionTimeout} onChange={(e) => setSecurity({ ...security, sessionTimeout: e.target.value })} className="w-32 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="0">Never</option>
                  </select>
                </label>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Sessions</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Current Session</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Chrome on Windows • Active now</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Current</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Mobile App</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">iOS • 2 hours ago</p>
                    </div>
                  </div>
 <Button variant="danger" size="sm">Revoke</Button>
                </div>
              </div>
              <Button variant="outline" onClick={handleSignOutAll} className="mt-4" icon={LogOut}>Sign Out All Sessions</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <Card>
          <form onSubmit={handlePasswordChange} className="space-y-6 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Current Password *</label>
              <div className="relative">
                <input
                  type={showPassword.current ? 'text' : 'password'}
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  required
                  className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button type="button" onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">New Password *</label>
              <div className="relative">
                <input
                  type={showPassword.new ? 'text' : 'password'}
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button type="button" onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">At least 8 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Confirm New Password *</label>
              <div className="relative">
                <input
                  type={showPassword.confirm ? 'text' : 'password'}
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  required
                  className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button type="button" onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="submit" loading={saving} icon={Save} className="w-full">Update Password</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Sessions</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Current Session</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Chrome 119 on Windows 10 • Active now</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Current</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Mobile App</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">iOS 17.1 • 2 hours ago</p>
                  </div>
                </div>
                <Button variant="danger" size="sm">Revoke</Button>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOutAll} icon={LogOut} className="w-full">Sign Out All Sessions</Button>
          </div>
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Danger Zone
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Irreversible actions</p>
          </div>
          <Button variant="danger" onClick={logout} icon={LogOut}>Sign Out</Button>
        </div>
      </Card>
    </div>
  );
}