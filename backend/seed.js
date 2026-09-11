require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./config/db');

const programsData = [
  { title: 'Basic Computing', slug: 'basic-computing', description: 'Learn essential computer skills including Microsoft Word, Excel, PowerPoint, and digital literacy.', duration: '3 Months', level: 'Beginner', audience: 'JHS Students, SHS Students, Adults', outcomes: ['Confident computer usage', 'Professional document creation', 'Basic data handling', 'Effective presentations'] },
  { title: 'Graphic Design', slug: 'graphic-design', description: 'Master visual communication with tools like Adobe Photoshop and Illustrator.', duration: '3 Months', level: 'Beginner', audience: 'Creative Minds, Entrepreneurs', outcomes: ['Design principles and elements', 'Photo editing techniques', 'Vector graphic creation', 'Portfolio development'] },
  { title: 'Web Development', slug: 'web-development', description: 'Build modern, responsive websites using HTML, CSS, JavaScript, and frameworks.', duration: '3 Months', level: 'Beginner', audience: 'Aspiring Developers, Entrepreneurs', outcomes: ['Build responsive websites', 'HTML, CSS, JavaScript mastery', 'Front-end framework skills', 'Deploy live projects'] },
  { title: 'Mobile App Development', slug: 'mobile-app-dev', description: 'Learn to build cross-platform mobile applications using React Native.', duration: '3 Months', level: 'Intermediate to Advanced', audience: 'Experienced Developers, Career Switchers', outcomes: ['Build mobile apps with React Native', 'Publish to app stores', 'API integration', 'UI/UX for mobile'] },
  { title: 'Python & AI', slug: 'python-ai', description: 'Dive into programming with Python and explore the basics of Artificial Intelligence and Machine Learning.', duration: '3 Months', level: 'Intermediate', audience: 'Tech Enthusiasts and Innovators', outcomes: ['Python programming skills', 'Understanding of AI concepts', 'Build simple AI models', 'Data analysis basics'] },
  { title: 'Robotics & IoT', slug: 'robotics-iot', description: 'Learn the fundamentals of robotics and Internet of Things (IoT) technologies.', duration: '3 Months', level: 'Intermediate', audience: 'Tech Enthusiasts and Innovators', outcomes: ['Understand robotics basics', 'Explore IoT concepts', 'Build simple robotic systems', 'Sensor integration'] },
  { title: 'Advanced Web Development', slug: 'advanced-web', description: 'Master modern frameworks, APIs, databases, and full-stack development.', duration: '3 Months', level: 'Advanced', audience: 'Experienced Developers', outcomes: ['Full-stack development', 'API design and integration', 'Database management', 'Cloud deployment'] },
  { title: 'Cybersecurity', slug: 'cybersecurity', description: 'Understand network security, ethical hacking, and information protection.', duration: '3 Months', level: 'Intermediate', audience: 'IT Professionals, Security Enthusiasts', outcomes: ['Network security fundamentals', 'Ethical hacking techniques', 'Security best practices', 'Incident response'] },
  { title: 'IT Support', slug: 'it-support', description: 'Gain skills in hardware, networking, troubleshooting, and customer support.', duration: '3 Months', level: 'Beginner', audience: 'Job Seekers, Career Changers', outcomes: ['Hardware diagnostics', 'Network setup and maintenance', 'Troubleshooting skills', 'Customer service skills'] },
  { title: 'Digital Skills', slug: 'digital-skills', description: 'Comprehensive digital literacy training for the modern workplace.', duration: '3 Months', level: 'Beginner', audience: 'General Public', outcomes: ['Email and internet skills', 'Online collaboration tools', 'Social media management', 'Digital safety'] },
];

const testimonialsData = [
  { name: 'Michael Owusu', role: 'Web Development Student', message: 'JT NextGen Tech Hub gave me the confidence and practical skills I needed to start building real-world applications. The mentorship was incredible.', avatar: '/avatar1.jpg' },
  { name: 'Ama Serwaa', role: 'Graphic Design Student', message: 'I never thought I could create professional designs until I joined this program. Now I can design professional branding materials.', avatar: '/avatar2.jpg' },
  { name: 'Yaw Boateng', role: 'Digital Skills Learner', message: 'This program transformed my mindset. I went from zero tech knowledge to confidently using digital tools for work and business.', avatar: '/avatar3.jpg' },
];

async function seed() {
  await db.ready;
  console.log('Seeding database...');

  const seedDemoAccounts = process.env.SEED_DEMO_ACCOUNTS === 'true' || process.env.NODE_ENV !== 'production';
  const password = bcrypt.hashSync(process.env.DEMO_PASSWORD || 'password', 10);

  if (process.env.NODE_ENV === 'production' && process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?) ON CONFLICT(email) DO NOTHING')
      .run(uuidv4(), 'Bootstrap Admin', process.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase(), bcrypt.hashSync(process.env.BOOTSTRAP_ADMIN_PASSWORD, 10), 'admin');
    console.log('Created bootstrap admin from environment');
  }

  if (seedDemoAccounts) {
    const adminId = uuidv4();
    await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?) ON CONFLICT(email) DO NOTHING')
      .run(adminId, 'System Admin', 'admin@jtnextgen.com', password, 'admin');

    const instructorId = uuidv4();
    await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?) ON CONFLICT(email) DO NOTHING')
      .run(instructorId, 'Dr. Sarah Johnson', 'instructor@jtnextgen.com', password, 'instructor');

    const studentId = uuidv4();
    await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?) ON CONFLICT(email) DO NOTHING')
      .run(studentId, 'Alex Student', 'student@jtnextgen.com', password, 'student');
  }

  const instructor = await db.prepare("SELECT id FROM users WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1").get();
  const resolvedInstructorId = instructor?.id;

  const existingPrograms = await db.prepare('SELECT COUNT(*) as count FROM programs').get();
  if (existingPrograms.count === 0) {
    const insertProgram = db.prepare('INSERT INTO programs (id, title, slug, description, duration, level, audience, outcomes) VALUES (?,?,?,?,?,?,?,?)');
    for (const p of programsData) {
      await insertProgram.run(uuidv4(), p.title, p.slug, p.description, p.duration, p.level, p.audience, JSON.stringify(p.outcomes));
    }
    console.log(`Seeded ${programsData.length} programs`);
  }

  const existingTestimonials = await db.prepare('SELECT COUNT(*) as count FROM testimonials').get();
  if (existingTestimonials.count === 0) {
    const insertTest = db.prepare('INSERT INTO testimonials (id, name, role, message, avatar) VALUES (?,?,?,?,?)');
    for (const t of testimonialsData) {
      await insertTest.run(uuidv4(), t.name, t.role, t.message, t.avatar);
    }
    console.log('Seeded testimonials');
  }

  const existingAssignments = await db.prepare('SELECT COUNT(*) as count FROM assignments').get();
  if (resolvedInstructorId && existingAssignments.count === 0) {
    const a1 = uuidv4();
    await db.prepare('INSERT INTO assignments (id, instructor_id, title, description, instructions, rubric, max_score, due_date) VALUES (?,?,?,?,?,?,?,?)')
      .run(a1, resolvedInstructorId, 'Introduction to Programming - Week 1',
        'Write a Python program that demonstrates basic programming concepts including variables, loops, and functions.',
        '<h2>Instructions</h2><p>Write a Python program that:</p><ul><li>Declares at least 3 variables of different types</li><li>Uses a for loop and a while loop</li><li>Defines and calls at least 2 functions</li><li>Includes comments explaining your code</li></ul>',
        'Code correctness (40%)\nCode style & organization (20%)\nDocumentation & comments (20%)\nProblem-solving approach (20%)',
        100, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));;
    const a2 = uuidv4();
    await db.prepare('INSERT INTO assignments (id, instructor_id, title, description, instructions, rubric, max_score, due_date) VALUES (?,?,?,?,?,?,?,?)')
      .run(a2, resolvedInstructorId, 'Data Structures - Arrays & Linked Lists',
        'Implement an array-based list and a singly linked list in Python, then compare their performance.',
        '<h2>Instructions</h2><p>Implement both data structures from scratch and write a comparison report.</p>',
        'Implementation correctness (50%)\nPerformance analysis (25%)\nCode quality (25%)',
        100, new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
    const a3 = uuidv4();
    await db.prepare('INSERT INTO assignments (id, instructor_id, title, description, instructions, rubric, max_score) VALUES (?,?,?,?,?,?,?)')
      .run(a3, resolvedInstructorId, 'Web Development Basics - HTML/CSS',
        'Create a personal portfolio webpage using HTML and CSS. The page should be responsive and visually appealing.',
        '<h2>Instructions</h2><p>Build a single-page portfolio with:</p><ul><li>Semantic HTML5 structure</li><li>Responsive CSS layout using Flexbox/Grid</li><li>Navigation bar</li><li>Contact form</li></ul>',
        'HTML structure & semantics (30%)\nCSS styling & layout (40%)\nResponsiveness (20%)\nCreativity (10%)', 100);
    console.log('Seeded sample assignments');
  }

  const existingCategories = await db.prepare('SELECT COUNT(*) as count FROM forum_categories').get();
  if (existingCategories.count === 0) {
    const insertCat = db.prepare('INSERT INTO forum_categories (id, name, description, type, session) VALUES (?,?,?,?,?)');
    await insertCat.run(uuidv4(), 'General Discussion', 'Talk about anything related to tech and learning', 'general', null);
    await insertCat.run(uuidv4(), 'Announcements', 'Official announcements from instructors and admins', 'general', null);
    await insertCat.run(uuidv4(), 'Study Group', 'Collaborate and help each other with coursework', 'general', null);
    await insertCat.run(uuidv4(), 'Morning Cohort', 'For students in the morning session', 'cohort', 'Morning');
    await insertCat.run(uuidv4(), 'Evening Cohort', 'For students in the evening session', 'cohort', 'Evening');
    await insertCat.run(uuidv4(), 'Career & Jobs', 'Discuss job opportunities, internships, and career advice', 'general', null);
    console.log('Seeded forum categories');
  }

  await db.saveDb();
  console.log('Database seeded successfully!');
  if (seedDemoAccounts) {
    console.log('');
    console.log('Demo accounts were seeded for local use. Configure DEMO_PASSWORD to avoid the default.');
  }
  process.exit(0);
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
