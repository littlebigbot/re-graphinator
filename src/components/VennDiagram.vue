<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TmdbPerson, TmdbTitle, CastMember, Project, RegionMask, RoleCategory, SearchMode } from '@/types/tmdb'
import { PERSON_COLORS, ALL_ROLE_CATS, EMPTY_ROLE_COUNTS } from '@/types/tmdb'
import { VENN_LAYOUTS, slotLabelCenter, slotLabelBelow } from '@/utils/vennLayout'
import { MIN_PERSONS } from '@/composables/useVennState'
import { useClickOutside } from '@/composables/useClickOutside'
import PersonCards from '@/components/PersonCards.vue'
import VennCanvas from '@/components/VennCanvas.vue'
import RoleFilterDropdown from '@/components/RoleFilterDropdown.vue'
import { IconGear } from '@/components/icons'

const props = defineProps<{
  slots: (TmdbPerson | TmdbTitle | null)[]
  searchMode: SearchMode | null
  hasResults: boolean
  isLoading: boolean
  regionCounts: Map<RegionMask, number>
  enabledMask: number
  selectedMask: RegionMask
  personRoleFilters: RoleCategory[][]
  personRoleCounts: Array<Record<RoleCategory, number>>
  selfEnabled: boolean
  defaultSelfEnabled: boolean
  credits: Project[][]
  castLists: CastMember[][]
}>()

const emit = defineEmits<{
  'update:slot': [idx: number, val: TmdbPerson | TmdbTitle | null]
  'clear-slot': [idx: number]
  'update-role-filter': [idx: number, cats: RoleCategory[]]
  select: [mask: RegionMask]
  'toggle-self': []
  'toggle-default-self': []
  'add-slot': []
  'remove-slot': []
  'run-compare': []
  'clear-search': []
}>()

// ── Config dropdown ───────────────────────────────────────────────────────────
const configOpen = ref(false)
const configBtnRef = ref<HTMLElement | null>(null)
const configPanelRef = ref<HTMLElement | null>(null)

useClickOutside([configBtnRef, configPanelRef], () => {
  configOpen.value = false
})

// ── Layout / geometry ─────────────────────────────────────────────────────────
// Mirrors VennCanvas: filled slots, minimum 2.
const displayCount = computed(() => Math.max(props.slots.filter((s) => s !== null).length, 2))
const stageLayout = computed(() => VENN_LAYOUTS[displayCount.value] ?? VENN_LAYOUTS[2])

/** CSS for the role-filter dropdown: anchored just below the slot's name label. */
function roleFilterStyle(i: number): Record<string, string> {
  const { pctLeft, pctTop } = slotLabelBelow(displayCount.value, i)
  return { position: 'absolute', left: `${pctLeft}%`, top: `${pctTop}%`, transform: 'translateX(-50%)' }
}

/** CSS for the hover-remove overlay: centred on the slot's name label. */
function labelOverlayStyle(i: number): Record<string, string> {
  const { pctLeft, pctTop } = slotLabelCenter(displayCount.value, i)
  return { position: 'absolute', left: `${pctLeft}%`, top: `${pctTop}%`, transform: 'translate(-50%, -50%)' }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Compare button is enabled once at least 2 slots are filled. */
const canCompare = computed(() => props.slots.filter((s) => s !== null).length >= MIN_PERSONS)

const emptyRoleCounts = EMPTY_ROLE_COUNTS

/** Inclusive credit total for slot i across all visible regions. */
function totalForSlot(i: number): number {
  if (!props.hasResults) return 0
  let total = 0
  for (const [m, cnt] of props.regionCounts) {
    if ((m >> i) & 1) total += cnt
  }
  return total
}
</script>

<template>
  <div class="venn-wrap">
    <header>
      <div class="logo-row">
        <div class="logo">
          <span class="logo-text">Re-Graphinator</span>
          <span class="logo-sub">Filmography Overlap System</span>
        </div>

        <!-- ── Config button + dropdown ── -->
        <div class="config-wrap">
          <button
            ref="configBtnRef"
            class="config-btn"
            :class="{ 'config-btn--open': configOpen }"
            @click="configOpen = !configOpen"
          >
            <IconGear />
          </button>
          <Transition name="config-drop">
            <div v-if="configOpen" ref="configPanelRef" class="config-panel">
              <div class="config-section-label">Defaults</div>
              <label class="config-row">
                <span class="config-row-label">Self Credits for Cast/Crew</span>
                <button
                  class="config-toggle"
                  :class="{ 'config-toggle--on': selfEnabled }"
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

    <!-- ── D3 SVG canvas + compare overlay + per-name overlays ── -->
    <div class="canvas-wrap" :style="`aspect-ratio: ${stageLayout.W} / ${stageLayout.H}`">
      <VennCanvas
        :slots="slots"
        :has-results="hasResults"
        :is-loading="isLoading"
        :region-counts="regionCounts"
        :enabled-mask="enabledMask"
        :selected-mask="selectedMask"
        @select="emit('select', $event)"
      />

      <Transition name="compare-fade">
        <button
          v-if="!hasResults"
          class="compare-overlay"
          :class="{ 'compare-overlay--loading': isLoading }"
          :disabled="!canCompare || isLoading"
          @click="emit('run-compare')"
        >
          <span class="compare-label">{{ isLoading ? 'Analyzing…' : 'Compare' }}</span>
          <span class="compare-sub">{{ isLoading ? 'do not interfere' : 'the subjects await' }}</span>
        </button>
      </Transition>

      <!-- ── Hover-remove zones — one per filled slot, centred on its name label ── -->
      <template v-for="(slot, i) in slots" :key="`lhz-${i}`">
        <div v-if="slot !== null" class="label-hover-zone" :style="labelOverlayStyle(i)">
          <button class="label-remove-btn" title="Remove" @click="emit('clear-slot', i)">✕</button>
        </div>
      </template>

      <!-- ── Role filter dropdowns — post-compare, person mode only ── -->
      <template v-if="hasResults && searchMode === 'person'">
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
  </div>
</template>

<style scoped>
.venn-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 20px 24px 16px;
  margin-bottom: 28px;
  box-shadow: inset 0 0 60px rgba(107, 255, 42, 0.02);
}

.logo-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 11px;
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

.logo-sub {
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  color: var(--text-3);
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  align-self: center;
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

/* ── Canvas overlay wrapper ── */
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
  outline: 1px solid rgba(107, 255, 42, 0.25);
  outline-offset: 5px;
  padding: 18px 52px;
  border-radius: 0;

  cursor: pointer;
  white-space: nowrap;
  pointer-events: auto;

  box-shadow:
    0 0 48px rgba(107, 255, 42, 0.28),
    0 0 100px rgba(107, 255, 42, 0.1);
  text-shadow: 0 0 18px rgba(107, 255, 42, 0.55);

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
  color: rgba(107, 255, 42, 0.5);
}

.compare-overlay:hover:not(:disabled) {
  animation: none;
  box-shadow:
    0 0 64px rgba(107, 255, 42, 0.5),
    0 0 120px rgba(107, 255, 42, 0.2);
  text-shadow: 0 0 24px rgba(107, 255, 42, 0.9);
}

.compare-overlay--loading .compare-label {
  animation: compare-flicker 2.4s ease-in-out infinite;
}

.compare-overlay:disabled {
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
      0 0 36px rgba(107, 255, 42, 0.18),
      0 0 80px rgba(107, 255, 42, 0.07);
    text-shadow: 0 0 14px rgba(107, 255, 42, 0.4);
  }
  50% {
    box-shadow:
      0 0 60px rgba(107, 255, 42, 0.38),
      0 0 120px rgba(107, 255, 42, 0.14);
    text-shadow: 0 0 24px rgba(107, 255, 42, 0.75);
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
</style>
