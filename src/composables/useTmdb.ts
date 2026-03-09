import type { Ref } from 'vue'
import type { TmdbPerson, TmdbTitle, TmdbCombinedCredit, Project, CastMember, RoleCategory } from '@/types/tmdb'

const TMDB_BASE = 'https://api.themoviedb.org/3'

export const IMG_BASE   = 'https://image.tmdb.org/t/p/'
export const profileUrl = (path: string | null) => path ? `${IMG_BASE}w185${path}` : ''
export const posterUrl  = (path: string | null) => path ? `${IMG_BASE}w154${path}` : ''
export const tmdbUrl    = (mediaType: string, id: number) =>
  `https://www.themoviedb.org/${mediaType}/${id}`

// ── Role category classifiers ─────────────────────────────────────────────────

// Matches "Self", "Himself", "Herself", "Theirself/Theirselves" and variants
const SELF_RE = /^\s*(self|him\s*self|her\s*self|their\s*sel(f|ves?))\b/i

function charCategory(character: string): RoleCategory {
  if (!character || SELF_RE.test(character)) return 'self'
  return 'actor'
}

function jobCategory(job: string): RoleCategory {
  const j = job.toLowerCase()
  if (j === 'director') return 'director'
  if (
    j.includes('writ') ||
    ['screenplay', 'story', 'teleplay', 'novel', 'script'].some(w => j.includes(w))
  ) return 'writer'
  return 'crew'
}

function roleCategory(c: TmdbCombinedCredit): RoleCategory {
  if (c.character !== undefined) return charCategory(c.character)
  return jobCategory(c.job ?? '')
}

// ─────────────────────────────────────────────────────────────────────────────

export function useTmdb(apiKey: Ref<string>) {
  async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(TMDB_BASE + path)
    url.searchParams.set('api_key', apiKey.value)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`TMDB ${res.status}: ${res.statusText}`)
    return res.json() as Promise<T>
  }

  // ── Person search ───────────────────────────────────────────────────────────

  async function searchPeople(query: string): Promise<TmdbPerson[]> {
    if (!query.trim() || !apiKey.value) return []
    const data = await request<{ results: TmdbPerson[] }>('/search/person', {
      query,
      include_adult: 'false',
    })
    return data.results ?? []
  }

  async function fetchCredits(personId: number): Promise<Project[]> {
    const data = await request<{
      cast: TmdbCombinedCredit[]
      crew: TmdbCombinedCredit[]
    }>(`/person/${personId}/combined_credits`)

    const all = [...(data.cast ?? []), ...(data.crew ?? [])]
    const map = new Map<string, Project>()

    for (const c of all) {
      if (!c.id) continue
      const key  = `${c.media_type}-${c.id}`
      const role = c.character ?? c.job ?? ''
      const cat  = roleCategory(c)
      const existing = map.get(key)

      if (existing) {
        if (role && !existing.roles.includes(role)) existing.roles.push(role)
        if (!existing.roleCategories.includes(cat)) existing.roleCategories.push(cat)
      } else {
        map.set(key, {
          id:             c.id,
          title:          c.title ?? c.name ?? 'Untitled',
          media_type:     c.media_type,
          poster_path:    c.poster_path ?? null,
          release_date:   c.release_date ?? c.first_air_date ?? '',
          vote_average:   c.vote_average ?? 0,
          popularity:     c.popularity ?? 0,
          roles:          role ? [role] : [],
          roleCategories: [cat],
        })
      }
    }

    return [...map.values()]
  }

  // ── Title search + cast fetch ───────────────────────────────────────────────

  /**
   * Search for films and TV shows via /search/multi.
   * Results are filtered to movie/tv only and normalised to TmdbTitle.
   */
  async function searchTitles(query: string): Promise<TmdbTitle[]> {
    if (!query.trim() || !apiKey.value) return []
    const data = await request<{
      results: Array<{
        id: number
        title?: string
        name?: string
        media_type: string
        poster_path: string | null
        release_date?: string
        first_air_date?: string
        vote_average?: number
        overview?: string
      }>
    }>('/search/multi', { query, include_adult: 'false' })

    return (data.results ?? [])
      .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
      .map(r => ({
        id:           r.id,
        name:         r.title ?? r.name ?? 'Untitled',
        media_type:   r.media_type as 'movie' | 'tv',
        poster_path:  r.poster_path ?? null,
        release_date: r.release_date ?? r.first_air_date ?? '',
        vote_average: r.vote_average ?? 0,
        overview:     r.overview,
      }))
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
    const map = new Map<number, CastMember>()

    function upsert(id: number, name: string, profile_path: string | null, dept: string | undefined, popularity: number, role: string, cat: RoleCategory): void {
      const existing = map.get(id)
      if (existing) {
        if (role && !existing.roles.includes(role)) existing.roles.push(role)
        if (!existing.roleCategories.includes(cat)) existing.roleCategories.push(cat)
      } else {
        map.set(id, {
          id,
          name,
          profile_path:         profile_path ?? null,
          known_for_department: dept,
          popularity,
          roles:                role ? [role] : [],
          roleCategories:       [cat],
        })
      }
    }

    if (mediaType === 'movie') {
      const data = await request<{
        cast: Array<{ id: number; name: string; character?: string; profile_path: string | null; known_for_department?: string; popularity?: number }>
        crew: Array<{ id: number; name: string; job?: string; department?: string; profile_path: string | null; known_for_department?: string; popularity?: number }>
      }>(`/movie/${titleId}/credits`)

      for (const c of data.cast ?? [])
        upsert(c.id, c.name, c.profile_path, c.known_for_department, c.popularity ?? 0, c.character ?? '', charCategory(c.character ?? ''))
      for (const c of data.crew ?? [])
        upsert(c.id, c.name, c.profile_path, c.department, c.popularity ?? 0, c.job ?? '', jobCategory(c.job ?? ''))

    } else {
      // TV: aggregate_credits collapses multi-season appearances into one entry
      const data = await request<{
        cast: Array<{ id: number; name: string; profile_path: string | null; department?: string; popularity?: number; roles?: Array<{ character: string }> }>
        crew: Array<{ id: number; name: string; profile_path: string | null; department?: string; popularity?: number; jobs?: Array<{ job: string }> }>
      }>(`/tv/${titleId}/aggregate_credits`)

      for (const c of data.cast ?? []) {
        const chars = c.roles?.map(r => r.character).filter(Boolean) ?? []
        const role  = chars[0] ?? ''
        upsert(c.id, c.name, c.profile_path, c.department, c.popularity ?? 0, role, charCategory(role))
      }
      for (const c of data.crew ?? []) {
        const job = c.jobs?.[0]?.job ?? ''
        upsert(c.id, c.name, c.profile_path, c.department, c.popularity ?? 0, job, jobCategory(job))
      }
    }

    return [...map.values()]
  }

  /**
   * Search for people AND titles together via /search/multi.
   * Used in unset mode (first slot, before mode is locked).
   * Returns a mixed array; callers use isPersonSlot() to discriminate.
   */
  async function searchAll(query: string): Promise<(TmdbPerson | TmdbTitle)[]> {
    if (!query.trim() || !apiKey.value) return []
    const data = await request<{
      results: Array<{
        id: number
        media_type: 'person' | 'movie' | 'tv'
        name?: string
        title?: string
        profile_path?: string | null
        poster_path?: string | null
        known_for_department?: string
        known_for?: Array<{ id: number; title?: string; name?: string; media_type: string }>
        release_date?: string
        first_air_date?: string
        vote_average?: number
        overview?: string
      }>
    }>('/search/multi', { query, include_adult: 'false' })

    return (data.results ?? []).flatMap(r => {
      if (r.media_type === 'person') {
        return [{
          id:                   r.id,
          name:                 r.name ?? '',
          profile_path:         r.profile_path ?? null,
          known_for_department: r.known_for_department ?? '',
          known_for:            (r.known_for ?? []).map(k => ({
            id: k.id, title: k.title, name: k.name, media_type: k.media_type,
          })),
        } satisfies TmdbPerson]
      }
      if (r.media_type === 'movie' || r.media_type === 'tv') {
        return [{
          id:           r.id,
          name:         r.title ?? r.name ?? 'Untitled',
          media_type:   r.media_type,
          poster_path:  r.poster_path ?? null,
          release_date: r.release_date ?? r.first_air_date ?? '',
          vote_average: r.vote_average ?? 0,
          overview:     r.overview,
        } satisfies TmdbTitle]
      }
      return []
    })
  }

  return { searchPeople, fetchCredits, searchTitles, searchAll, fetchCast }
}
