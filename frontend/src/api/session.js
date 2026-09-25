import axios from 'axios';
import { validateApiResponse } from './responseValidation';

// Access tokens intentionally live only in memory. The browser owns the
// HttpOnly refresh cookie; JavaScript must never read or persist that secret.
let token = null;
let pendingRefresh = null;
let generation = 0;
const listeners = new Set();
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('jt-session');
export const cookieAPI = axios.create({ baseURL: '/api/auth', withCredentials: true,
  headers: { 'Content-Type': 'application/json', 'X-Portal-CSRF': '1' }, timeout: 20000 });
cookieAPI.interceptors.response.use(validateApiResponse);
export const getAccessToken = () => token;
export function setAccessToken(value) { token = value; listeners.forEach(listener => listener(value)); }
export function subscribeToken(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function clearSession(broadcast = true) {
  generation += 1;
  setAccessToken(null);
  if (broadcast) channel?.postMessage('logout');
}
if (channel) channel.onmessage = event => {
  if (event.data === 'logout' || event.data === 'account-changed') clearSession(false);
};

// Web Locks serializes cookie rotation between tabs. Single-flight below also
// coalesces React StrictMode startup and simultaneous failed API requests.
export const withSessionLock = callback => navigator.locks
  ? navigator.locks.request('jt-refresh-cookie', callback) : callback();
export function refreshSession() {
  if (!pendingRefresh) {
    const started = generation;
    pendingRefresh = withSessionLock(async () => {
      if (started !== generation) throw new Error('Session changed');
      const response = await cookieAPI.post('/refresh');
      if (started !== generation) throw new Error('Session changed');
      setAccessToken(response.data.token);
      return response.data;
    }).catch(error => {
      // A temporary network/503 failure must not erase a still-valid session.
      if (error.response?.status === 401) clearSession();
      throw error;
    }).finally(() => { pendingRefresh = null; });
  }
  return pendingRefresh;
}
export async function logoutSession() {
  await withSessionLock(() => cookieAPI.post('/logout'));
  clearSession();
}

export async function startSession(path, data, config) {
  // All cookie mutations use the same cross-tab lock. A startup refresh must
  // finish before login can replace the cookie for a newly selected account.
  return withSessionLock(async () => {
    const response = await cookieAPI.post(path, data, config);
    generation += 1;
    setAccessToken(response.data.token);
    channel?.postMessage('account-changed');
    return response;
  });
}
