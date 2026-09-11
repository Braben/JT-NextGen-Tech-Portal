const cache = new Map();

function getKey(req) {
  const userPart = req.user ? `:${req.user.id}:${req.user.role}` : '';
  return `${req.method}:${req.originalUrl}${userPart}`;
}

function cacheMiddleware(ttlSeconds = 60) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const key = getKey(req);
    const entry = cache.get(key);
    const now = Date.now();
    if (entry && entry.expiresAt > now) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      return res.json(entry.data);
    }
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      try {
        cache.set(key, { data, expiresAt: now + ttlSeconds * 1000 });
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      } catch {}
      return originalJson(data);
    };
    next();
  };
}

function invalidate(pattern) {
  for (const key of cache.keys()) {
    if (!pattern || key.includes(pattern)) cache.delete(key);
  }
}

function clearCache(req, res, next) {
  if (req.method !== 'GET') {
    const base = req.baseUrl || '';
    invalidate(base);
    invalidate(req.path.split('/').slice(0, 3).join('/'));
  }
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache.entries()) if (v.expiresAt <= now) cache.delete(k);
}, 60 * 1000).unref();

module.exports = { cacheMiddleware, invalidate, clearCache, cache };
