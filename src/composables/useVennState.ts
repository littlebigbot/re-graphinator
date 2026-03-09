/**
 * useVennState — owns all Venn-specific reactive state, derived values,
 * and mutation operations.
 *
 * Supports two modes:
 *  - 'person': slots hold TmdbPerson; regions contain overlapping projects.
 *  - 'title' : slots hold TmdbTitle;  regions contain overlapping cast members.
 *
 * Mode is null until the first slot is filled, at which point it locks to
 * whichever type was selected. Clearing all slots resets mode to null.
 *
 * Singleton pattern (module-level refs) is intentional — keeps HMR state
 * persistence simple.
 */
import { ref, computed, watch } from 'vue';
import type { TmdbPerson, TmdbTitle, Project, CastMember, RegionMask, RoleCategory, SearchMode } from '@/types/tmdb';
import { computeRegions, computeRegionsCast, ALL_ROLE_CATS, EMPTY_ROLE_COUNTS, isPersonSlot } from '@/types/tmdb';
import { isToggleDisabled } from '@/utils/bitmask';

export const DEFAULT_ROLE_CATS: RoleCategory[] = ALL_ROLE_CATS.filter((category) => category !== 'self');

// ── Persisted settings ────────────────────────────────────────────────────────
const LS_DEFAULT_SELF = 'rg_defaultSelfEnabled';
const defaultSelfEnabled = ref<boolean>(localStorage.getItem(LS_DEFAULT_SELF) === 'true');
watch(defaultSelfEnabled, (value) => localStorage.setItem(LS_DEFAULT_SELF, String(value)));

function toggleDefaultSelf(): void {
  defaultSelfEnabled.value = !defaultSelfEnabled.value;
}

/** Role categories to use when initialising a new slot, honouring the default-self preference. */
function defaultRoleCats(): RoleCategory[] {
  return defaultSelfEnabled.value ? [...ALL_ROLE_CATS] : [...DEFAULT_ROLE_CATS];
}

export const MAX_PERSONS = 5;
export const MIN_PERSONS = 2;

// ── Module-level state (singleton — survives HMR) ─────────────────────────────
interface HotData {
  slots?: (TmdbPerson | TmdbTitle | null)[];
  credits?: Project[][];
  castLists?: CastMember[][];
  searchMode?: SearchMode | null;
  hasResults?: boolean;
  selectedMask?: number;
  enabledMask?: number;
  personRoleFilters?: RoleCategory[][];
}
const _hot = (import.meta.hot?.data ?? {}) as HotData;

const slots = ref<(TmdbPerson | TmdbTitle | null)[]>(_hot.slots ?? [null, null]);
const credits = ref<Project[][]>(_hot.credits ?? [[], []]);
const castLists = ref<CastMember[][]>(_hot.castLists ?? [[], []]);
const searchMode = ref<SearchMode | null>(_hot.searchMode ?? null);
const personRoleFilters = ref<RoleCategory[][]>(
  _hot.personRoleFilters ?? [[...DEFAULT_ROLE_CATS], [...DEFAULT_ROLE_CATS]],
);
const hasResults = ref<boolean>(_hot.hasResults ?? false);
const selectedMask = ref<RegionMask>(_hot.selectedMask ?? 0);
const enabledMask = ref<number>(_hot.enabledMask ?? 0);

if (import.meta.hot) {
  import.meta.hot.dispose((data: Record<string, unknown>) => {
    data.slots = slots.value;
    data.credits = credits.value;
    data.castLists = castLists.value;
    data.searchMode = searchMode.value;
    data.hasResults = hasResults.value;
    data.selectedMask = selectedMask.value;
    data.enabledMask = enabledMask.value;
    data.personRoleFilters = personRoleFilters.value;
  });
}

// ── Derived state ─────────────────────────────────────────────────────────────
const N = computed(() => slots.value.length);
const allMask = computed(() => (1 << N.value) - 1);

/** Non-null person slots (person mode). */
const activePeople = computed(() => slots.value.filter((slot): slot is TmdbPerson => isPersonSlot(slot)));

/** Non-null title slots (title mode). */
const activeTitles = computed(() =>
  slots.value.filter((slot): slot is TmdbTitle => slot !== null && !isPersonSlot(slot)),
);

const selfEnabled = computed(() => personRoleFilters.value.every((filter) => filter.includes('self')));

const personRoleCounts = computed(() =>
  credits.value.map((arr) => {
    const counts: Record<RoleCategory, number> = { ...EMPTY_ROLE_COUNTS };
    for (const project of arr) {
      for (const category of project.roleCategories) {
        counts[category]++;
      }
    }
    return counts;
  }),
);

const filteredCredits = computed<Project[][]>(() =>
  credits.value.map((arr, i) => {
    const allowed = personRoleFilters.value[i] ?? ALL_ROLE_CATS;
    if (allowed.length === ALL_ROLE_CATS.length) {
      return arr;
    }
    return arr.filter((project) => project.roleCategories.some((category) => allowed.includes(category)));
  }),
);

/** Exclusive Venn regions for person mode (projects per region). */
const regions = computed(() =>
  hasResults.value && searchMode.value !== 'title' ? computeRegions(filteredCredits.value) : new Map(),
);

/** castLists with 'self'-only members removed when self is disabled. */
const filteredCastLists = computed<CastMember[][]>(() =>
  selfEnabled.value
    ? castLists.value
    : castLists.value.map((arr) =>
        arr.filter((member) => member.roleCategories.some((category) => category !== 'self')),
      ),
);

/** Exclusive Venn regions for title mode (cast members per region). */
const titleRegions = computed(() =>
  hasResults.value && searchMode.value === 'title' ? computeRegionsCast(filteredCastLists.value) : new Map(),
);

// Reset selected region whenever the enabled set changes
watch(enabledMask, () => {
  selectedMask.value = allMask.value;
});

// ── Slot-parallel array helpers ───────────────────────────────────────────────
// slots / credits / castLists / personRoleFilters are always the same length
// and index-aligned.  These helpers keep every mutation consistent so you
// never have to remember to update all four arrays manually.

/** Keep only indices where pred(i) is true — used by removeSlotAt and compactSlots. */
function filterSlotArrays(pred: (i: number) => boolean): void {
  slots.value = slots.value.filter((_, i) => pred(i));
  credits.value = credits.value.filter((_, i) => pred(i));
  castLists.value = castLists.value.filter((_, i) => pred(i));
  personRoleFilters.value = personRoleFilters.value.filter((_, i) => pred(i));
}

/** Append one new empty slot (with default role filter) to all arrays. */
function pushSlot(): void {
  slots.value = [...slots.value, null];
  credits.value = [...credits.value, []];
  castLists.value = [...castLists.value, []];
  personRoleFilters.value = [...personRoleFilters.value, defaultRoleCats()];
}

/** Remove the last slot from all arrays. */
function popSlot(): void {
  slots.value = slots.value.slice(0, -1);
  credits.value = credits.value.slice(0, -1);
  castLists.value = castLists.value.slice(0, -1);
  personRoleFilters.value = personRoleFilters.value.slice(0, -1);
}

// ── Actions ───────────────────────────────────────────────────────────────────
function addSlot(): void {
  if (slots.value.length >= MAX_PERSONS) {
    return;
  }
  pushSlot();
  hasResults.value = false;
}

function removeSlot(): void {
  if (slots.value.length <= MIN_PERSONS) {
    return;
  }
  popSlot();
  hasResults.value = false;
}

/** Remove slot at index (or just clear it if already at minimum slot count). */
function removeSlotAt(idx: number): void {
  if (slots.value.length > MIN_PERSONS) {
    filterSlotArrays((i) => i !== idx);
  } else {
    // At minimum count: clear the slot in-place rather than shrinking the array
    slots.value = slots.value.map((slotItem, i) => (i === idx ? null : slotItem));
    credits.value = credits.value.map((creditArr, i) => (i === idx ? [] : creditArr));
    castLists.value = castLists.value.map((castArr, i) => (i === idx ? [] : castArr));
  }
  hasResults.value = false;
  if (slots.value.every((slot) => slot === null)) {
    searchMode.value = null;
  }
}

function handleSlotUpdate(idx: number, val: TmdbPerson | TmdbTitle | null): void {
  const updatedSlots = [...slots.value];
  updatedSlots[idx] = val;
  slots.value = updatedSlots;
  hasResults.value = false;

  // Lock mode on first non-null selection; reset when all slots cleared
  if (val !== null && searchMode.value === null) {
    searchMode.value = isPersonSlot(val) ? 'person' : 'title';
  } else if (updatedSlots.every((slot) => slot === null)) {
    searchMode.value = null;
  }
}

function clearSearch(): void {
  slots.value = [null, null];
  credits.value = [[], []];
  castLists.value = [[], []];
  personRoleFilters.value = [defaultRoleCats(), defaultRoleCats()];
  hasResults.value = false;
  enabledMask.value = 0;
  selectedMask.value = 0;
  searchMode.value = null;
}

function updateRoleFilter(idx: number, val: RoleCategory[]): void {
  personRoleFilters.value = personRoleFilters.value.map((filter, i) => (i === idx ? val : filter));
}

function toggleSelf(): void {
  if (selfEnabled.value) {
    personRoleFilters.value = personRoleFilters.value.map((filter) => filter.filter((category) => category !== 'self'));
    defaultSelfEnabled.value = false;
  } else {
    personRoleFilters.value = personRoleFilters.value.map((filter) =>
      filter.includes('self') ? filter : [...filter, 'self'],
    );
    defaultSelfEnabled.value = true;
  }
}

function togglePerson(i: number): void {
  if (isToggleDisabled(enabledMask.value, i)) {
    return;
  }
  enabledMask.value ^= 1 << i;
}

/** Drop null slots in-place before running a comparison. */
function compactSlots(): void {
  filterSlotArrays((i) => slots.value[i] !== null);
}

/** Prepare slots for a restore without triggering compare. */
function setSlots(items: (TmdbPerson | TmdbTitle)[]): void {
  slots.value = [...items];
  searchMode.value = items.length > 0 ? (isPersonSlot(items[0]) ? 'person' : 'title') : null;
  personRoleFilters.value = items.map(() => defaultRoleCats());
  credits.value = items.map(() => []);
  castLists.value = items.map(() => []);
  hasResults.value = false;
}

/** Commit person-mode fetch results. */
function applyPersonResults(results: Project[][]): void {
  credits.value = results;
  personRoleFilters.value = results.map(() => defaultRoleCats());
  enabledMask.value = allMask.value;
  selectedMask.value = allMask.value;
  hasResults.value = true;
}

/** Commit title-mode fetch results. */
function applyTitleResults(results: CastMember[][]): void {
  castLists.value = results;
  enabledMask.value = allMask.value;
  selectedMask.value = allMask.value;
  hasResults.value = true;
}

export function useVennState() {
  return {
    // ── State ─────────────────────────────────────────────────────────────────
    slots,
    credits,
    castLists,
    personRoleFilters,
    hasResults,
    selectedMask,
    enabledMask,
    searchMode,
    // ── Derived ───────────────────────────────────────────────────────────────
    allMask,
    activePeople,
    activeTitles,
    selfEnabled,
    personRoleCounts,
    filteredCredits,
    filteredCastLists,
    regions,
    titleRegions,
    // ── Actions ───────────────────────────────────────────────────────────────
    addSlot,
    removeSlot,
    removeSlotAt,
    compactSlots,
    handleSlotUpdate,
    clearSearch,
    updateRoleFilter,
    toggleSelf,
    togglePerson,
    defaultSelfEnabled,
    toggleDefaultSelf,
    setSlots,
    applyPersonResults,
    applyTitleResults,
  };
}
