<script setup lang="ts">
import { ref, inject, watch, computed } from 'vue';
import type { Ref } from 'vue';
import type { TmdbPerson, TmdbTitle, SearchMode } from '@/types/tmdb';
import { PERSON_COLORS, isPersonSlot } from '@/types/tmdb';
import { profileUrl, posterUrl } from '@/composables/useTmdb';
import { useSearchDropdown } from '@/composables/useSearchDropdown';
import { useClickOutside } from '@/composables/useClickOutside';
import { itemLabel, itemBadge, mediaTypeLabel } from '@/utils/item';
import { releaseYear } from '@/utils/date';

const props = defineProps<{
  index: number;
  modelValue: TmdbPerson | TmdbTitle | null;
  searchMode: SearchMode | null;
  creditsCount?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [val: TmdbPerson | TmdbTitle | null];
  clear: [];
}>();

// ── API ───────────────────────────────────────────────────────────────────────
const apiKey = inject<Ref<string>>('apiKey')!;

const color = computed(() => PERSON_COLORS[props.index] ?? PERSON_COLORS[0]);

// ── Local state ───────────────────────────────────────────────────────────────
const query = ref('');
const container = ref<HTMLElement | null>(null);

// ── Search dropdown ───────────────────────────────────────────────────────────
const { dropdown, showDrop, search: runSearch } = useSearchDropdown(apiKey, () => props.searchMode);
watch(query, runSearch);
useClickOutside([container], () => {
  showDrop.value = false;
});

// ── Placeholder copy based on mode ────────────────────────────────────────────
const placeholder = computed(() => {
  if (props.searchMode === 'title') {
    return `Title ${props.index + 1} — film or TV show…`;
  }
  if (props.searchMode === 'person') {
    return `Person ${props.index + 1} — actor, director, writer…`;
  }
  return `Search for a person or title…`;
});

// ── Handlers ─────────────────────────────────────────────────────────────────
function select(item: TmdbPerson | TmdbTitle): void {
  emit('update:modelValue', item);
  query.value = '';
  showDrop.value = false;
}

function clear(): void {
  emit('update:modelValue', null);
  emit('clear');
}

function hideOnError(e: Event): void {
  (e.target as HTMLImageElement).style.visibility = 'hidden';
}

// ── Dropdown item helpers ─────────────────────────────────────────────────────
</script>

<template>
  <div ref="container" class="slot-search" :style="`--slot-color: ${color}`">
    <!-- ── Input + dropdown ── -->
    <template v-if="!modelValue">
      <div class="search-input-wrap">
        <input v-model="query" type="text" class="slot-input" :placeholder="placeholder" autocomplete="off" />
        <div v-show="showDrop && dropdown.length" class="search-dropdown">
          <DropdownItem
            v-for="item in dropdown"
            :key="item.id"
            :thumbnail-src="isPersonSlot(item) ? profileUrl(item.profile_path) : posterUrl(item.poster_path)"
            :thumb-class="isPersonSlot(item) ? 'thumb--person' : 'thumb--title'"
            :name="item.name"
            :sub-text="itemLabel(item)"
            :badge="itemBadge(item, searchMode)"
            :on-select="() => select(item)"
            :on-error="hideOnError"
          />
        </div>
      </div>
    </template>

    <!-- ── Selected: person card ── -->
    <CardLayout
      v-if="isPersonSlot(modelValue)"
      :thumbnail-src="profileUrl(modelValue.profile_path)"
      :thumbnail-alt="modelValue.name"
      :name="modelValue.name"
      :sub-text="modelValue.known_for_department || 'Various roles'"
      :on-clear="clear"
      :on-error="hideOnError"
    >
      <template #extra-info>
        <div v-if="modelValue.known_for?.length" class="known-pills">
          <span v-for="k in modelValue.known_for.slice(0, 3)" :key="k.id" class="known-pill">{{
            k.title ?? k.name
          }}</span>
        </div>
        <div class="card-count">{{ creditsCount ? `${creditsCount} projects` : '—' }}</div>
      </template>
    </CardLayout>

    <!-- ── Selected: title card ── -->
    <CardLayout
      v-else
      :thumbnail-src="posterUrl((modelValue as TmdbTitle).poster_path)"
      :thumbnail-alt="(modelValue as TmdbTitle).name"
      :name="(modelValue as TmdbTitle).name"
      :sub-text="releaseYear((modelValue as TmdbTitle).release_date)"
      :on-clear="clear"
      :on-error="hideOnError"
    >
      <template #extra-info>
        <div class="card-sub">
          <span class="media-badge">{{ mediaTypeLabel((modelValue as TmdbTitle).media_type) }}</span>
        </div>
        <div class="card-count">{{ creditsCount ? `${creditsCount} cast/crew` : '—' }}</div>
      </template>
    </CardLayout>
  </div>
</template>

<style>
@import '@/style/dropdown-item.css';
</style>

<style scoped>
.slot-search {
  position: relative;
}
.search-input-wrap {
  position: relative;
}

.slot-input {
  width: 100%;
  padding: 11px 16px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  color: var(--text);
  font-size: 0.95rem;
  outline: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.slot-input:focus {
  border-color: var(--slot-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--slot-color) 14%, transparent);
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
  background: color-mix(in srgb, var(--slot-color) 15%, transparent);
  color: var(--slot-color);
}

/* ── Shared card base ── */
.person-card,
.title-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--slot-color);
  border-radius: var(--r);
  position: relative;
}

/* Shared thumbnail styles */
.card-thumbnail {
  object-fit: cover;
  background: var(--surface3);
  flex-shrink: 0;
}

.person-card-photo {
  composes: card-thumbnail;
  width: 48px;
  height: 70px;
  border-radius: 6px;
}

.title-card-poster {
  composes: card-thumbnail;
  width: 42px;
  height: 62px;
  border-radius: 4px;
}

.card-info {
  flex: 1;
  min-width: 0;
}
.card-name {
  font-weight: 700;
  font-size: 0.95rem;
}
.card-sub {
  font-size: 0.78rem;
  color: var(--text-2);
  margin-bottom: 5px;
}
.card-count {
  font-size: 0.72rem;
  color: var(--text-3);
  margin-top: 4px;
}

.media-badge {
  font-size: 0.65rem;
  padding: 1px 5px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--slot-color) 15%, transparent);
  color: var(--slot-color);
  margin-left: 4px;
}

.known-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.known-pill {
  font-size: 0.68rem;
  padding: 2px 7px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--slot-color) 12%, transparent);
  color: var(--slot-color);
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-clear {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px 7px;
  border-radius: 4px;
  transition:
    color 0.15s,
    background 0.15s;
}

.card-clear:hover {
  color: var(--text);
  background: var(--surface3);
}
</style>
