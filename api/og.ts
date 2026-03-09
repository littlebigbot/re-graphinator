import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/';
const SLOT_COLORS = ['#6bff2a', '#c8e020', '#2bc9ff', '#d41c1c', '#c87dff'];

// ── Bebas Neue font — loaded once per edge instance ───────────────────────────
const fontPromise: Promise<ArrayBuffer> = fetch('https://fonts.googleapis.com/css2?family=Bebas+Neue', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
})
  .then((r) => r.text())
  .then((css) => {
    const match = css.match(/src:\s*url\(([^)]+)\)/);
    if (!match?.[1]) throw new Error('font url not found');
    return fetch(match[1]).then((r) => r.arrayBuffer());
  })
  .catch(() => new ArrayBuffer(0));

// ── Satori element builder ────────────────────────────────────────────────────
type SatoriStyle = Record<string, string | number | undefined>;

interface SatoriNode {
  type: string;
  key: null;
  props: {
    style?: SatoriStyle;
    src?: string;
    width?: number;
    height?: number;
    children?: SatoriChildren;
  };
}

type SatoriChildren = SatoriNode | SatoriNode[] | string | null | undefined;

function el(
  type: string,
  style: SatoriStyle,
  children?: SatoriChildren,
  extra?: Record<string, string | number>,
): SatoriNode {
  return { type, key: null, props: { style, children, ...extra } };
}

// ── TMDB helpers ──────────────────────────────────────────────────────────────
async function tmdb<T>(path: string, apiKey: string): Promise<T> {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set('api_key', apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json() as Promise<T>;
}

interface SubjectInfo {
  name: string;
  image: string | null;
  color: string;
}

async function resolveSubjects(mode: 'person' | 'title', rawIds: string, apiKey: string): Promise<SubjectInfo[]> {
  if (mode === 'person') {
    const ids = rawIds.split(',').map(Number).filter(Boolean).slice(0, 5);
    const people = await Promise.all(
      ids.map((id) => tmdb<{ name: string; profile_path: string | null }>(`/person/${id}`, apiKey)),
    );
    return people.map((p, i) => ({
      name: p.name,
      image: p.profile_path ? `${IMG_BASE}w185${p.profile_path}` : null,
      color: SLOT_COLORS[i] ?? '#ffffff',
    }));
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
      entries.map((e) =>
        tmdb<{ title?: string; name?: string; poster_path: string | null }>(`/${e.mediaType}/${e.id}`, apiKey),
      ),
    );
    return titles.map((t, i) => ({
      name: t.title ?? t.name ?? 'Untitled',
      image: t.poster_path ? `${IMG_BASE}w342${t.poster_path}` : null,
      color: SLOT_COLORS[i] ?? '#ffffff',
    }));
  }
}

// ── Layout helpers ────────────────────────────────────────────────────────────

// Stacked circle geometry — matches search-history avatar style, scaled up
const D = 200; // circle diameter
const R = D / 2; // radius
const STEP = 140; // centre-to-centre distance (60px overlap)
const CY = 252; // vertical centre shared by all circles

const FALLBACK_COLORS = [
  'rgba(245,197,24,0.5)',
  'rgba(107,255,42,0.5)',
  'rgba(44,201,255,0.5)',
  'rgba(212,28,28,0.5)',
  'rgba(200,125,255,0.5)',
];

function circleCX(i: number, n: number): number {
  const totalSpan = (n - 1) * STEP + D;
  return (1200 - totalSpan) / 2 + R + i * STEP;
}

function makeCircle(i: number, n: number, subject: SubjectInfo | undefined, isTitle: boolean): SatoriNode {
  const cx = circleCX(i, n);
  const color = subject?.color ?? FALLBACK_COLORS[i] ?? '#ffffff';
  const bgFill = FALLBACK_COLORS[i]?.replace('0.5', '0.07') ?? '#0f1a16';

  const inner: SatoriNode = subject?.image
    ? el('img', { width: D, height: D, objectFit: 'cover' }, undefined, { src: subject.image })
    : el('div', { width: D, height: D, background: bgFill, display: 'flex' });

  return el(
    'div',
    {
      position: 'absolute',
      left: cx - R,
      top: CY - R,
      width: D,
      height: D,
      borderRadius: isTitle ? 16 : '50%',
      overflow: 'hidden',
      border: `3px solid ${color}`,
      boxShadow: `0 0 40px ${color}55`,
      background: '#04090a',
      display: 'flex',
    },
    inner,
  );
}

function makeName(i: number, n: number, subject: SubjectInfo): SatoriNode {
  const cx = circleCX(i, n);
  return el(
    'div',
    {
      position: 'absolute',
      left: cx - 130,
      top: CY + R + 14,
      width: 260,
      display: 'flex',
      justifyContent: 'center',
      color: subject.color,
      fontFamily: 'Bebas Neue',
      fontStyle: 'italic',
      fontSize: 26,
      letterSpacing: 2,
      textShadow: `0 0 14px ${subject.color}66`,
    },
    subject.name,
  );
}

function buildWordmark(): SatoriNode {
  const bigR: SatoriStyle = {
    fontFamily: 'Bebas Neue',
    fontStyle: 'italic',
    fontSize: 62,
    color: '#6bff2a',
    lineHeight: 1,
    display: 'flex',
    letterSpacing: 3,
  };
  const body: SatoriStyle = { ...bigR, fontSize: 48 };

  return el(
    'div',
    {
      position: 'absolute',
      left: 0,
      bottom: 22,
      width: 1200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 5,
    },
    [
      el('div', { display: 'flex', alignItems: 'baseline', textShadow: '0 0 24px rgba(107,255,42,0.6)' }, [
        el('span', bigR, 'R'),
        el('span', body, 'E-GRAPHINATO'),
        el('span', bigR, 'R'),
      ]),
      el(
        'span',
        { color: '#2f5c40', fontSize: 13, letterSpacing: 4, fontStyle: 'italic', display: 'flex' },
        'Filmography Overlap System',
      ),
    ],
  );
}

function buildLayout(subjects: SubjectInfo[], mode: 'person' | 'title'): SatoriNode {
  const isTitle = mode === 'title';
  const n = Math.max(subjects.length, 2);

  // Render right-to-left so index 0 (leftmost) paints last → appears on top,
  // matching the search-history stacking direction.
  const circleEls: SatoriNode[] = [];
  for (let i = n - 1; i >= 0; i--) {
    circleEls.push(makeCircle(i, n, subjects[i], isTitle));
  }

  const nameEls = subjects.map((s, i) => makeName(i, n, s));

  return el(
    'div',
    {
      width: 1200,
      height: 630,
      background: '#04090a',
      display: 'flex',
      position: 'relative',
    },
    [...circleEls, ...nameEls, buildWordmark()],
  );
}

// ── Edge function ─────────────────────────────────────────────────────────────
export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url, 'https://re-graphinator.vercel.app');
  const mode = (searchParams.get('mode') ?? 'person') as 'person' | 'title';
  const rawIds = searchParams.get('ids') ?? '';

  const apiKey = (process.env.TMDB_API_KEY as string | undefined) ?? '';

  let subjects: SubjectInfo[] = [];
  if (rawIds && apiKey) {
    try {
      subjects = await resolveSubjects(mode, rawIds, apiKey);
    } catch {
      // fall back to generic branded image
    }
  }

  const fontData = await fontPromise;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ImageResponse(buildLayout(subjects, mode) as any, {
    width: 1200,
    height: 630,
    fonts: fontData.byteLength > 0 ? [{ name: 'Bebas Neue', data: fontData, style: 'italic', weight: 400 }] : [],
  });
}
