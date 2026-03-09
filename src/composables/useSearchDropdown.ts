import { ref } from 'vue';
import type { Ref } from 'vue';
import type { TmdbPerson, TmdbTitle, SearchMode } from '@/types/tmdb';
import { useTmdb } from '@/composables/useTmdb';
import { useDebounce } from '@/composables/useDebounce';

/**
 * Shared search-dropdown logic: debounced TMDB search, mode switching,
 * result capping, and open/close state.
 *
 * @param apiKey        - reactive API key ref
 * @param getSearchMode - getter that returns the current SearchMode (or null for mixed)
 * @param onResults     - optional callback fired after each new result set arrives
 */
export function useSearchDropdown(apiKey: Ref<string>, getSearchMode: () => SearchMode | null, onResults?: () => void) {
  const { searchPeople, searchTitles, searchAll } = useTmdb(apiKey);
  const dropdown = ref<(TmdbPerson | TmdbTitle)[]>([]);
  const showDrop = ref(false);

  const search = useDebounce(async (query: string) => {
    if (query.length < 3) {
      dropdown.value = [];
      showDrop.value = false;
      return;
    }
    try {
      const mode = getSearchMode();
      const results =
        mode === 'person'
          ? await searchPeople(query)
          : mode === 'title'
            ? await searchTitles(query)
            : await searchAll(query);
      dropdown.value = results.slice(0, 7);
      showDrop.value = dropdown.value.length > 0;
      onResults?.();
    } catch (e) {
      console.warn('search error:', e);
    }
  }, 400);

  return { dropdown, showDrop, search };
}
