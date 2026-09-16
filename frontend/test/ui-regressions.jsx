// Local browser fixture: npm run dev, then /test/ui-regressions.html.
// Uses real components with in-memory API responses; never creates real accounts.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Input, Textarea, Select, Modal } from '../src/components/ui';
import { ToastProvider } from '../src/context/ToastContext';
import { AuthProvider } from '../src/context/AuthContext';
import { authAPI, programAPI, systemAPI, adminAPI, enrollmentAPI, classAPI } from '../src/api';
import Register from '../src/pages/public/Register';
import SystemManagement from '../src/pages/admin/SystemManagement';
import EnrollmentsManagement from '../src/pages/admin/EnrollmentsManagement';
import '../src/index.css';

const mode = new URLSearchParams(location.search).get('mode') || 'modal';
if (localStorage.getItem('token') === 'local-fixture-token') {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
const savedAuth = { token: localStorage.getItem('token'), user: localStorage.getItem('user') };
const savedDraft = sessionStorage.getItem('jtng.registrationDraft.v2');
function Submitted() {
  useEffect(() => {
    for (const [key, value] of Object.entries(savedAuth)) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    if (savedDraft !== null) sessionStorage.setItem('jtng.registrationDraft.v2', savedDraft);
  }, []);
  return <h1>Application submitted successfully</h1>;
}
let healthCalls = 0;
systemAPI.health = async () => {
  healthCalls++;
  if (mode === 'failure' && healthCalls === 1) throw new Error('Simulated network failure');
  if (mode === 'timeout') throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' });
  return { data: { status: mode === 'degraded' ? 'degraded' : 'ok', database: { type: 'postgres', status: mode === 'degraded' ? 'error' : 'ok' }, uploads: { status: 'ok' }, uptimeSeconds: 123, timestamp: new Date().toISOString() } };
};
let programCalls = 0;
programAPI.getAll = async () => {
  if (mode === 'program-failure' && ++programCalls === 1) throw new Error('Simulated network failure');
  return { data: [{ id: 'test-program', title: 'Test Program', duration: '3 months' }] };
};
authAPI.register = async (data) => {
  if (!data.consent || data.program_id !== 'test-program') throw new Error('Invalid application payload');
  return { data: { token: 'local-fixture-token', user: { id: 'fixture', name: data.name, role: 'student' } } };
};
authAPI.me = async () => ({ data: { id: 'fixture', role: 'student' } });

if (mode === 'enrollment') {
  const programs = [{ id: 'a', title: 'Computing' }, { id: 'b', title: 'Web Development' }];
  const classes = [
    { id: 'am', program_id: 'a', session: 'Morning', name: 'Computing Morning', code: 'CM', status: 'active' },
    { id: 'be', program_id: 'b', session: 'Evening', name: 'Web Evening', code: 'WE', status: 'active' },
  ];
  let row = { id: 'enrollment', student_name: 'Test Student', student_email: 'test@example.com', program_id: 'a', program_title: 'Computing', class_id: 'am', class_name: 'Computing Morning', class_code: 'CM', session: 'Morning', status: 'pending', enrolled_at: '2026-09-16' };
  programAPI.getAll = async () => ({ data: programs });
  classAPI.getAll = async () => ({ data: classes });
  adminAPI.getEnrollments = async () => ({ data: [row] });
  enrollmentAPI.update = async (_id, data) => {
    row = { ...row, ...data };
    return { data: row };
  };
}

function ModalFixture() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', notes: '', session: 'Morning' });
  const change = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  return <>
    <button onClick={() => setOpen(true)}>Open form</button>
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Typing regression">
      <Input label="Name" value={form.name} onChange={change('name')} />
      <Input label="Email" type="email" value={form.email} onChange={change('email')} />
      <Textarea label="Notes" value={form.notes} onChange={change('notes')} />
      <Select label="Session" value={form.session} onChange={change('session')} options={['Morning', 'Evening'].map(value => ({ value, label: value }))} />
      <button disabled>Disabled last button</button>
    </Modal>
    <output>{JSON.stringify(form)}</output>
  </>;
}

createRoot(document.getElementById('root')).render(
  <ToastProvider>
    {mode === 'enrollment' ? <MemoryRouter><EnrollmentsManagement /></MemoryRouter> : mode === 'modal' ? <ModalFixture /> : ['register', 'program-failure'].includes(mode) ?
      <AuthProvider><MemoryRouter initialEntries={['/register/account']}><Routes>
        <Route path="/register/:page" element={<Register />} />
        <Route path="/student" element={<Submitted />} />
      </Routes></MemoryRouter></AuthProvider> : <SystemManagement />}
  </ToastProvider>
);
