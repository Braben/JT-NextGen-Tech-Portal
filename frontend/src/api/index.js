import axios from 'axios';
import { validateApiResponse } from './responseValidation';

// API base URL.
// Default '/api' — same-origin (backend serves the built frontend in production,
// or the Vite dev server proxies /api in development).
// Override for a separate-frontend deployment: VITE_API_URL=http://host:5000/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

export const systemAPI = {
  health: () => api.get('/health', {
    timeout: 20000,
    // A degraded health report is useful data, even when the server returns 503.
    validateStatus: (status) => status === 200 || status === 503,
  }),
  healthUrl: () => api.getUri({ url: '/health' }),
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  validateApiResponse,
  (err) => {
    const authFormPath = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];
    const isAuthFormRequest = authFormPath.some((path) => err.config?.url?.startsWith(path));

    // Only protected-session failures should log the user out. Public auth
    // form failures must stay on the form so validation messages remain usable.
    if (err.response?.status === 401 && !isAuthFormRequest && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data, { timeout: 60000 }),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

export const certificateAPI = {
  verify: (serial) => api.get(`/certificates/verify/${encodeURIComponent(serial)}`),
};

export const assignmentAPI = {
  getAll: () => api.get('/assignments'),
  get: (id) => api.get(`/assignments/${id}`),
  create: (data) => api.post('/assignments', data),
  update: (id, data) => api.put(`/assignments/${id}`, data),
  delete: (id) => api.delete(`/assignments/${id}`),
};

export const submissionAPI = {
  my: () => api.get('/submissions/my'),
  get: (id) => api.get(`/submissions/${id}`),
  byAssignment: (id) => api.get(`/submissions/assignment/${id}`),
  create: (data) => api.post('/submissions', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.put(`/submissions/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const gradingAPI = {
  aiGrade: (submissionId) => api.post(`/grading/ai/${submissionId}`),
  manualGrade: (submissionId, data) => api.put(`/grading/manual/${submissionId}`, data),
};

export const gradebookAPI = {
  getAll: () => api.get('/gradebook'),
  getSummary: () => api.get('/gradebook/summary'),
};

export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const chatbotAPI = {
  ask: (data) => api.post('/chatbot/ask', data),
  askPublic: (data) => api.post('/chatbot/ask-public', data),
};

export const programAPI = {
  getAll: () => api.get('/programs', { timeout: 60000 }),
  get: (slug) => api.get(`/programs/${slug}`),
  create: (data) => api.post('/programs', data),
  update: (id, data) => api.put(`/programs/${id}`, data),
  delete: (id) => api.delete(`/programs/${id}`),
};

export const classAPI = {
  getAll: () => api.get('/program-classes'),
  create: (data) => api.post('/program-classes', data),
  update: (id, data) => api.put(`/program-classes/${id}`, data),
  getRoster: (id) => api.get(`/program-classes/${id}/roster`),
  allocate: (id, enrollmentIds) => api.post(`/program-classes/${id}/allocate`, { enrollment_ids: enrollmentIds }),
  sendMessage: (id, content) => api.post(`/program-classes/${id}/message`, { content }),
};

export const enrollmentAPI = {
  getAll: () => api.get('/enrollments'),
  create: (data) => api.post('/enrollments', data),
  update: (id, data) => api.put(`/enrollments/${id}`, data),
};

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (role) => api.get(`/admin/users${role ? `?role=${role}` : ''}`),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getCertificates: () => api.get('/admin/certificates'),
  createCertificate: (data) => api.post('/admin/certificates', data),
  updateCertificate: (id, data) => api.put(`/admin/certificates/${id}`, data),
  getEnrollments: () => api.get('/admin/enrollments'),
  getOnboardingAssessments: () => api.get('/admin/onboarding-assessments'),
  recommendOnboardingAssessment: (enrollmentId) => api.post('/admin/onboarding-assessments/recommend', { enrollment_id: enrollmentId }),
  gradeOnboardingAssessment: (id, data) => api.put(`/admin/onboarding-assessments/${id}/grade`, data),
  getContacts: () => api.get('/admin/contacts'),
  submitContact: (data) => api.post('/admin/contacts', data),
  getAuditLog: (params) => api.get('/admin/audit', { params }),
  getLoginAttempts: (params) => api.get('/admin/security/login-attempts', { params }),
  getBroadcasts: () => api.get('/admin/broadcasts'),
  sendBroadcast: (data) => api.post('/admin/broadcasts', data),
};

export const onboardingAPI = {
  my: () => api.get('/onboarding-assessments/my'),
  submit: (id, data) => api.put(`/onboarding-assessments/${id}/submit`, data),
};

export const messageAPI = {
  getConversations: () => api.get('/messages/conversations'),
  getUsers: () => api.get('/messages/users'),
  getMessages: (userId, params) => api.get(`/messages/${userId}`, { params }),
  send: (userId, content) => api.post(`/messages/${userId}`, { content }),
  markRead: (userId) => api.put(`/messages/${userId}/read`),
  delete: (messageId) => api.delete(`/messages/${messageId}`),
  search: (params) => api.get('/messages/search', { params }),
  getUnreadCounts: () => api.get('/messages/conversations/unread-counts'),
};

export const forumAPI = {
  getCategories: () => api.get('/forums/categories'),
  createCategory: (data) => api.post('/forums/categories', data),
  getCategory: (categoryId) => api.get(`/forums/categories/${categoryId}`),
  createTopic: (categoryId, data) => api.post(`/forums/categories/${categoryId}/topics`, data),
  getTopic: (topicId) => api.get(`/forums/topics/${topicId}`),
  createReply: (topicId, data) => api.post(`/forums/topics/${topicId}/replies`, data),
  pinTopic: (topicId) => api.put(`/forums/topics/${topicId}/pin`),
  closeTopic: (topicId) => api.put(`/forums/topics/${topicId}/close`),
  likeTopic: (topicId) => api.post(`/forums/topics/${topicId}/like`),
  likeReply: (replyId) => api.post(`/forums/replies/${replyId}/like`),
  rateReply: (replyId, rating) => api.post(`/forums/replies/${replyId}/rate`, { rating }),
};

export const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }),
  getSummary: () => api.get('/attendance/summary'),
  getStudents: () => api.get('/attendance/students'),
  getStudent: (studentId) => api.get(`/attendance/students/${studentId}`),
  getSessions: () => api.get('/attendance/sessions'),
  getActiveSessions: () => api.get('/attendance/sessions/active'),
  getSession: (id) => api.get(`/attendance/sessions/${id}`),
  createSession: (data) => api.post('/attendance/sessions', data),
  updateSession: (id, data) => api.put(`/attendance/sessions/${id}`, data),
  deleteSession: (id) => api.delete(`/attendance/sessions/${id}`),
  closeSession: (id) => api.post(`/attendance/sessions/${id}/close`),
  overrideStudent: (sessionId, studentId, data) => api.put(`/attendance/sessions/${sessionId}/students/${studentId}`, data),
  selfMark: (sessionId) => api.post('/attendance/self-mark', { session_id: sessionId }),
};

export const notificationSettingsAPI = {
  get: () => api.get('/notification-settings'),
  update: (data) => api.put('/notification-settings', data),
  getLog: () => api.get('/notification-settings/log'),
};

export const materialAPI = {
  getAll: (params) => api.get('/materials', { params }),
  createMulti: (formData) => api.post('/materials', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  create: (data) => api.post('/materials', data),
  update: (id, data) => api.put(`/materials/${id}`, data),
  delete: (id) => api.delete(`/materials/${id}`),
};

export const fileAPI = {
  material: (id) => api.get(`/files/materials/${id}`, { responseType: 'blob' }),
  submission: (id) => api.get(`/files/submissions/${id}`, { responseType: 'blob' }),
};

export function openBlobDownload(response, fallbackName = 'download') {
  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.click();
  URL.revokeObjectURL(url);
}

export const eventAPI = {
  getAll: (params) => api.get('/events', { params }),
  getPublic: () => api.get('/events/public'),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
};

export const blogAPI = {
  getAll: (params) => api.get('/blogs', { params }),
  get: (slug) => api.get(`/blogs/${slug}`),
  getAdmin: () => api.get('/blogs/admin'),
  create: (data) => api.post('/blogs/admin', data),
  update: (id, data) => api.put(`/blogs/admin/${id}`, data),
  delete: (id) => api.delete(`/blogs/admin/${id}`),
  manage: () => api.get('/blogs/manage'),
  save: (id, data) => id ? api.put(`/blogs/manage/${id}`, data) : api.post('/blogs/manage', data),
  remove: (id) => api.delete(`/blogs/manage/${id}`),
};

export const socialAPI = {
  get: () => api.get('/social-links'),
  update: (data) => api.put('/social-links', data),
};

export const quizAPI = {
  getAll: (params) => api.get('/quizzes', { params }),
  get: (id) => api.get(`/quizzes/${id}`),
  create: (data) => api.post('/quizzes', data),
  submit: (id, data) => api.post(`/quizzes/${id}/submit`, data),
  getSubmissions: (id) => api.get(`/quizzes/${id}/submissions`),
  getSubmission: (submissionId) => api.get(`/quizzes/submissions/${submissionId}`),
  delete: (id) => api.delete(`/quizzes/${id}`),
};

export const paymentAPI = {
  getAll: () => api.get('/payments'),
  create: (data) => api.post('/payments', data),
  pay: (id, amount) => api.put(`/payments/${id}/pay`, { amount }),
  delete: (id) => api.delete(`/payments/${id}`),
};

export const progressAPI = {
  getDashboard: () => api.get('/gradebook/summary'),
  getAttendanceSummary: () => api.get('/attendance/summary'),
  getQuizPerformance: () => api.get('/quizzes', { params: { all: 'true' } }),
};

export default api;
