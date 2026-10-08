function v1Cors(req, res, next) {
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Expose-Headers', 'ETag, Retry-After, RateLimit, RateLimit-Policy');
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-None-Match');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }
  next();
}
module.exports = v1Cors;
