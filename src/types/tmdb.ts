// ── TMDB API response shapes ──────────────────────────────────────────────────

export interface TmdbKnownFor {
  id: number;
  title?: string;
  name?: string;
  media_type: string;
}

export interface TmdbPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  known_for: TmdbKnownFor[];
}

// ── Raw API response shapes (used by useTmdb) ─────────────────────────────────

/** Generic TMDB paginated response wrapper. */
export interface TmdbPagedResponse<T> {
  results: T[];
}

/** One result from /search/multi — covers person, movie, and tv. */
export interface TmdbMultiSearchResult {
  id: number;
  media_type: 'person' | 'movie' | 'tv';
  name?: string;
  title?: string;
  profile_path?: string | null;
  poster_path?: string | null;
  known_for_department?: string;
  known_for?: TmdbKnownFor[];
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
}

/** Cast entry from /movie/{id}/credits. */
export interface TmdbMovieCastRaw {
  id: number;
  name: string;
  character?: string;
  profile_path: string | null;
  known_for_department?: string;
  popularity?: number;
}

/** Crew entry from /movie/{id}/credits. */
export interface TmdbMovieCrewRaw {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profile_path: string | null;
  known_for_department?: string;
  popularity?: number;
}

/** Response shape for /movie/{id}/credits. */
export interface TmdbMovieCreditsResponse {
  cast: TmdbMovieCastRaw[];
  crew: TmdbMovieCrewRaw[];
}

/** Cast entry from /tv/{id}/aggregate_credits. */
export interface TmdbTvCastRaw {
  id: number;
  name: string;
  profile_path: string | null;
  department?: string;
  popularity?: number;
  roles?: Array<{ character: string }>;
}

/** Crew entry from /tv/{id}/aggregate_credits. */
export interface TmdbTvCrewRaw {
  id: number;
  name: string;
  profile_path: string | null;
  department?: string;
  popularity?: number;
  jobs?: Array<{ job: string }>;
}

/** Response shape for /tv/{id}/aggregate_credits. */
export interface TmdbTvAggregateCreditsResponse {
  cast: TmdbTvCastRaw[];
  crew: TmdbTvCrewRaw[];
}

export interface TmdbCombinedCredit {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv';
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  popularity?: number;
  character?: string;
  job?: string;
  department?: string;
  overview?: string;
}

/**
 * A film or TV show as a searchable/selectable slot item.
 * `name` is normalised from TMDB's `title` (movie) or `name` (tv).
 */
export interface TmdbTitle {
  id: number;
  name: string;
  media_type: 'movie' | 'tv';
  poster_path: string | null;
  release_date: string; // normalised from release_date / first_air_date
  vote_average: number;
  overview?: string;
}

/** A person as they appear in a title's cast or crew list. */
export interface CastMember {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  popularity: number;
  roles: string[];
  roleCategories: RoleCategory[];
}

/** CastMember enriched with per-slot role data (parallel to ProjectWithRoles). */
export interface CastMemberInRegion extends CastMember {
  /** rolesBySlot[i] = roles this person had in title slot i. */
  rolesBySlot: Record<number, string[]>;
}

/** Type guard — true when the slot holds a person (not a title). */
export function isPersonSlot(slot: TmdbPerson | TmdbTitle | null): slot is TmdbPerson {
  return slot !== null && 'known_for_department' in slot;
}

/** Determines which search/fetch mode a slot collection is in. */
export type SearchMode = 'person' | 'title';

// ── App-level types ───────────────────────────────────────────────────────────

export type RoleCategory = 'actor' | 'self' | 'director' | 'writer' | 'crew';

export const ALL_ROLE_CATS: RoleCategory[] = ['actor', 'self', 'director', 'writer', 'crew'];

export const EMPTY_ROLE_COUNTS: Record<RoleCategory, number> = {
  actor: 0,
  self: 0,
  director: 0,
  writer: 0,
  crew: 0,
};

export const ROLE_LABELS: Record<RoleCategory, string> = {
  actor: 'Actor',
  self: 'Self',
  director: 'Director',
  writer: 'Writer',
  crew: 'Crew',
};

export interface Project {
  id: number;
  title: string;
  media_type: 'movie' | 'tv';
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  popularity: number;
  roles: string[];
  roleCategories: RoleCategory[];
}

/**
 * A project enriched with per-person role data.
 * `rolesByPerson[i]` = roles person i had on this project.
 * Only populated for person indices whose bit is set in the project's region mask.
 */
export interface ProjectWithRoles extends Project {
  rolesByPerson: Record<number, string[]>;
}

export type SortBy = 'popularity' | 'date-desc' | 'date-asc' | 'rating-desc' | 'alpha';
export type CastSortBy = 'alpha' | 'popularity' | 'roles';
export type MediaFilter = 'all' | 'movie' | 'tv';

/** Bitmask: bit i is set if slot i is included in this Venn region. */
export type RegionMask = number;

// ── Per-slot accent colours — Re-Animator palette (max 5) ────────────────────
export const PERSON_COLORS = [
  '#6bff2a', // 0 – serum green
  '#c8e020', // 1 – sickly yellow
  '#2bc9ff', // 2 – morgue blue
  '#d41c1c', // 3 – blood red
  '#c87dff', // 4 – formaldehyde violet
] as const;

// ── Region computation ────────────────────────────────────────────────────────

/** Shared algorithm for partitioning any item array into exclusive Venn regions. */
function computeRegionsBase<TItem extends { id: number; roles: string[] }, TEnriched>(
  arrays: TItem[][],
  uid: (item: TItem) => string,
  enrich: (item: TItem) => TEnriched,
  assign: (enriched: TEnriched, slotIdx: number, roles: string[]) => void,
): Map<RegionMask, TEnriched[]> {
  const result = new Map<RegionMask, TEnriched[]>();
  const maskMap = new Map<string, RegionMask>();
  const dataMap = new Map<string, TEnriched>();

  for (let i = 0; i < arrays.length; i++) {
    for (const item of arrays[i]) {
      if (!item.id) {
        continue;
      }
      const key = uid(item);
      maskMap.set(key, (maskMap.get(key) ?? 0) | (1 << i));
      if (!dataMap.has(key)) {
        dataMap.set(key, enrich(item));
      }
      assign(dataMap.get(key)!, i, item.roles);
    }
  }

  for (const [key, mask] of maskMap) {
    if (!result.has(mask)) {
      result.set(mask, []);
    }
    result.get(mask)!.push(dataMap.get(key)!);
  }

  return result;
}

/**
 * Partition projects into exclusive Venn regions (person mode).
 * Returns a Map from RegionMask to the projects in that exclusive region.
 */
export function computeRegions(creditArrays: Project[][]): Map<RegionMask, ProjectWithRoles[]> {
  return computeRegionsBase(
    creditArrays,
    (item) => `${(item as Project).media_type}-${item.id}`,
    (item) => ({ ...(item as Project), rolesByPerson: {} as Record<number, string[]> }),
    (enriched, i, roles) => {
      enriched.rolesByPerson[i] = roles;
    },
  );
}

/**
 * Partition cast members into exclusive Venn regions (title mode).
 * Returns a Map from RegionMask to the cast members in that exclusive region.
 */
export function computeRegionsCast(castArrays: CastMember[][]): Map<RegionMask, CastMemberInRegion[]> {
  return computeRegionsBase(
    castArrays,
    (item) => `person-${item.id}`,
    (item) => ({ ...(item as CastMember), rolesBySlot: {} as Record<number, string[]> }),
    (enriched, i, roles) => {
      enriched.rolesBySlot[i] = roles;
    },
  );
}
