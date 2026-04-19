<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TmdbPerson, TmdbTitle, CastMember, Project, RegionMask, RoleCategory, SearchMode } from '@/types/tmdb';
import { PERSON_COLORS, ALL_ROLE_CATS, EMPTY_ROLE_COUNTS } from '@/types/tmdb';
import { VENN_LAYOUTS, slotPosition } from '@/utils/vennLayout';
import { MIN_PERSONS } from '@/composables/useVennState';
import { useClickOutside } from '@/composables/useClickOutside';
import PersonCards from '@/components/PersonCards.vue';
import VennCanvas from '@/components/VennCanvas.vue';
import NetworkGraph from '@/components/NetworkGraph.vue';
import GenreChart from '@/components/GenreChart.vue';
import RoleFilterDropdown from '@/components/RoleFilterDropdown.vue';
import { IconGear, IconShare, IconCheck } from '@/components/icons';

const props = withDefaults(
  defineProps<{
    slots: (TmdbPerson | TmdbTitle | null)[];
    searchMode: SearchMode | null;
    hasResults: boolean;
    isLoading: boolean;
    regionCounts: Map<RegionMask, number>;
    enabledMask: number;
    selectedMask: RegionMask;
    personRoleFilters: RoleCategory[][];
    personRoleCounts: Array<Record<RoleCategory, number>>;
    selfEnabled: boolean;
    defaultSelfEnabled: boolean;
    credits: Project[][];
    castLists: CastMember[][];
    /** Person-mode credits filtered by role; for Genre tab. */
    filteredCredits: Project[][];
    /** External hover mask (e.g. from card hover) to highlight Venn region. */
    hoverHighlightMask?: RegionMask;
  }>(),
  {},
);

const emit = defineEmits<{
  'update:slot': [idx: number, val: TmdbPerson | TmdbTitle | null];
  'clear-slot': [idx: number];
  'update-role-filter': [idx: number, categories: RoleCategory[]];
  select: [mask: RegionMask];
  'toggle-self': [];
  'toggle-default-self': [];
  'add-slot': [];
  'remove-slot': [];
  'run-compare': [];
  'clear-search': [];
}>();

// ── Viz mode toggle ───────────────────────────────────────────────────────────
const VIZ_STORAGE_KEY = 'venn-viz-mode';
const storedViz = () =>
  (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(VIZ_STORAGE_KEY)) as
    | 'venn'
    | 'network'
    | 'genre'
    | null;
const vizMode = ref<'venn' | 'network' | 'genre'>(
  storedViz() === 'venn' || storedViz() === 'network' || storedViz() === 'genre' ? storedViz()! : 'venn',
);

// ── Config dropdown ───────────────────────────────────────────────────────────
const configOpen = ref(false);
const configBtnRef = ref<HTMLElement | null>(null);
const configPanelRef = ref<HTMLElement | null>(null);

useClickOutside([configBtnRef, configPanelRef], () => {
  configOpen.value = false;
});

// ── Layout / geometry ─────────────────────────────────────────────────────────
// Mirrors VennCanvas: filled slots, minimum 2.
const displayCount = computed(() => Math.max(props.slots.filter((slot) => slot !== null).length, 2));
const stageLayout = computed(() => VENN_LAYOUTS[displayCount.value] ?? VENN_LAYOUTS[2]);

/** CSS for the role-filter dropdown: anchored just below the slot's name label. */
function roleFilterStyle(i: number): Record<string, string> {
  const { pctLeft, pctTop } = slotPosition(displayCount.value, i, { y: 'below' });
  return { position: 'absolute', left: `${pctLeft}%`, top: `${pctTop}%`, transform: 'translateX(-50%)' };
}

/** CSS for the hover-remove overlay: centred on the slot's name label. */

// function labelOverlayStyle(i: number): Record<string, string> {
//   const { pctLeft, pctTop } = slotPosition(displayCount.value, i, { x: 'left' });
//   return { position: 'absolute', left: `${pctLeft}%`, top: `${pctTop}%`, transform: 'translate(-50%, -50%)' };
// }

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Compare button is enabled once at least 2 slots are filled. */
const canCompare = computed(() => props.slots.filter((slot) => slot !== null).length >= MIN_PERSONS);

const filledCount = computed(() => props.slots.filter((slot) => slot !== null).length);
const compareSub = computed(() => {
  if (props.isLoading) {
    return 'do not interfere';
  }
  if (filledCount.value === 1) {
    return props.searchMode === 'title' ? 'Add 1 more title to compare' : 'Add 1 more person to compare';
  }
  if (filledCount.value === 0) {
    return 'Add 2+ people or titles above';
  }
  return 'the subjects await';
});

const emptyRoleCounts = EMPTY_ROLE_COUNTS;
const personCardsRef = ref<InstanceType<typeof PersonCards> | null>(null);

function focusSearch(): void {
  personCardsRef.value?.focusSearch?.();
}

defineExpose({ focusSearch });

// Persist viz tab on change
watch(vizMode, (v) => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(VIZ_STORAGE_KEY, v);
  }
});

// ── Share button ──────────────────────────────────────────────────────────────
const shareDone = ref(false);

async function handleShare(): Promise<void> {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ url });
    } catch {
      // user dismissed — no feedback needed
    }
  } else {
    await navigator.clipboard.writeText(url);
    shareDone.value = true;
    setTimeout(() => {
      shareDone.value = false;
    }, 2000);
  }
}

/** Names and credits for Genre tab (person mode only). */
const genreNames = computed(() =>
  props.slots.filter((slot): slot is TmdbPerson | TmdbTitle => slot !== null).map((slot) => slot.name),
);
const creditsForGenre = computed(() => (props.searchMode === 'person' ? props.filteredCredits : []));

/** Inclusive credit total for slot i across all visible regions. */
function totalForSlot(i: number): number {
  if (!props.hasResults) {
    return 0;
  }
  let total = 0;
  for (const [regionMask, cnt] of props.regionCounts) {
    if ((regionMask >> i) & 1) {
      total += cnt;
    }
  }
  return total;
}
</script>

<template>
  <div class="venn-wrap">
    <header>
      <div class="logo-row">
        <div class="logo">
          <span class="logo-text"> <span class="big-r">R</span>e-Graphinato<span class="big-r">R</span> </span>
          <span class="logo-sub">Filmography Overlap System</span>
        </div>

        <!-- ── Viz mode toggle ── -->
        <!-- <div class="viz-tabs">
          <button
            type="button"
            class="viz-tab"
            :class="{ 'viz-tab--active': vizMode === 'venn' }"
            title="Overlap of filmographies"
            @click="vizMode = 'venn'"
          >Venn</button>
          <button
            type="button"
            class="viz-tab"
            :class="{ 'viz-tab--active': vizMode === 'network' }"
            title="Connections between subjects"
            @click="vizMode = 'network'"
          >Network</button>
          <button
            type="button"
            class="viz-tab"
            :class="{ 'viz-tab--active': vizMode === 'genre', 'viz-tab--disabled': searchMode === 'title' }"
            :title="searchMode === 'title' ? 'Genre fingerprint is only available when comparing people' : 'Genre radar chart'"
            :disabled="searchMode === 'title'"
            @click="searchMode !== 'title' && (vizMode = 'genre')"
          >Genre</button>
        </div> -->

        <!-- ── Config button + dropdown ── -->
        <div class="config-wrap">
          <button
            ref="configBtnRef"
            class="config-btn"
            :class="{ 'config-btn--open': configOpen }"
            type="button"
            aria-label="Open settings"
            aria-haspopup="true"
            :aria-expanded="configOpen"
            @click="configOpen = !configOpen"
          >
            <IconGear />
          </button>
          <Transition name="config-drop">
            <div v-if="configOpen" ref="configPanelRef" class="config-panel">
              <div class="config-section-label">Defaults</div>
              <label class="config-row">
                <span class="config-row-label">Self credits for cast/crew</span>
                <button
                  class="config-toggle"
                  :class="{ 'config-toggle--on': selfEnabled }"
                  type="button"
                  @click="emit('toggle-self')"
                >
                  <span class="config-toggle-knob" />
                </button>
              </label>
            </div>
          </Transition>
        </div>
      </div>

      <!-- ── Person/title search cards ── -->
      <PersonCards
        ref="personCardsRef"
        :slots="slots"
        :search-mode="searchMode"
        :has-results="hasResults"
        :enabled-mask="enabledMask"
        :credits="credits"
        :cast-lists="castLists"
        @update:slot="(idx, val) => emit('update:slot', idx, val)"
        @clear-slot="(idx) => emit('clear-slot', idx)"
        @clear-search="emit('clear-search')"
        @add-slot="emit('add-slot')"
      />
    </header>

    <!-- ── Viz area: Venn | Network | Genre ── -->
    <div class="viz-container">
      <div v-if="vizMode === 'genre'" class="genre-viz-wrap">
        <GenreChart :credits="creditsForGenre" :names="genreNames" />
      </div>
      <div v-else class="canvas-wrap" :style="`aspect-ratio: ${stageLayout.W} / ${stageLayout.H}`">
        <VennCanvas
          v-if="vizMode === 'venn'"
          :slots="slots"
          :has-results="hasResults"
          :is-loading="isLoading"
          :region-counts="regionCounts"
          :enabled-mask="enabledMask"
          :selected-mask="selectedMask"
          :external-hover-mask="hoverHighlightMask ?? 0"
          @select="emit('select', $event)"
        />
        <NetworkGraph
          v-else
          :slots="slots"
          :has-results="hasResults"
          :region-counts="regionCounts"
          :enabled-mask="enabledMask"
          :selected-mask="selectedMask"
          @select="emit('select', $event)"
        />

        <!-- ── Role filter dropdowns — post-compare, person mode, venn only ── -->
        <template v-if="hasResults && searchMode === 'person' && vizMode === 'venn'">
          <template v-for="(slot, i) in slots" :key="i">
            <div v-if="slot !== null" :style="roleFilterStyle(i)">
              <RoleFilterDropdown
                :model-value="personRoleFilters[i] ?? ALL_ROLE_CATS"
                :counts="personRoleCounts[i] ?? emptyRoleCounts"
                :color="PERSON_COLORS[i]"
                :number-mode="true"
                :total-count="totalForSlot(i)"
                @update:model-value="emit('update-role-filter', i, $event)"
              />
            </div>
          </template>
        </template>
      </div>

      <Transition name="compare-fade">
        <button
          v-if="!hasResults"
          class="compare-overlay"
          :class="{
            'compare-overlay--loading': isLoading,
            'compare-overlay--disabled': !canCompare && !isLoading,
          }"
          :disabled="!canCompare || isLoading"
          :aria-label="isLoading ? 'Analyzing comparison' : 'Run comparison'"
          @click="emit('run-compare')"
        >
          <span class="compare-label">{{ isLoading ? 'Analyzing…' : 'Compare' }}</span>
          <span class="compare-sub">{{ compareSub }}</span>
        </button>
      </Transition>

      <Transition name="compare-fade">
        <button
          v-if="hasResults"
          class="share-btn"
          :class="{ 'share-btn--done': shareDone }"
          :aria-label="shareDone ? 'Link copied' : 'Share comparison'"
          @click="handleShare"
        >
          <IconCheck v-if="shareDone" :width="14" :height="14" />
          <IconShare v-else :width="14" :height="14" />
        </button>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.venn-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 20px 24px 12px;
  margin-bottom: 16px;
  box-shadow: inset 0 0 60px rgba(var(--accent-rgb), 0.02);
}

.logo-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 11px;
  gap: 12px;
}

.logo {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.logo-text {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2rem;
  letter-spacing: 0.05em;
  line-height: 1;
  color: var(--accent);
  text-shadow: var(--accent-glow);
  font-style: italic;
}

.big-r {
  font-size: 2.4rem;
  vertical-align: top;
}

.logo-sub {
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  color: var(--text-3);
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  align-self: center;
}

/* ── Viz mode tabs ── */
.viz-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: center;
}

.viz-tab {
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text-3);
  font-size: 0.72rem;
  padding: 3px 10px;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.viz-tab:hover {
  color: var(--text-2);
}

.viz-tab--active {
  background: var(--accent-dim);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.5);
}

.viz-tab--disabled {
  opacity: 0.5;
  color: var(--text-3);
  background: var(--surface3);
  border-color: var(--border);
  cursor: not-allowed;
  pointer-events: none;
}

/* ── Config button ── */
.config-wrap {
  position: relative;
  flex-shrink: 0;
}

.config-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-3);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s,
    border-color 0.15s;
}
.config-btn:hover,
.config-btn--open {
  color: var(--text-2);
  background: var(--surface2);
  border-color: rgba(180, 180, 180, 0.3);
}

/* ── Config dropdown panel ── */
.config-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 230px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  padding: 10px 0 8px;
  z-index: 200;
}

.config-section-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
  padding: 0 14px 6px;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  cursor: pointer;
  gap: 16px;
  transition: background 0.1s;
}
.config-row:hover {
  background: var(--surface3);
}

.config-row-label {
  font-size: 0.8rem;
  color: var(--text-2);
  user-select: none;
}

/* pill toggle */
.config-toggle {
  flex-shrink: 0;
  width: 32px;
  height: 18px;
  border-radius: 9px;
  border: none;
  background: var(--surface3);
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  padding: 0;
}
.config-toggle--on {
  background: var(--accent);
}

.config-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-3);
  transition:
    transform 0.2s,
    background 0.2s;
  display: block;
}
.config-toggle--on .config-toggle-knob {
  transform: translateX(14px);
  background: #111;
}

.config-drop-enter-active,
.config-drop-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.config-drop-enter-from,
.config-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Viz container ── */
.viz-container {
  position: relative;
  min-height: 220px;
}
.genre-viz-wrap {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.canvas-wrap {
  position: relative;
}

/* ── Label hover-remove zones ── */
.label-hover-zone {
  padding: 5px 10px;
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.label-remove-btn {
  opacity: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  font-size: 0.58rem;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    opacity 0.15s,
    background 0.15s;
  flex-shrink: 0;
}

.label-hover-zone:hover .label-remove-btn {
  opacity: 1;
}
.label-remove-btn:hover {
  background: rgba(180, 40, 40, 0.7);
  border-color: rgba(220, 80, 80, 0.5);
}

.compare-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;

  background: rgba(3, 8, 2, 0.92);
  color: var(--accent);
  /* Double border: solid inner + faint outer ring via outline */
  border: 2px solid var(--accent);
  outline: 1px solid rgba(var(--accent-rgb), 0.25);
  outline-offset: 5px;
  padding: 18px 52px;
  border-radius: 0;

  cursor: pointer;
  white-space: nowrap;
  pointer-events: auto;

  box-shadow:
    0 0 48px rgba(var(--accent-rgb), 0.28),
    0 0 100px rgba(var(--accent-rgb), 0.1);
  text-shadow: 0 0 18px rgba(var(--accent-rgb), 0.55);

  transition:
    box-shadow 0.3s,
    text-shadow 0.3s,
    opacity 0.2s;
  animation: compare-pulse 3.5s ease-in-out infinite;
}

.compare-label {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2.2rem;
  letter-spacing: 0.12em;
  line-height: 1;
  color: var(--accent);
}

.compare-sub {
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  color: rgba(var(--accent-rgb), 0.5);
}

.compare-overlay:hover:not(:disabled) {
  animation: none;
  box-shadow:
    0 0 64px rgba(var(--accent-rgb), 0.5),
    0 0 120px rgba(var(--accent-rgb), 0.2);
  text-shadow: 0 0 24px rgba(var(--accent-rgb), 0.9);
}

.compare-overlay--loading .compare-label {
  animation: compare-flicker 2.4s ease-in-out infinite;
}

.compare-overlay:disabled,
.compare-overlay--disabled {
  opacity: 0.18;
  cursor: not-allowed;
  animation: none;
  box-shadow: none;
  text-shadow: none;
}

@keyframes compare-pulse {
  0%,
  100% {
    box-shadow:
      0 0 36px rgba(var(--accent-rgb), 0.18),
      0 0 80px rgba(var(--accent-rgb), 0.07);
    text-shadow: 0 0 14px rgba(var(--accent-rgb), 0.4);
  }
  50% {
    box-shadow:
      0 0 60px rgba(var(--accent-rgb), 0.38),
      0 0 120px rgba(var(--accent-rgb), 0.14);
    text-shadow: 0 0 24px rgba(var(--accent-rgb), 0.75);
  }
}

@keyframes compare-flicker {
  0%,
  100% {
    opacity: 1;
  }
  45% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
  55% {
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  83% {
    opacity: 0.6;
  }
  86% {
    opacity: 1;
  }
}

.compare-fade-enter-active,
.compare-fade-leave-active {
  transition: opacity 0.3s ease;
}
.compare-fade-enter-from,
.compare-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .config-drop-enter-active,
  .config-drop-leave-active,
  .config-advanced-enter-active,
  .config-advanced-leave-active,
  .compare-fade-enter-active,
  .compare-fade-leave-active {
    transition: none;
  }

  .compare-overlay {
    animation: none;
  }

  .compare-overlay--loading .compare-label {
    animation: none;
  }
}

/* ── Share button ── */
.share-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-3);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s,
    border-color 0.15s;
}
.share-btn:hover {
  color: var(--text-2);
  background: var(--surface3);
  border-color: rgba(180, 180, 180, 0.3);
}
.share-btn--done {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 18%, var(--surface2));
  border-color: var(--accent);
  box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.25);
}
</style>
