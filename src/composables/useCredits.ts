import { ref } from 'vue'
import type { Ref } from 'vue'
import type { TmdbPerson, TmdbTitle, Project, CastMember } from '@/types/tmdb'
import { useTmdb } from '@/composables/useTmdb'

interface CacheEntry { persons: TmdbPerson[]; credits: Project[][] }
const CACHE_MAX = 20

// ── HMR persistence (module-level singleton so the cache survives hot-reloads) ─
interface HotData { creditsCache?: Map<string, CacheEntry> }
const _hot = (import.meta.hot?.data ?? {}) as HotData
const creditsCache = ref<Map<string, CacheEntry>>(_hot.creditsCache ?? new Map())
if (import.meta.hot) {
  import.meta.hot.dispose((data: Record<string, unknown>) => {
    data.creditsCache = creditsCache.value
  })
}

function cacheKey(ps: TmdbPerson[]): string {
  return [...ps].map(p => p.id).sort((a, b) => a - b).join(',')
}

export function useCredits(apiKey: Ref<string>) {
  const { fetchCredits, fetchCast } = useTmdb(apiKey)
  const isLoading = ref(false)

  /** Returns cached credits for the given people, or null on a cache miss. */
  function getCached(people: TmdbPerson[]): Project[][] | null {
    return creditsCache.value.get(cacheKey(people))?.credits ?? null
  }

  /**
   * Fetches credits for every person in parallel, populates the cache
   * (FIFO eviction at CACHE_MAX), and returns the results.
   * Throws on network error — caller is responsible for error handling.
   */
  async function fetchAll(people: TmdbPerson[]): Promise<Project[][]> {
    isLoading.value = true
    try {
      const results = await Promise.all(people.map(p => fetchCredits(p.id)))
      const key = cacheKey(people)
      creditsCache.value.set(key, { persons: [...people], credits: results })
      if (creditsCache.value.size > CACHE_MAX) {
        creditsCache.value.delete(creditsCache.value.keys().next().value!)
      }
      return results
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetches cast + crew for every title in parallel.
   * No caching for title mode — cast lists are smaller and less likely to
   * be repeated within a session.
   * Throws on network error — caller is responsible for error handling.
   */
  async function fetchAllCast(titles: TmdbTitle[]): Promise<CastMember[][]> {
    isLoading.value = true
    try {
      return await Promise.all(titles.map(t => fetchCast(t.id, t.media_type)))
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, getCached, fetchAll, fetchAllCast }
}
