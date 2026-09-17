const db = require('../config/db');
const { instructorProgramIds, isAdmin } = require('./accessControl');
module.exports = async function eventInput(body, user, existing = {}) {
  const value = { ...existing, ...body };
  const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  const program = !value.program_id || value.program_id === 'none' ? null : value.program_id;
  if (program && !await db.prepare('SELECT id FROM programs WHERE id = ?').get(program)) fail('Select an existing program');
  if (!isAdmin(user) && program && !(await instructorProgramIds(db, user)).includes(program)) fail('You can only schedule events for your programs', 403);
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!title || title.length > 200) fail('Enter an event title of 1–200 characters');
  const date = value.event_date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) fail('Enter a valid event date');
  const start = value.start_time || '', end = value.end_time || '';
  if ([start, end].some(t => t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) fail('Enter valid start and end times');
  if (end && (!start || end <= start)) fail('End time must be after start time');
  if (!['class','deadline','holiday','exam','other'].includes(value.type || 'other')) fail('Select a valid event type');
  if (body.is_public !== undefined && ![true,false,0,1].includes(body.is_public)) fail('Public visibility must be true or false');
  return { program_id: program, title, description: typeof value.description === 'string' ? value.description.trim().slice(0,1000) : '', event_date: date, start_time: start, end_time: end, type: value.type || 'other', is_public: isAdmin(user) ? (value.is_public ? 1 : 0) : (existing.is_public || 0) };
};
