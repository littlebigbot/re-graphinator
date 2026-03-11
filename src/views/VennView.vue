<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type {
  TmdbPerson,
  TmdbTitle,
  ProjectWithRoles,
  CastMemberInRegion,
  RegionMask,
  MediaFilter,
  SortBy,
  CastSortBy,
} from '@/types/tmdb';
import type { HistoryEntry } from '@/composables/useHistory';
import { PERSON_COLORS, ALL_ROLE_CATS } from '@/types/tmdb';
import { useTheme } from '@/composables/useTheme';
import { useCredits } from '@/composables/useCredits';
import { useTmdb } from '@/composables/useTmdb';
import { useVennState } from '@/composables/useVennState';
import { useHistory } from '@/composables/useHistory';
import { surname } from '@/utils/names';
import { projectComparator, castComparator } from '@/utils/sort';
import { collectRegionItems } from '@/utils/bitmask';
import VennDiagram from '@/components/VennDiagram.vue';
import MovieGrid from '@/components/MovieGrid.vue';
import CastGrid from '@/components/CastGrid.vue';
import SearchHistory from '@/components/SearchHistory.vue';
import RoleFilterDropdown from '@/components/RoleFilterDropdown.vue';
import DebugPanel from '@/components/DebugPanel.vue';

useTheme();

const route = useRoute();
const router = useRouter();

const { isLoading, getCached, fetchAll, fetchAllCast } = useCredits();
const { savePerson: savePersonHistory, saveTitle: saveTitleHistory } = useHistory();
const historyRef = ref<InstanceType<typeof SearchHistory> | null>(null);

const {
  slots,
  credits,
  castLists,
  personRoleFilters,
  hasResults,
  selectedMask,
  enabledMask,
  allMask,
  activePeople,
  activeTitles,
  selfEnabled,
  personRoleCounts,
  filteredCredits,
  filteredCastLists,
  regions,
  titleRegions,
  searchMode,
  addSlot,
  removeSlot,
  removeSlotAt,
  compactSlots,
  handleSlotUpdate,
  clearSearch,
  updateRoleFilter,
  toggleSelf,
  setSlots,
  defaultSelfEnabled,
  toggleDefaultSelf,
  applyPersonResults,
  applyTitleResults,
} = useVennState();

const activeType = ref<MediaFilter>('all');
const sortBy = ref<SortBy>('popularity');
const castSortBy = ref<CastSortBy>('popularity');

const typeFilters: { label: string; value: MediaFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Films', value: 'movie' },
  { label: 'TV', value: 'tv' },
];

const regionCounts = computed<Map<RegionMask, number>>(() => {
  const regionMap = new Map<RegionMask, number>();
  const source = searchMode.value === 'title' ? titleRegions.value : regions.value;
  for (const [mask, items] of source) {
    const count =
      searchMode.value === 'title' || activeType.value === 'all'
        ? items.length
        : (items as ProjectWithRoles[]).filter((project) => project.media_type === activeType.value).length;
    regionMap.set(mask, count);
  }
  return regionMap;
});

const displayItems = computed<ProjectWithRoles[]>(() => {
  if (searchMode.value === 'title') {
    return [];
  }
  const mask = selectedMask.value > 0 ? selectedMask.value : allMask.value;
  const raw = collectRegionItems(regions.value, mask);
  const filtered = activeType.value === 'all' ? raw : raw.filter((project) => project.media_type === activeType.value);
  return filtered.sort(projectComparator(sortBy.value));
});

const displayCastItems = computed<CastMemberInRegion[]>(() => {
  if (searchMode.value !== 'title') {
    return [];
  }
  const mask = selectedMask.value > 0 ? selectedMask.value : allMask.value;
  return collectRegionItems(titleRegions.value, mask).sort(castComparator(castSortBy.value));
});

const { fetchPersonById, fetchTitleById } = useTmdb();

function updatePermalink(): void {
  const params = new URLSearchParams();
  if (searchMode.value === 'title') {
    params.set('mode', 'title');
    params.set('ids', activeTitles.value.map((title) => `${title.id}:${title.media_type}`).join(','));
  } else {
    params.set('mode', 'person');
    params.set('ids', activePeople.value.map((person) => person.id).join(','));
  }

  router.replace({
    name: 'venn',
    query: Object.fromEntries(params.entries()),
  });
}

onMounted(async () => {
  const modeParam = route.query.mode;
  const idsParam = route.query.ids;
  const mode = typeof modeParam === 'string' ? (modeParam as 'person' | 'title') : null;
  const ids = typeof idsParam === 'string' ? idsParam : null;

  if (!mode || !ids) {
    return;
  }

  try {
    if (mode === 'person') {
      const idList = ids.split(',').map(Number).filter(Boolean);
      if (idList.length < 2) {
        return;
      }
      const people = await Promise.all(idList.map(fetchPersonById));
      setSlots(people);
      applyPersonResults(await fetchAll(people));
    } else {
      const entries = ids
        .split(',')
        .map((entry) => {
          const [id, mediaType] = entry.split(':');
          return { id: Number(id), mediaType: mediaType as 'movie' | 'tv' };
        })
        .filter((entry) => entry.id && entry.mediaType);
      if (entries.length < 2) {
        return;
      }
      const titles = await Promise.all(entries.map((entry) => fetchTitleById(entry.id, entry.mediaType)));
      setSlots(titles);
      applyTitleResults(await fetchAllCast(titles));
    }
    updatePermalink();
  } catch (err) {
    console.warn('Failed to restore from URL:', err);
  }
});

async function runCompare(): Promise<void> {
  compactSlots();
  hasResults.value = false;
  try {
    if (searchMode.value === 'title') {
      if (activeTitles.value.length < 2) {
        return;
      }
      applyTitleResults(await fetchAllCast(activeTitles.value));
      saveTitleHistory(activeTitles.value);
      historyRef.value?.refresh();
    } else {
      if (activePeople.value.length < 2) {
        return;
      }
      applyPersonResults(await fetchAll(activePeople.value));
      savePersonHistory(activePeople.value);
      historyRef.value?.refresh();
    }
    updatePermalink();
  } catch (err) {
    alert(`Error fetching data: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function startWithTitle(item: ProjectWithRoles): void {
  clearSearch();
  const title: TmdbTitle = {
    id: item.id,
    name: item.title,
    media_type: item.media_type,
    poster_path: item.poster_path,
    release_date: item.release_date,
    vote_average: item.vote_average,
  };
  handleSlotUpdate(0, title);
}

function startWithPerson(member: CastMemberInRegion): void {
  clearSearch();
  const person: TmdbPerson = {
    id: member.id,
    name: member.name,
    profile_path: member.profile_path,
    known_for_department: member.known_for_department ?? 'Acting',
    known_for: [],
  };
  handleSlotUpdate(0, person);
}

async function restoreSearch(entry: HistoryEntry): Promise<void> {
  if (entry.mode === 'title') {
    setSlots(entry.titles);
    await runCompare();
  } else {
    setSlots(entry.persons);
    const cached = getCached(entry.persons);
    if (cached) {
      applyPersonResults(cached);
    } else {
      await runCompare();
    }
  }
}
</script>

<template>
  <SearchHistory ref="historyRef" @restore="restoreSearch" />

  <main class="main">
    <VennDiagram
      :slots="slots"
      :search-mode="searchMode"
      :has-results="hasResults"
      :is-loading="isLoading"
      :region-counts="regionCounts"
      :enabled-mask="enabledMask"
      :selected-mask="selectedMask"
      :person-role-filters="personRoleFilters"
      :person-role-counts="personRoleCounts"
      :self-enabled="selfEnabled"
      :default-self-enabled="defaultSelfEnabled"
      :credits="credits"
      :cast-lists="filteredCastLists"
      @update:slot="(idx, val) => handleSlotUpdate(idx, val)"
      @clear-slot="removeSlotAt"
      @select="selectedMask = $event > 0 ? $event : allMask"
      @update-role-filter="updateRoleFilter"
      @toggle-self="toggleSelf"
      @toggle-default-self="toggleDefaultSelf"
      @add-slot="addSlot"
      @remove-slot="removeSlot"
      @run-compare="runCompare"
      @clear-search="clearSearch"
    />

    <template v-if="hasResults">
      <div v-if="searchMode !== 'title'" class="grid-controls">
        <div class="controls-left">
          <button
            v-for="f in typeFilters"
            :key="f.value"
            class="filter-btn"
            :class="{ active: activeType === f.value }"
            @click="activeType = f.value"
          >
            {{ f.label }}
          </button>
          <span v-for="(p, i) in activePeople" :key="i" class="person-filter">
            <span class="person-filter-name" :style="`color: ${PERSON_COLORS[i]}`">
              {{ surname(p.name) }}
            </span>
            <RoleFilterDropdown
              :model-value="personRoleFilters[i] ?? ALL_ROLE_CATS"
              :counts="personRoleCounts[i] ?? {}"
              :color="PERSON_COLORS[i]"
              :number-mode="true"
              :total-count="filteredCredits[i]?.length ?? 0"
              @update:model-value="updateRoleFilter(i, $event)"
            />
          </span>
        </div>
        <select
          class="sort-select"
          :value="sortBy"
          @change="sortBy = ($event.target as HTMLSelectElement).value as SortBy"
        >
          <option value="popularity">Most popular</option>
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="rating-desc">Highest rated</option>
          <option value="alpha">A–Z</option>
        </select>
      </div>

      <MovieGrid
        v-if="searchMode !== 'title'"
        :items="displayItems"
        :persons="activePeople"
        :selected-mask="selectedMask"
        @compare-with="startWithTitle"
      />

      <CastGrid
        v-else
        :items="displayCastItems"
        :titles="slots as TmdbTitle[]"
        :selected-mask="selectedMask"
        :sort-by="castSortBy"
        @update:sort-by="castSortBy = $event"
        @compare-with="startWithPerson"
      />
    </template>
  </main>

  <DebugPanel :data="{ slots, credits, castLists, searchMode }" />
</template>

<style scoped>
.main {
  max-width: 1160px;
  margin: 0 auto;
  padding: 36px 32px;
  width: 100%;
}

.grid-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.controls-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.person-filter {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.person-filter-name {
  font-size: 0.74rem;
  font-weight: 600;
}

.sort-select {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 5px 10px;
  font-size: 0.78rem;
  outline: none;
  flex-shrink: 0;
}

.filter-btn {
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: none;
  color: var(--text-2);
  font-size: 0.74rem;
  letter-spacing: 0.01em;
  transition: all 0.15s;
}

.filter-btn:hover {
  background: var(--surface2);
  color: var(--text);
}
.filter-btn.active {
  background: var(--accent-dim);
  border-color: rgba(var(--accent-rgb), 0.3);
  color: var(--accent);
}

@media (max-width: 640px) {
  .main {
    padding: 20px 16px;
  }
}
</style>
