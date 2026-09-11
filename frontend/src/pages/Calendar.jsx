import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { eventAPI, programAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_COLORS = {
  class: 'bg-blue-100 text-blue-700',
  deadline: 'bg-red-100 text-red-700',
  holiday: 'bg-brand-100 text-brand-700',
  exam: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-700',
};

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const emptyForm = { program_id: '', title: '', description: '', event_date: '', start_time: '', end_time: '', type: 'other', is_public: false };

export default function Calendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const isAdminOrInstructor = user?.role === 'admin' || user?.role === 'instructor';

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(formatDate(today.getFullYear(), today.getMonth(), today.getDate()));
  const [events, setEvents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([eventAPI.getAll({ start_date: formatDate(currentYear, currentMonth, 1), end_date: formatDate(currentYear, currentMonth, getDaysInMonth(currentYear, currentMonth)) }), programAPI.getAll()])
      .then(([eRes, pRes]) => { setEvents(eRes.data); setPrograms(pRes.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentYear, currentMonth]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear((y) => y - 1); setCurrentMonth(11); }
    else setCurrentMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear((y) => y + 1); setCurrentMonth(0); }
    else setCurrentMonth((m) => m + 1);
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const calendarDays = Array.from({ length: firstDay + daysInMonth }, (_, i) => {
    const day = i - firstDay + 1;
    return day > 0 ? day : null;
  });

  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const eventsByDate = {};
  events.forEach((ev) => {
    const d = ev.event_date?.slice(0, 10);
    if (d) {
      if (!eventsByDate[d]) eventsByDate[d] = [];
      eventsByDate[d].push(ev);
    }
  });

  const selectedEvents = eventsByDate[selectedDate] || [];

  const handleDateClick = (day) => {
    const d = formatDate(currentYear, currentMonth, day);
    setSelectedDate(d);
  };

  const handleFormChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await eventAPI.create(form);
      setForm(emptyForm);
      setShowForm(false);
      toast('Event created successfully', 'success');
      setEvents(prev => [...prev, res.data]);
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to create event', 'error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Delete this event? This cannot be undone.', { danger: true, title: 'Delete event', confirmText: 'Delete' });
    if (!ok) return;
    try {
      await eventAPI.delete(id);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      toast('Event deleted', 'info');
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to delete event', 'error');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Events Calendar</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">View and manage school events</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{MONTHS[currentMonth]} {currentYear}</h2>
              <div className="flex items-center gap-1.5">
                {isAdminOrInstructor && (
                  <button onClick={() => { setShowForm(!showForm); setForm(emptyForm); }} className="btn-primary text-sm">
                    {showForm ? 'Cancel' : 'Add Event'}
                  </button>
                )}
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors" aria-label="Previous month">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={() => { const y = today.getFullYear(); const m = today.getMonth(); setCurrentYear(y); setCurrentMonth(m); }} className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium px-2 hidden sm:inline">
                  Today
                </button>
                <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors" aria-label="Next month">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentYear}-${currentMonth}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="grid grid-cols-7 mb-2">
                  {DAYS.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {calendarDays.map((day, idx) => {
                    if (!day) return <div key={idx} />;
                    const dateStr = formatDate(currentYear, currentMonth, day);
                    const dayEvents = eventsByDate[dateStr] || [];
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === todayStr;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleDateClick(day)}
                        className={`relative p-2 text-sm rounded-lg transition-colors min-h-[48px] ${isSelected ? 'bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'} ${isToday ? 'font-bold' : ''}`}
                      >
                        <span className={`${isSelected ? 'text-brand-700 dark:text-brand-300' : isToday ? 'text-brand-600' : 'text-gray-700 dark:text-gray-300'}`}>
                          {day}
                        </span>
                        {dayEvents.length > 0 && (
                          <div className="flex justify-center gap-0.5 mt-1">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <span key={ev.id} className={`w-1.5 h-1.5 rounded-full ${TYPE_COLORS[ev.type]?.split(' ')[0] || 'bg-gray-400'}`} />
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">+{dayEvents.length - 3}</span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {showForm && isAdminOrInstructor && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <form onSubmit={handleAddEvent} className="card">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">New Event</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Program</label>
                    <select name="program_id" value={form.program_id} onChange={handleFormChange} className="input-field text-sm">
                      <option value="">General (no program)</option>
                      {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
                    <select name="type" value={form.type} onChange={handleFormChange} required className="input-field text-sm">
                      <option value="class">Class</option>
                      <option value="deadline">Deadline</option>
                      <option value="holiday">Holiday</option>
                      <option value="exam">Exam</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Title</label>
                    <input name="title" placeholder="Event title" value={form.title} onChange={handleFormChange} required className="input-field text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
                    <textarea name="description" placeholder="Description (optional)" value={form.description} onChange={handleFormChange} className="input-field text-sm" rows={2} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
                    <input name="event_date" type="date" value={form.event_date} onChange={handleFormChange} required className="input-field text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start</label>
                      <input name="start_time" type="time" value={form.start_time} onChange={handleFormChange} className="input-field text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End</label>
                      <input name="end_time" type="time" value={form.end_time} onChange={handleFormChange} className="input-field text-sm" />
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 sm:col-span-2">
                      <input name="is_public" type="checkbox" checked={!!form.is_public} onChange={handleFormChange} className="w-4 h-4" />
                      Public event — show on landing page
                    </label>
                  )}
                  <button type="submit" disabled={submitting} className="btn-primary text-sm sm:col-span-2">
                    {submitting ? 'Saving...' : 'Create Event'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </div>

        <div>
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Select a date'}
            </h3>
            <AnimatePresence mode="wait">
              {selectedEvents.length === 0 ? (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center"
                >
                  No events on this day
                </motion.p>
              ) : (
                <motion.div
                  key={selectedDate}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  {selectedEvents.map((ev) => (
                    <div key={ev.id} className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{ev.title}</p>
                          {ev.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{ev.description}</p>}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[ev.type] || TYPE_COLORS.other}`}>
                              {ev.type}
                            </span>
                            {ev.program_name && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">{ev.program_name}</span>
                            )}
                            {(ev.start_time || ev.end_time) && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {ev.start_time?.slice(0, 5)}{ev.start_time && ev.end_time ? ' - ' : ''}{ev.end_time?.slice(0, 5)}
                              </span>
                            )}
                          </div>
                        </div>
                        {user?.role === 'admin' && (
                          <button onClick={() => handleDelete(ev.id)} className="text-xs text-red-600 hover:text-red-700 whitespace-nowrap flex-shrink-0 mt-0.5" aria-label="Delete event">Delete</button>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="card mt-4">
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Legend</h4>
            <div className="space-y-1.5">
              {Object.entries(TYPE_COLORS).map(([type, classes]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${classes}`}>{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
