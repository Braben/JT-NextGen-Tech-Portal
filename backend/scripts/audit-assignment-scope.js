/**
 * Read-only assignment scope audit.
 *
 * Historical assignments may intentionally remain unscoped while an admin
 * reviews them. This report identifies those records and invalid class links
 * so they can be corrected from the admin workflow before launch.
 */

require('dotenv').config();

const db = require('../config/db');

async function main() {
  await db.ready;

  const summary = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN a.program_id IS NULL THEN 1 ELSE 0 END) AS unscoped,
      SUM(CASE WHEN a.class_id IS NOT NULL AND c.id IS NULL THEN 1 ELSE 0 END) AS missing_class,
      SUM(CASE WHEN a.class_id IS NOT NULL AND c.id IS NOT NULL AND c.program_id <> a.program_id THEN 1 ELSE 0 END) AS mismatched_class
    FROM assignments a
    LEFT JOIN program_classes c ON c.id = a.class_id
  `).get();

  const records = await db.prepare(`
    SELECT a.id, a.title, a.instructor_id, a.program_id, a.class_id,
           c.program_id AS class_program_id
    FROM assignments a
    LEFT JOIN program_classes c ON c.id = a.class_id
    WHERE a.program_id IS NULL
       OR (a.class_id IS NOT NULL AND c.id IS NULL)
       OR (a.class_id IS NOT NULL AND c.id IS NOT NULL AND c.program_id <> a.program_id)
    ORDER BY a.created_at ASC
  `).all();

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: Number(summary?.total || 0),
      unscoped: Number(summary?.unscoped || 0),
      missingClass: Number(summary?.missing_class || 0),
      mismatchedClass: Number(summary?.mismatched_class || 0),
    },
    records,
    action: records.length
      ? 'Review these assignments in the admin workflow and assign a valid programme/class before launch.'
      : 'All assignments have a valid programme/class scope.',
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Assignment scope audit (${report.generatedAt})`);
    console.log(`Total: ${report.summary.total}`);
    console.log(`Unscoped: ${report.summary.unscoped}`);
    console.log(`Missing class: ${report.summary.missingClass}`);
    console.log(`Mismatched class: ${report.summary.mismatchedClass}`);
    if (records.length) {
      console.log('\nRecords requiring review:');
      records.forEach((record) => console.log(`- ${record.id} | ${record.title}`));
    }
  }
}

main()
  .catch((error) => {
    console.error(`Assignment scope audit failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof db.closeDb === 'function') db.closeDb();
    if (typeof db.close === 'function') await db.close();
  });
