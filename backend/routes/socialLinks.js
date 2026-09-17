const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const audit = require('../services/audit');
// Keep these keys aligned with the admin form and public SocialLinks icons.
const platforms = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'x', 'whatsapp'];

async function readLinks() {
  const rows = await db.prepare('SELECT platform,url FROM social_links').all();
  return Object.fromEntries(rows.map(({ platform, url }) => [platform, url]));
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await readLinks());
  } catch (error) {
    next(error);
  }
});

router.put('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const updates = Object.entries(req.body);
    // Validate the entire request before writing. Empty URLs deliberately hide
    // icons; HTTPS-only URLs prevent executable schemes in the public footer.
    for (const [platform, value] of updates) {
      if (!platforms.includes(platform) || typeof value !== 'string' || value.length > 1000) {
        return res.status(400).json({ error: 'Invalid social profile' });
      }
      if (!value.trim()) continue;
      try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid URL');
      } catch {
        return res.status(400).json({ error: `Use a valid HTTPS URL for ${platform}` });
      }
    }
    for (const [platform, value] of updates) {
      await db.prepare('INSERT INTO social_links (platform,url) VALUES (?,?) ON CONFLICT(platform) DO UPDATE SET url=excluded.url')
        .run(platform, value.trim());
    }
    await db.saveDb();
    await audit(req.user, 'update', 'social-links', null, 'Updated public social profiles');
    res.json(await readLinks());
  } catch (error) {
    next(error);
  }
});

module.exports = router;
