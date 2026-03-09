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

// Circle geometry — mirrors og.svg
const R = 195;
const LEFT_CX = 440;
const RIGHT_CX = 760;
const CY = 248;
// Overlap: LEFT_CX + R = 635, RIGHT_CX - R = 565 → 70px wide lens

// Fallback circle colours when no subject assigned
const FALLBACK_COLORS = ['rgba(245,197,24,0.55)', 'rgba(107,255,42,0.55)'];

function makeCircle(cx: number, subject: SubjectInfo | undefined, isTitle: boolean, slotIndex: number): SatoriNode {
  const d = R * 2;
  const color = subject?.color ?? FALLBACK_COLORS[slotIndex] ?? '#ffffff';
  const borderColor = subject ? color : `${color}`;
  const borderOpacity = subject ? 1 : 0.5;

  let inner: SatoriNode;
  if (subject?.image) {
    inner = el('img', { width: d, height: d, objectFit: 'cover' }, undefined, { src: subject.image });
  } else {
    // No photo — faint branded fill matching og.svg
    const bgColor = slotIndex === 0 ? 'rgba(245,197,24,0.08)' : 'rgba(107,255,42,0.08)';
    inner = el('div', {
      width: d,
      height: d,
      background: subject ? '#0f1a16' : bgColor,
      display: 'flex',
    });
  }

  return el(
    'div',
    {
      position: 'absolute',
      left: cx - R,
      top: CY - R,
      width: d,
      height: d,
      borderRadius: isTitle ? 20 : '50%',
      overflow: 'hidden',
      border: `2.5px solid ${borderColor}`,
      opacity: borderOpacity,
      boxShadow: `0 0 48px ${color}44`,
      display: 'flex',
    },
    inner,
  );
}

function makeName(cx: number, subject: SubjectInfo): SatoriNode {
  return el(
    'div',
    {
      position: 'absolute',
      left: cx - 170,
      top: CY + R + 16,
      width: 340,
      display: 'flex',
      justifyContent: 'center',
      color: subject.color,
      fontFamily: 'Bebas Neue',
      fontStyle: 'italic',
      fontSize: 28,
      letterSpacing: 2,
      textShadow: `0 0 18px ${subject.color}77`,
    },
    subject.name,
  );
}

function buildWordmark(): SatoriNode {
  const bigR: SatoriStyle = {
    fontFamily: 'Bebas Neue',
    fontStyle: 'italic',
    fontSize: 60,
    color: '#6bff2a',
    lineHeight: 1,
    display: 'flex',
    letterSpacing: 3,
  };
  const body: SatoriStyle = { ...bigR, fontSize: 46 };

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
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'baseline',
          textShadow: '0 0 24px rgba(107,255,42,0.6)',
        },
        [el('span', bigR, 'R'), el('span', body, 'E-GRAPHINATO'), el('span', bigR, 'R')],
      ),
      el(
        'span',
        {
          color: '#2f5c40',
          fontSize: 13,
          letterSpacing: 4,
          fontStyle: 'italic',
          display: 'flex',
        },
        'Filmography Overlap System',
      ),
    ],
  );
}

function buildLayout(subjects: SubjectInfo[], mode: 'person' | 'title'): SatoriNode {
  const isTitle = mode === 'title';
  const s0 = subjects[0];
  const s1 = subjects[1];
  const extras = subjects.slice(2);

  // Overlap tint — red strip over the 70px lens
  const overlapStart = RIGHT_CX - R; // 565
  const overlapEnd = LEFT_CX + R; // 635
  const overlapW = overlapEnd - overlapStart; // 70
  const overlapEl = el('div', {
    position: 'absolute',
    left: overlapStart,
    top: CY - R,
    width: overlapW,
    height: R * 2,
    background: 'rgba(212,28,28,0.38)',
    display: 'flex',
  });

  // Names below circles
  const nameLeft = s0 ? makeName(LEFT_CX, s0) : el('div', { display: 'flex' });
  const nameRight = s1 ? makeName(RIGHT_CX, s1) : el('div', { display: 'flex' });

  // Extra subjects (3+): small name strip between names and wordmark
  const extrasRow =
    extras.length > 0
      ? el(
          'div',
          {
            position: 'absolute',
            left: 0,
            top: CY + R + 58,
            width: 1200,
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
          },
          extras.map((s) =>
            el(
              'span',
              {
                color: s.color,
                fontFamily: 'Bebas Neue',
                fontStyle: 'italic',
                fontSize: 20,
                letterSpacing: 2,
                display: 'flex',
              },
              s.name,
            ),
          ),
        )
      : el('div', { display: 'flex' });

  return el(
    'div',
    {
      width: 1200,
      height: 630,
      background: '#04090a',
      display: 'flex',
      position: 'relative',
    },
    [
      makeCircle(LEFT_CX, s0, isTitle, 0),
      makeCircle(RIGHT_CX, s1, isTitle, 1),
      overlapEl,
      nameLeft,
      nameRight,
      extrasRow,
      buildWordmark(),
    ],
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
