import type {
  TmdbPerson,
  TmdbTitle,
  TmdbCombinedCredit,
  TmdbMultiSearchResult,
  TmdbMovieCreditsResponse,
  TmdbTvAggregateCreditsResponse,
  TmdbPagedResponse,
  Project,
  CastMember,
  RoleCategory,
} from '@/types/tmdb';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_PROXY = '/api/tmdb';

export const IMG_BASE = 'https://image.tmdb.org/t/p/';
export const profileUrl = (path: string | null) => (path ? `${IMG_BASE}w185${path}` : '');
export const posterUrl = (path: string | null) => (path ? `${IMG_BASE}w154${path}` : '');
export const tmdbUrl = (mediaType: string, id: number) => `https://www.themoviedb.org/${mediaType}/${id}`;

// ── Role category classifiers ─────────────────────────────────────────────────

// Matches "Self", "Himself", "Herself", "Theirself/Theirselves" and variants
const SELF_RE = /^\s*(self|him\s*self|her\s*self|their\s*sel(f|ves?))\b/i;

const WRITER_JOB_KEYWORDS = ['screenplay', 'story', 'teleplay', 'novel', 'script'] as const;

function charCategory(character: string): RoleCategory {
  if (!character || SELF_RE.test(character)) {
    return 'self';
  }
  return 'actor';
}

function jobCategory(job: string): RoleCategory {
  const j = job.toLowerCase();
  if (j === 'director') {
    return 'director';
  }
  if (j.includes('writ') || WRITER_JOB_KEYWORDS.some((word) => j.includes(word))) {
    return 'writer';
  }
  return 'crew';
}

function roleCategory(credit: TmdbCombinedCredit): RoleCategory {
  if (credit.character !== undefined) {
    return charCategory(credit.character);
  }
  return jobCategory(credit.job ?? '');
}

// ─────────────────────────────────────────────────────────────────────────────

export function useTmdb() {
  async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    let url: URL;

    if (import.meta.env.DEV) {
      url = new URL(TMDB_BASE + path);
      url.searchParams.set('api_key', import.meta.env.DEV_TMDB_API_KEY ?? '');
    } else {
      url = new URL(TMDB_PROXY, window.location.origin);
      url.searchParams.set('path', path);
    }

    for (const [k, value] of Object.entries(params)) {
      url.searchParams.set(k, value);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`TMDB ${res.status}: ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  // ── Person search ───────────────────────────────────────────────────────────

  async function searchPeople(query: string): Promise<TmdbPerson[]> {
    if (!query.trim()) {
      return [];
    }
    const data = await request<{ results: TmdbPerson[] }>('/search/person', {
      query,
      include_adult: 'false',
    });
    return data.results ?? [];
  }

  async function fetchCredits(personId: number): Promise<Project[]> {
    const data = await request<{
      cast: TmdbCombinedCredit[];
      crew: TmdbCombinedCredit[];
    }>(`/person/${personId}/combined_credits`);

    const all = [...(data.cast ?? []), ...(data.crew ?? [])];
    const map = new Map<string, Project>();

    for (const credit of all) {
      if (!credit.id) {
        continue;
      }
      const key = `${credit.media_type}-${credit.id}`;
      const role = credit.character ?? credit.job ?? '';
      const category = roleCategory(credit);
      const existing = map.get(key);

      if (existing) {
        if (role && !existing.roles.includes(role)) {
          existing.roles.push(role);
        }
        if (!existing.roleCategories.includes(category)) {
          existing.roleCategories.push(category);
        }
      } else {
        map.set(key, {
          id: credit.id,
          title: credit.title ?? credit.name ?? 'Untitled',
          media_type: credit.media_type,
          poster_path: credit.poster_path ?? null,
          release_date: credit.release_date ?? credit.first_air_date ?? '',
          vote_average: credit.vote_average ?? 0,
          popularity: credit.popularity ?? 0,
          roles: role ? [role] : [],
          roleCategories: [category],
        });
      }
    }

    return [...map.values()];
  }

  // ── Title search + cast fetch ───────────────────────────────────────────────

  /**
   * Search for films and TV shows via /search/multi.
   * Results are filtered to movie/tv only and normalised to TmdbTitle.
   */
  async function searchTitles(query: string): Promise<TmdbTitle[]> {
    if (!query.trim()) {
      return [];
    }
    const data = await request<TmdbPagedResponse<TmdbMultiSearchResult>>('/search/multi', {
      query,
      include_adult: 'false',
    });

    return (data.results ?? [])
      .filter((result) => result.media_type === 'movie' || result.media_type === 'tv')
      .map((result) => ({
        id: result.id,
        name: result.title ?? result.name ?? 'Untitled',
        media_type: result.media_type as 'movie' | 'tv',
        poster_path: result.poster_path ?? null,
        release_date: result.release_date ?? result.first_air_date ?? '',
        vote_average: result.vote_average ?? 0,
        overview: result.overview,
      }));
  }

  /**
   * Fetch the full cast + crew for a film or TV show, normalised to CastMember[].
   *
   * Movies use /movie/{id}/credits.
   * TV shows use /tv/{id}/aggregate_credits, which gives total episode counts
   * and handles multi-role appearances across seasons.
   *
   * People appearing in both cast and crew are merged into a single entry.
   */
  async function fetchCast(titleId: number, mediaType: 'movie' | 'tv'): Promise<CastMember[]> {
    const map = new Map<number, CastMember>();

    function upsert(
      id: number,
      name: string,
      profile_path: string | null,
      dept: string | undefined,
      popularity: number,
      role: string,
      category: RoleCategory,
    ): void {
      const existing = map.get(id);
      if (existing) {
        if (role && !existing.roles.includes(role)) {
          existing.roles.push(role);
        }
        if (!existing.roleCategories.includes(category)) {
          existing.roleCategories.push(category);
        }
      } else {
        map.set(id, {
          id,
          name,
          profile_path: profile_path ?? null,
          known_for_department: dept,
          popularity,
          roles: role ? [role] : [],
          roleCategories: [category],
        });
      }
    }

    if (mediaType === 'movie') {
      const data = await request<TmdbMovieCreditsResponse>(`/movie/${titleId}/credits`);

      for (const castMember of data.cast ?? []) {
        upsert(
          castMember.id,
          castMember.name,
          castMember.profile_path,
          castMember.known_for_department,
          castMember.popularity ?? 0,
          castMember.character ?? '',
          charCategory(castMember.character ?? ''),
        );
      }
      for (const crewMember of data.crew ?? []) {
        upsert(
          crewMember.id,
          crewMember.name,
          crewMember.profile_path,
          crewMember.department,
          crewMember.popularity ?? 0,
          crewMember.job ?? '',
          jobCategory(crewMember.job ?? ''),
        );
      }
    } else {
      // TV: aggregate_credits collapses multi-season appearances into one entry
      const data = await request<TmdbTvAggregateCreditsResponse>(`/tv/${titleId}/aggregate_credits`);

      for (const castMember of data.cast ?? []) {
        const chars = castMember.roles?.map((roleEntry) => roleEntry.character).filter(Boolean) ?? [];
        const role = chars[0] ?? '';
        upsert(
          castMember.id,
          castMember.name,
          castMember.profile_path,
          castMember.department,
          castMember.popularity ?? 0,
          role,
          charCategory(role),
        );
      }
      for (const crewMember of data.crew ?? []) {
        const job = crewMember.jobs?.[0]?.job ?? '';
        upsert(
          crewMember.id,
          crewMember.name,
          crewMember.profile_path,
          crewMember.department,
          crewMember.popularity ?? 0,
          job,
          jobCategory(job),
        );
      }
    }

    return [...map.values()];
  }

  /**
   * Search for people AND titles together via /search/multi.
   * Used in unset mode (first slot, before mode is locked).
   * Returns a mixed array; callers use isPersonSlot() to discriminate.
   */
  async function searchAll(query: string): Promise<(TmdbPerson | TmdbTitle)[]> {
    if (!query.trim()) {
      return [];
    }
    const data = await request<TmdbPagedResponse<TmdbMultiSearchResult>>('/search/multi', {
      query,
      include_adult: 'false',
    });

    return (data.results ?? []).flatMap((result): (TmdbPerson | TmdbTitle)[] => {
      if (result.media_type === 'person') {
        return [
          {
            id: result.id,
            name: result.name ?? '',
            profile_path: result.profile_path ?? null,
            known_for_department: result.known_for_department ?? '',
            known_for: (result.known_for ?? []).map((k) => ({
              id: k.id,
              title: k.title,
              name: k.name,
              media_type: k.media_type,
            })),
          } satisfies TmdbPerson,
        ];
      }
      if (result.media_type === 'movie' || result.media_type === 'tv') {
        return [
          {
            id: result.id,
            name: result.title ?? result.name ?? 'Untitled',
            media_type: result.media_type,
            poster_path: result.poster_path ?? null,
            release_date: result.release_date ?? result.first_air_date ?? '',
            vote_average: result.vote_average ?? 0,
            overview: result.overview,
          } satisfies TmdbTitle,
        ];
      }
      return [];
    });
  }

  return { searchPeople, fetchCredits, searchTitles, searchAll, fetchCast };
}
