// Real role layouts and dashboards, with local data only. Not a production entry.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import * as api from '../src/api';
import { AuthProvider } from '../src/context/AuthContext';
import { SocketProvider } from '../src/context/SocketContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import AdminLayout from '../src/layouts/AdminLayout';
import InstructorLayout from '../src/layouts/InstructorLayout';
import StudentLayout from '../src/layouts/StudentLayout';
import AdminDashboard from '../src/pages/admin/AdminDashboard';
import InstructorDashboard from '../src/pages/InstructorDashboard';
import StudentDashboard from '../src/pages/StudentDashboard';
import EnrollmentsManagement from '../src/pages/admin/EnrollmentsManagement';
import ProgramsManagement from '../src/pages/admin/ProgramsManagement';
import MaterialsManagement from '../src/pages/admin/MaterialsManagement';
import SystemManagement from '../src/pages/admin/SystemManagement';
import { Card, Button, Input, Select } from '../src/components/ui';
import { DonutChart, LineChart } from '../src/components/admin/Charts';
import '../src/index.css';

const params = new URLSearchParams(location.search);
const role = params.get('role') || 'student';
const long = 'Advanced Software Engineering and Digital Technology Professional Development';
const unbroken = 'VeryLongUnbrokenCourseReference'.repeat(5);
const rows = Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}`, name: long, title: `${long} ${index + 1}`, code: unbroken, program_id: 'program', program_title: long, class_id: 'class', class_name: long, class_code: unbroken, status: 'active', session: 'Evening', active_count: 124, allocated_count: 130, capacity: 150, enrolled_at: '2026-09-16', due_date: '2026-09-30', event_date: '2026-09-30', submissionCount: 123, totalStudents: 150, forum_category_id: 'forum', description: unbroken }));
for (const [name, group] of Object.entries(api)) {
  if (!name.endsWith('API')) continue;
  for (const method of Object.keys(group)) group[method] = async () => ({ data: [] });
}
api.authAPI.me = async () => { throw new Error('Fixture does not use an authenticated session'); };
api.assignmentAPI.getAll = api.classAPI.getAll = api.eventAPI.getPublic = api.materialAPI.getAll = async () => ({ data: rows });
api.programAPI.getAll = async () => ({ data: [{ id: 'program', title: long, description: unbroken, duration: '12 months', level: 'Advanced', outcomes: [long, unbroken] }] });
api.enrollmentAPI.getAll = api.adminAPI.getEnrollments = async () => ({ data: rows.map(row => ({ ...row, student_name: long, student_email: `${unbroken}@example.com` })) });
api.submissionAPI.my = async () => ({ data: rows.map((row) => ({ ...row, assignment_id: row.id, status: 'graded', score: 85, max_score: 100 })) });
api.gradebookAPI.getSummary = async () => ({ data: { totalSubmissions: 123456, graded: 100000, gradedCount: 5, submittedCount: 5, totalStudents: 10000, avgScore: 85 } });
api.attendanceAPI.getSummary = async () => ({ data: { present: 100, late: 4, absent: 5, excused: 2, total: 111, percentage: 94 } });
api.adminAPI.getStats = async () => ({ data: { activeStudents: 123456, programs: 100, instructors: 123, certificates: 98765, activeEnrollments: 124567 } });
api.systemAPI.health = async () => ({ data: { status: 'ok', database: { status: 'ok' }, uploads: { status: 'ok' }, uptimeSeconds: 1000 } });

const layouts = { admin: AdminLayout, instructor: InstructorLayout, student: StudentLayout };
const admission = params.get('admission');
if (admission) {
  api.enrollmentAPI.getAll = async () => ({ data: [{ id: 'application', program_title: long, status: admission === 'active' ? 'active' : 'pending', session: 'Morning' }] });
  api.onboardingAPI.my = async () => {
    if (admission === 'error') throw new Error('Status unavailable');
    return { data: ['pending', 'active'].includes(admission) ? [] : [{ id: 'aptitude', enrollment_id: 'application', status: admission }] };
  };
}
const dashboards = { admin: AdminDashboard, instructor: InstructorDashboard, student: StudentDashboard };
const Layout = layouts[role] || StudentLayout;
const managementPages = { enrollments: EnrollmentsManagement, programs: ProgramsManagement, materials: MaterialsManagement, system: SystemManagement };
const Dashboard = managementPages[params.get('page')] || dashboards[role] || StudentDashboard;
if (params.get('theme') === 'dark') document.documentElement.classList.add('dark');

function StressCards() {
  return <section className="grid gap-4 sm:grid-cols-2 mt-6" aria-label="Long content checks">
    <Card><h2>{long}</h2><p>{unbroken}</p><Input label="Course reference" value={unbroken} readOnly /><Select label="Long program option" options={[{value:'test', label:long}]} /><Button>{long}</Button></Card>
    <Card><DonutChart size={220} data={[{label:long,value:123456},{label:unbroken,value:123}]} centerValue="99%" centerLabel="Progress" /><LineChart height={120} data={[[1,2,3]]} labels={['First assessment','Second assessment','Final assessment']} showLegend={false} /><p>Content following the chart must remain below its labels.</p></Card>
  </section>;
}
createRoot(document.getElementById('root')).render(<AuthProvider><SocketProvider><ToastProvider><ConfirmProvider><MemoryRouter initialEntries={[`/${role}`]}><Routes><Route element={<Layout />}><Route path={`/${role}`} element={<><Dashboard /><StressCards /></>} /></Route></Routes></MemoryRouter></ConfirmProvider></ToastProvider></SocketProvider></AuthProvider>);
