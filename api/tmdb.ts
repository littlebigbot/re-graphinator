import type { VercelRequest, VercelResponse } from '@vercel/node';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const ALLOWED_PATHS = [
  /^\/search\/(person|multi)$/,
  /^\/person\/\d+$/,
  /^\/person\/\d+\/combined_credits$/,
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/credits$/,
  /^\/tv\/\d+$/,
  /^\/tv\/\d+\/aggregate_credits$/,
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path, ...params } = req.query;

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing path' });
  }

  if (!ALLOWED_PATHS.some((re) => re.test(path))) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const url = new URL(TMDB_BASE + path);
  url.searchParams.set('api_key', apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      url.searchParams.set(key, value);
    }
  }

  const tmdbRes = await fetch(url.toString());
  const data = await tmdbRes.json();

  res.setHeader('Cache-Control', 's-maxage=3600');
  return res.status(tmdbRes.status).json(data);
}
