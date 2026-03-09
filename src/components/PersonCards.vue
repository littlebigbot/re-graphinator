<script setup lang="ts">
import { ref, computed, inject, watch, nextTick } from 'vue';
import type { Ref } from 'vue';
import type { TmdbPerson, TmdbTitle, Project, CastMember, SearchMode } from '@/types/tmdb';
import { PERSON_COLORS, isPersonSlot } from '@/types/tmdb';
import { IconPerson } from '@/components/icons';
import { useSearchDropdown } from '@/composables/useSearchDropdown';
import { useClickOutside } from '@/composables/useClickOutside';
import { useImageFallback } from '@/composables/useImageFallback';
import { itemLabel, itemBadge, itemThumb } from '@/utils/item';

const props = defineProps<{
  slots: (TmdbPerson | TmdbTitle | null)[];
  searchMode: SearchMode | null;
  hasResults: boolean;
  enabledMask: number;
  credits: Project[][];
  castLists: CastMember[][];
}>();

const emit = defineEmits<{
  'update:slot': [idx: number, val: TmdbPerson | TmdbTitle | null];
  'clear-slot': [idx: number];
  'clear-search': [];
  'add-slot': [];
}>();

// ── Derived ───────────────────────────────────────────────────────────────────

/** Index of the first empty slot — this is the slot we'll fill next. */
const activeSearchIdx = computed<number | null>(() => {
  const idx = props.slots.findIndex((slot) => slot === null);
  return idx >= 0 ? idx : null;
});

const filledSlots = computed(() =>
  props.slots
    .map((slot, i) => ({ slot, i }))
    .filter((x): x is { slot: TmdbPerson | TmdbTitle; i: number } => x.slot !== null),
);

/** Color accent for the next-to-fill slot. */
const nextColor = computed(() =>
  activeSearchIdx.value !== null ? PERSON_COLORS[activeSearchIdx.value] : 'var(--border)',
);

const placeholder = computed(() => {
  if (activeSearchIdx.value === null) {
    return filledSlots.value.length ? 'Search to add another…' : 'Search…';
  }
  const n = activeSearchIdx.value + 1;
  if (props.searchMode === 'title') {
    return `Add title ${n}…`;
  }
  if (props.searchMode === 'person') {
    return `Add person ${n}…`;
  }
  return `Add person or title…`;
});

function slotCount(i: number): number {
  return props.searchMode === 'title' ? (props.castLists[i]?.length ?? 0) : (props.credits[i]?.length ?? 0);
}

// ── Search ────────────────────────────────────────────────────────────────────

const apiKey = inject<Ref<string>>('apiKey')!;

const query = ref('');
const highlightIdx = ref(-1);
const backspaceArmed = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);

const {
  dropdown,
  showDrop,
  search: runSearch,
} = useSearchDropdown(
  apiKey,
  () => props.searchMode,
  () => {
    highlightIdx.value = -1;
  },
);

// Only search when there's an empty slot to fill.
// If all slots are full and the user starts typing, add a new slot first.
watch(query, (queryValue) => {
  if (queryValue.length > 0) {
    backspaceArmed.value = false;
  }
  if (activeSearchIdx.value === null) {
    if (queryValue.length > 0) {
      emit('add-slot');
      nextTick(() => runSearch(queryValue));
    }
    return;
  }
  runSearch(queryValue);
});

function select(item: TmdbPerson | TmdbTitle): void {
  if (activeSearchIdx.value === null) {
    return;
  }
  emit('update:slot', activeSearchIdx.value, item);
  query.value = '';
  dropdown.value = [];
  showDrop.value = false;
  highlightIdx.value = -1;
  nextTick(() => inputRef.value?.focus());
}

function onKeydown(e: KeyboardEvent): void {
  // ── Backspace on empty input: arm → arm → remove last chip ──
  if (e.key === 'Backspace' && query.value === '') {
    if (backspaceArmed.value) {
      const last = filledSlots.value[filledSlots.value.length - 1];
      if (last) {
        emit('clear-slot', last.i);
      }
      backspaceArmed.value = false;
    } else {
      backspaceArmed.value = filledSlots.value.length > 0;
    }
    return;
  }

  // Any non-backspace key disarms
  backspaceArmed.value = false;

  if ((e.key === 'ArrowDown' || e.key === 'Tab') && showDrop.value && dropdown.value.length > 0) {
    // Tab / ↓ — step down the list (wrap around at bottom)
    e.preventDefault();
    highlightIdx.value = highlightIdx.value >= dropdown.value.length - 1 ? 0 : highlightIdx.value + 1;
  } else if (e.key === 'ArrowUp' && showDrop.value) {
    e.preventDefault();
    highlightIdx.value = Math.max(highlightIdx.value - 1, 0);
  } else if (e.key === 'Enter' && showDrop.value && dropdown.value.length > 0) {
    // Enter — commit highlighted item (or first if nothing highlighted yet)
    e.preventDefault();
    select(dropdown.value[highlightIdx.value >= 0 ? highlightIdx.value : 0]);
  } else if (e.key === 'Escape') {
    showDrop.value = false;
    highlightIdx.value = -1;
  }
}

// ── Dropdown helpers ──────────────────────────────────────────────────────────

const { broken: brokenThumbs, onError: onThumbError } = useImageFallback();

// ── Click-outside to close dropdown ──────────────────────────────────────────
useClickOutside([containerRef], () => {
  showDrop.value = false;
});
</script>

<template>
  <div ref="containerRef" class="tag-wrap" :style="`--next-color: ${nextColor}`">
    <!-- ── Tag bar: chips + input + clear ── -->
    <div class="tag-bar" @click="inputRef?.focus()">
      <!-- Filled slot chips -->
      <div
        v-for="{ slot, i } in filledSlots"
        :key="i"
        class="slot-chip"
        :class="{
          'slot-chip--dim': hasResults && !((enabledMask >> i) & 1),
          'slot-chip--armed': backspaceArmed && i === filledSlots[filledSlots.length - 1]?.i,
        }"
        :style="`--c: ${PERSON_COLORS[i]}`"
      >
        <span class="chip-pip" />
        <span class="chip-name">{{ slot.name }}</span>
        <span v-if="hasResults && slotCount(i)" class="chip-count">{{ slotCount(i) }}</span>
        <button class="chip-clear" @click.stop="emit('clear-slot', i)">✕</button>
      </div>

      <!-- Search input (always rendered, disabled when all slots full) -->
      <input
        ref="inputRef"
        v-model="query"
        class="tag-input"
        :placeholder="placeholder"
        autocomplete="off"
        spellcheck="false"
        @keydown="onKeydown"
        @focus="showDrop = dropdown.length > 0"
      />

      <!-- Clear search results button -->
      <button v-if="hasResults" class="clear-all-btn" title="Clear results" @click.stop="emit('clear-search')">
        ✕
      </button>
    </div>

    <!-- ── Dropdown ── -->
    <div v-show="showDrop && dropdown.length" class="search-dropdown">
      <div
        v-for="(item, di) in dropdown"
        :key="item.id"
        class="dropdown-item"
        :class="{ 'dropdown-item--hi': di === highlightIdx }"
        @click="select(item)"
        @mouseenter="highlightIdx = di"
      >
        <img
          v-if="itemThumb(item) && !brokenThumbs.has(item.id)"
          class="dropdown-item-thumb"
          :class="isPersonSlot(item) ? 'thumb--person' : 'thumb--title'"
          :src="itemThumb(item)"
          alt=""
          @error="onThumbError(item.id)"
        />
        <div v-else class="dropdown-item-thumb" :class="isPersonSlot(item) ? 'thumb--person' : 'thumb--title'">
          <IconPerson v-if="isPersonSlot(item)" />
        </div>
        <div class="dropdown-item-body">
          <div class="dropdown-item-name">{{ item.name }}</div>
          <div class="dropdown-item-sub">{{ itemLabel(item) }}</div>
        </div>
        <span v-if="itemBadge(item, searchMode)" class="dropdown-item-badge">{{ itemBadge(item, searchMode) }}</span>
      </div>
    </div>
  </div>
</template>

<style>
@import '@/style/dropdown-item.css';
</style>

<style scoped>
/* ── Wrapper ── */
.tag-wrap {
  position: relative;
  margin-bottom: 14px;
}

/* ── Bar ── */
.tag-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 46px;
  padding: 6px 10px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--next-color);
  border-radius: var(--r);
  cursor: text;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.tag-wrap:focus-within .tag-bar {
  border-color: var(--next-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--next-color) 14%, transparent);
}

/* ── Chips ── */
.slot-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 6px 3px 8px;
  background: color-mix(in srgb, var(--c) 10%, var(--surface3));
  border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
  border-radius: 14px;
  font-size: 0.8rem;
  flex-shrink: 0;
  transition: opacity 0.2s;
}

.slot-chip--dim {
  opacity: 0.4;
}
.slot-chip--armed {
  border-color: color-mix(in srgb, #d44 40%, transparent);
  background: color-mix(in srgb, #d44 12%, var(--surface3));
}

.chip-pip {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c);
  flex-shrink: 0;
}

.chip-name {
  font-weight: 600;
  color: var(--text);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-count {
  font-size: 0.66rem;
  color: var(--c);
  background: color-mix(in srgb, var(--c) 16%, transparent);
  padding: 1px 5px;
  border-radius: 8px;
  flex-shrink: 0;
}

.chip-clear {
  background: none;
  border: none;
  color: color-mix(in srgb, var(--c) 70%, transparent);
  cursor: pointer;
  font-size: 0.72rem;
  padding: 0 1px;
  line-height: 1;
  flex-shrink: 0;
  transition:
    opacity 0.15s,
    color 0.12s;
}

/* ── Input ── */
.tag-input {
  flex: 1;
  min-width: 140px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.9rem;
  outline: none;
  padding: 2px 0;
}

.tag-input::placeholder {
  color: var(--text-3);
}
.tag-input:disabled {
  cursor: default;
}

/* ── Clear-all button ── */
.clear-all-btn {
  flex-shrink: 0;
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.82rem;
  padding: 2px 5px;
  border-radius: 4px;
  line-height: 1;
  transition:
    color 0.12s,
    background 0.12s;
}

.clear-all-btn:hover {
  color: var(--text);
  background: var(--surface3);
}

/* ── Dropdown ── */
.search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  z-index: 100;
  overflow: hidden;
  max-height: 340px;
  overflow-y: auto;
}

.dropdown-item-badge {
  background: color-mix(in srgb, var(--next-color) 15%, transparent);
  color: var(--next-color);
}
</style>
