import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';
import { getAccessToken, subscribeToken, refreshSession, logoutSession } from '../api/session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setToken] = useState(getAccessToken());
  const [restoreError, setRestoreError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    // One-time removal of legacy credentials; never restore a 24-hour token.
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    let active = true;
    setRestoreError('');
    setLoading(true);
    refreshSession().then(data => { if (active) setUser(data.user); })
      .catch(error => {
        if (active && error.response?.status !== 401) setRestoreError('We could not restore your session. Check your connection and try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [restoreAttempt]);

  useEffect(() => subscribeToken(value => { setToken(value); if (!value) setUser(null); }), []);
  useEffect(() => {
    if (!accessToken) return;
    // Refresh before expiry so WebSockets also reconnect with a fresh token.
    // HTTP's one-time retry remains the fallback for sleeping/background tabs.
    const timer = setTimeout(() => { refreshSession().catch(() => {}); }, 12 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [accessToken]);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    setUser(res.data.user);
    return res.data;
  };

  const register = async (data) => {
    const res = await authAPI.register(data);
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try {
      await logoutSession();
      setUser(null);
      window.location.href = '/login';
    } catch {
      // Keep the UI signed in until the server confirms cookie/session revocation.
      setLogoutError('Sign out could not reach the server. Please try again.');
    }
  };

  const updateProfile = async (data) => {
    const res = await authAPI.updateProfile(data);
    setUser(res.data);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, accessToken, login, register, logout, updateProfile }}>
      {logoutError && <div role="alert" className="bg-surface p-4 text-ink">{logoutError} <button className="btn-primary ml-3" onClick={logout}>Retry sign out</button></div>}
      {restoreError ? <main className="min-h-screen grid place-items-center p-6"><div className="card max-w-lg space-y-4"><p role="alert">{restoreError}</p><button className="btn-primary" onClick={() => setRestoreAttempt(value => value + 1)}>Retry connection</button></div></main> : children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
