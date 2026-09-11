const { trimString } = require('./validators');

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'for', 'from',
  'how', 'i', 'in', 'is', 'it', 'me', 'of', 'on', 'or', 'our', 'the', 'to',
  'what', 'when', 'where', 'which', 'with', 'you', 'your',
]);

const STATIC_DOCS = [
  {
    id: 'about',
    source: 'site',
    title: 'About JT NextGen Tech Hub',
    url: '/about',
    text: 'JT NextGen Tech Hub is a community-driven technology training and innovation center. It equips young people, students, job seekers, entrepreneurs, and adults with practical digital skills through hands-on learning, mentorship, and portfolio projects.',
  },
  {
    id: 'admissions',
    source: 'admissions',
    title: 'Admissions and Enrollment',
    url: '/register',
    text: 'Learners can register online, choose a program, and select a Morning or Evening session. Programs are beginner-friendly where noted and focus on real projects, career support, and verified certificates.',
  },
  {
    id: 'contact',
    source: 'contact',
    title: 'Contact and Location',
    url: '/contact',
    text: 'JT NextGen Tech Hub is located at Manya Kpongunor, Odumase Krobo, off Kpongunor Salem Road. Admissions enquiries can use the contact form, email info@nextgentechhub.com, call +233 543 946 424, or chat on WhatsApp.',
  },
  {
    id: 'certificate',
    source: 'certificate',
    title: 'Verified Certificates',
    url: '/certificates/verify',
    text: 'Learners receive a verified Certificate of Competency after completing eligible programs. Certificates can be checked through the public certificate verification page.',
  },
];

function tokenize(text) {
  return trimString(text, 4000)
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((word) => word.length > 1 && !STOPWORDS.has(word)) || [];
}

function countMatches(tokens, text) {
  const haystack = ` ${trimString(text, 8000).toLowerCase()} `;
  return tokens.reduce((score, token) => score + (haystack.split(token).length - 1), 0);
}

function parseOutcomes(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.join(', ') : '';
  } catch {
    return '';
  }
}

async function safeAll(db, sql, params = []) {
  try {
    return await db.prepare(sql).all(...params);
  } catch {
    return [];
  }
}

async function buildPublicCorpus(db) {
  const [programs, events, blogs] = await Promise.all([
    safeAll(db, 'SELECT title, slug, description, duration, level, audience, outcomes FROM programs ORDER BY created_at ASC LIMIT 30'),
    safeAll(db, `
      SELECT e.title, e.description, e.event_date, e.start_time, e.end_time, e.type, p.title AS program_name
      FROM events e
      LEFT JOIN programs p ON p.id = e.program_id
      WHERE e.is_public = 1
      ORDER BY e.event_date ASC
      LIMIT 20
    `),
    safeAll(db, 'SELECT title, slug, excerpt, content FROM blogs WHERE published = 1 ORDER BY created_at DESC LIMIT 20'),
  ]);

  const programDocs = programs.map((program) => ({
    id: `program:${program.slug}`,
    source: 'program',
    title: program.title,
    url: `/programs/${program.slug}`,
    text: [
      program.description,
      `Duration: ${program.duration || '3 Months'}.`,
      `Level: ${program.level || 'Beginner'}.`,
      program.audience ? `Best for: ${program.audience}.` : '',
      parseOutcomes(program.outcomes) ? `Outcomes: ${parseOutcomes(program.outcomes)}.` : '',
    ].filter(Boolean).join(' '),
  }));

  const eventDocs = events.map((event) => ({
    id: `event:${event.title}:${event.event_date}`,
    source: 'event',
    title: event.title,
    url: '/home#events',
    text: [
      event.description,
      event.program_name ? `Program: ${event.program_name}.` : '',
      event.event_date ? `Date: ${event.event_date}.` : '',
      event.start_time ? `Time: ${event.start_time}${event.end_time ? ` to ${event.end_time}` : ''}.` : '',
      event.type ? `Type: ${event.type}.` : '',
    ].filter(Boolean).join(' '),
  }));

  const blogDocs = blogs.map((blog) => ({
    id: `blog:${blog.slug}`,
    source: 'blog',
    title: blog.title,
    url: `/blog/${blog.slug}`,
    text: `${blog.excerpt || ''} ${trimString(blog.content, 1200)}`.trim(),
  }));

  return [...STATIC_DOCS, ...programDocs, ...eventDocs, ...blogDocs];
}

function scoreDocument(tokens, question, doc) {
  const titleScore = countMatches(tokens, doc.title) * 4;
  const bodyScore = countMatches(tokens, doc.text);
  const phraseBonus = doc.text.toLowerCase().includes(question.toLowerCase()) ? 8 : 0;
  return titleScore + bodyScore + phraseBonus;
}

async function retrievePublicKnowledge(db, rawQuestion, limit = 5) {
  const question = trimString(rawQuestion, 500);
  const tokens = tokenize(question);
  const corpus = await buildPublicCorpus(db);

  if (!tokens.length) {
    return STATIC_DOCS.slice(0, limit);
  }

  const ranked = corpus
    .map((doc) => ({ ...doc, score: scoreDocument(tokens, question, doc) }))
    .sort((a, b) => b.score - a.score);

  const hits = ranked.filter((doc) => doc.score > 0).slice(0, limit);
  return hits.length ? hits : STATIC_DOCS.slice(0, limit);
}

function formatRagContext(docs) {
  return docs
    .map((doc, index) => `[${index + 1}] ${doc.title} (${doc.source})\n${doc.text}\nURL: ${doc.url}`)
    .join('\n\n');
}

function fallbackPublicAnswer(question, docs) {
  const top = docs.slice(0, 3);
  const bullets = top.map((doc) => `- ${doc.title}: ${doc.text}`).join('\n');
  return [
    'Here is what I found from the JT NextGen knowledge base:',
    bullets,
    '',
    'For admissions help, you can register online or contact the team by phone/WhatsApp at +233 543 946 424.',
  ].join('\n');
}

module.exports = {
  fallbackPublicAnswer,
  formatRagContext,
  retrievePublicKnowledge,
  tokenize,
};
