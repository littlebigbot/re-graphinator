import { ref } from 'vue';
import type { TmdbPerson, TmdbTitle, SearchMode } from '@/types/tmdb';
import { useTmdb } from '@/composables/useTmdb';
import { useDebounce } from '@/composables/useDebounce';

/**
 * Shared search-dropdown logic: debounced TMDB search, mode switching,
 * result capping, and open/close state.
 *
 * @param getSearchMode - getter that returns the current SearchMode (or null for mixed)
 * @param onResults     - optional callback fired after each new result set arrives
 */
export function useSearchDropdown(getSearchMode: () => SearchMode | null, onResults?: () => void) {
  const { searchPeople, searchTitles, searchAll } = useTmdb();
  const dropdown = ref<(TmdbPerson | TmdbTitle)[]>([]);
  const showDrop = ref(false);
  const lastQuery = ref('');
  const abortRef = ref<AbortController | null>(null);

  const search = useDebounce(async (query: string) => {
    if (query.length < 3) {
      lastQuery.value = '';
      abortRef.value?.abort();
      dropdown.value = [];
      showDrop.value = false;
      return;
    }

    // Track the latest query to avoid stale responses overwriting newer ones.
    lastQuery.value = query;

    // Cancel any in-flight request.
    abortRef.value?.abort();
    const controller = new AbortController();
    abortRef.value = controller;

    try {
      const mode = getSearchMode();
      const results =
        mode === 'person'
          ? await searchPeople(query, controller.signal)
          : mode === 'title'
            ? await searchTitles(query, controller.signal)
            : await searchAll(query, controller.signal);

      // If another query has started since this one, ignore these results.
      if (query !== lastQuery.value || controller.signal.aborted) {
        return;
      }

      dropdown.value = results.slice(0, 7);
      showDrop.value = dropdown.value.length > 0;
      onResults?.();
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        return;
      }
      console.warn('search error:', e);
    }
  }, 400);

  return { dropdown, showDrop, search };
}
