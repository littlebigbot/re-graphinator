import type { VercelRequest, VercelResponse } from '@vercel/node';

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function tmdb<T>(path: string, apiKey: string): Promise<T> {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set('api_key', apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json() as Promise<T>;
}

async function resolveNames(mode: 'person' | 'title', rawIds: string, apiKey: string): Promise<string[]> {
  if (mode === 'person') {
    const ids = rawIds.split(',').map(Number).filter(Boolean).slice(0, 5);
    const people = await Promise.all(ids.map((id) => tmdb<{ name: string }>(`/person/${id}`, apiKey)));
    return people.map((p) => p.name);
  } else {
    const entries = rawIds
      .split(',')
      .map((entry) => {
        const [id, mediaType] = entry.split(':');
        return { id: Number(id), mediaType: mediaType as 'movie' | 'tv' };
      })
      .filter((e) => e.id && e.mediaType)
      .slice(0, 5);
    const titles = await Promise.all(
      entries.map((e) => tmdb<{ title?: string; name?: string }>(`/${e.mediaType}/${e.id}`, apiKey)),
    );
    return titles.map((t) => t.title ?? t.name ?? 'Untitled');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawMode = (req.query.mode as string | undefined) ?? 'person';
  const mode = (rawMode === 'title' ? 'title' : 'person') as 'person' | 'title';
  const rawIds = (req.query.ids as string | undefined) ?? '';

  const apiKey = process.env.TMDB_API_KEY ?? '';
  const origin = req.headers['x-forwarded-host']
    ? `https://${req.headers['x-forwarded-host'] as string}`
    : 'https://re-graphinator.vercel.app';

  let title = 'Re-Graphinator — Filmography Overlap System';
  let description = 'Compare filmographies. See who worked together, and where credits overlap.';
  let ogImageUrl = `${origin}/og.svg`;

  if (rawIds && apiKey) {
    try {
      const names = await resolveNames(mode, rawIds, apiKey);
      if (names.length >= 2) {
        const last = names.pop()!;
        const joined = names.join(', ');
        const verb = mode === 'person' ? 'filmography overlap' : 'shared cast & crew';
        title = `${joined} & ${last} — ${verb} on Re-Graphinator`;
        description =
          mode === 'person'
            ? `See every film and TV show ${joined} and ${last} worked on together.`
            : `Find cast & crew shared across ${joined} and ${last}.`;
        ogImageUrl = `${origin}/api/og?mode=${mode}&ids=${encodeURIComponent(rawIds)}`;
      }
    } catch {
      // fall through to defaults
    }
  }

  const redirectUrl = rawIds ? `${origin}/?mode=${mode}&ids=${encodeURIComponent(rawIds)}&_=1` : `${origin}/`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Re-Graphinator" />
  <meta property="og:title" content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(description)}" />
  <meta property="og:image" content="${escHtml(ogImageUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escHtml(title)}" />
  <meta name="twitter:description" content="${escHtml(description)}" />
  <meta name="twitter:image" content="${escHtml(ogImageUrl)}" />
  <meta http-equiv="refresh" content="0; url=${escHtml(redirectUrl)}" />
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</head>
<body></body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300');
  return res.status(200).send(html);
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
