import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/';

// Re-Animator palette — must match PERSON_COLORS in src/types/tmdb.ts
const SLOT_COLORS = ['#6bff2a', '#c8e020', '#2bc9ff', '#d41c1c', '#c87dff'];

// ── Satori element builder ─────────────────────────────────────────────────────
// Satori accepts the same virtual-DOM shape as React but we don't need React
// itself — plain objects work fine.

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
      image: t.poster_path ? `${IMG_BASE}w154${t.poster_path}` : null,
      color: SLOT_COLORS[i] ?? '#ffffff',
    }));
  }
}

// ── Layout builders ───────────────────────────────────────────────────────────

function buildSubjectCard(s: SubjectInfo, isTitle: boolean): SatoriNode {
  const imgSize = isTitle ? 80 : 90;
  const frameH = isTitle ? imgSize * 1.5 + 6 : imgSize + 6;

  const frameContent: SatoriNode = s.image
    ? el('img', { objectFit: 'cover', width: '100%', height: '100%' }, undefined, {
        src: s.image,
        width: imgSize,
        height: isTitle ? imgSize * 1.5 : imgSize,
      })
    : el('div', { color: s.color, fontSize: 32, opacity: 0.5, display: 'flex' }, '?');

  const frame = el(
    'div',
    {
      width: imgSize + 6,
      height: frameH,
      borderRadius: isTitle ? 8 : '50%',
      border: `3px solid ${s.color}`,
      boxShadow: `0 0 24px ${s.color}55`,
      overflow: 'hidden',
      background: '#0f1a16',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    frameContent,
  );

  const label = el(
    'span',
    {
      color: s.color,
      fontSize: 15,
      fontWeight: 700,
      textAlign: 'center',
      maxWidth: isTitle ? 100 : 120,
      letterSpacing: '0.02em',
      textShadow: `0 0 12px ${s.color}88`,
      display: 'flex',
    },
    s.name,
  );

  return el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }, [frame, label]);
}

function buildLayout(subjects: SubjectInfo[], mode: 'person' | 'title'): SatoriNode {
  const isTitle = mode === 'title';

  const leftCircle = el('div', {
    position: 'absolute',
    left: 120,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'rgba(245,197,24,0.06)',
    border: '1.5px solid rgba(245,197,24,0.4)',
    boxShadow: '0 0 60px rgba(245,197,24,0.15)',
    display: 'flex',
  });

  const rightCircle = el('div', {
    position: 'absolute',
    right: 120,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'rgba(107,255,42,0.06)',
    border: '1.5px solid rgba(107,255,42,0.4)',
    boxShadow: '0 0 60px rgba(107,255,42,0.15)',
    display: 'flex',
  });

  const subjectsRow =
    subjects.length > 0
      ? el(
          'div',
          {
            display: 'flex',
            gap: 28,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            marginBottom: 40,
            flexWrap: 'wrap',
            maxWidth: 1000,
            padding: '0 60px',
          },
          subjects.map((s) => buildSubjectCard(s, isTitle)),
        )
      : el('div', { marginBottom: 40, display: 'flex' });

  const wordmark = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 1 }, [
    el(
      'span',
      {
        color: '#6bff2a',
        fontSize: 36,
        fontWeight: 900,
        letterSpacing: 12,
        fontStyle: 'italic',
        textShadow: '0 0 20px rgba(107,255,42,0.6)',
        display: 'flex',
      },
      'RE-GRAPHINATOR',
    ),
    el(
      'span',
      {
        color: '#2f5c40',
        fontSize: 14,
        letterSpacing: 4,
        fontStyle: 'italic',
        display: 'flex',
      },
      'Filmography Overlap System',
    ),
  ]);

  return el(
    'div',
    {
      width: 1200,
      height: 630,
      background: '#04090a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      position: 'relative',
    },
    [leftCircle, rightCircle, subjectsRow, wordmark],
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ImageResponse(buildLayout(subjects, mode) as any, { width: 1200, height: 630 });
}
