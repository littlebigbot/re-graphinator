<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useTheme } from '@/composables/useTheme';
import { useClickOutside } from '@/composables/useClickOutside';
import { useCredits } from '@/composables/useCredits';
import { useHistory } from '@/composables/useHistory';
import { useVennState, MIN_PERSONS } from '@/composables/useVennState';
import GenreChart from '@/components/GenreChart.vue';
import PersonCards from '@/components/PersonCards.vue';
import SearchHistory from '@/components/SearchHistory.vue';
import type { HistoryEntry } from '@/composables/useHistory';
import { IconGear } from '@/components/icons';

useTheme();

const { isLoading, getCached, fetchAll, fetchAllCast } = useCredits();
const { savePerson: savePersonHistory, saveTitle: saveTitleHistory } = useHistory();
const historyRef = ref<InstanceType<typeof SearchHistory> | null>(null);

const {
  slots,
  credits,
  castLists,
  filteredCredits,
  hasResults,
  enabledMask,
  searchMode,
  activePeople,
  activeTitles,
  addSlot,
  removeSlotAt,
  compactSlots,
  handleSlotUpdate,
  clearSearch,
  setSlots,
  applyPersonResults,
  applyTitleResults,
  selfEnabled,
  toggleSelf,
} = useVennState();

const canCompare = computed(() => slots.value.filter((slot) => slot !== null).length >= MIN_PERSONS);

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
      const cached = getCached(activePeople.value);
      if (cached) {
        applyPersonResults(cached);
      } else {
        applyPersonResults(await fetchAll(activePeople.value));
      }
      savePersonHistory(activePeople.value);
      historyRef.value?.refresh();
    }
  } catch (err) {
    alert(`Error fetching data: ${err instanceof Error ? err.message : String(err)}`);
  }
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

const configOpen = ref(false);
const configBtnRef = ref<HTMLElement | null>(null);
const configPanelRef = ref<HTMLElement | null>(null);
const advancedOpen = ref(false);

useClickOutside([configBtnRef, configPanelRef], () => {
  configOpen.value = false;
});

/** Display names for the people/titles currently loaded. */
const names = computed<string[]>(() => slots.value.filter((slot) => slot !== null).map((slot) => slot!.name));

/** Credits to pass to the chart — person mode only. */
const creditsForChart = computed(() => (searchMode.value === 'person' ? filteredCredits.value : []));

const hasPeopleResults = computed(
  () => hasResults.value && searchMode.value === 'person' && activePeople.value.length >= 2,
);
</script>

<template>
  <SearchHistory ref="historyRef" @restore="restoreSearch" />

  <main class="main">
    <div class="genre-wrap">
      <header>
        <div class="logo-row">
          <div class="logo">
            <span class="logo-text"> <span class="big-r">R</span>e-Graphinato<span class="big-r">R</span> </span>
            <span class="logo-sub">Filmography Overlap System</span>
          </div>

          <!-- ── Nav: Overlap | Genre ── -->
          <div class="viz-tabs">
            <RouterLink to="/venn" class="viz-tab">Overlap</RouterLink>
            <RouterLink to="/genre" class="viz-tab viz-tab--active">Genre</RouterLink>
          </div>

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
                    @click="toggleSelf"
                  >
                    <span class="config-toggle-knob" />
                  </button>
                </label>

                <button
                  class="config-advanced-toggle"
                  type="button"
                  aria-label="Toggle advanced settings"
                  :aria-expanded="advancedOpen"
                  @click="advancedOpen = !advancedOpen"
                >
                  <span class="config-advanced-label">Advanced options</span>
                  <span class="config-advanced-chevron" :class="{ 'config-advanced-chevron--open': advancedOpen }">
                    ▾
                  </span>
                </button>

                <Transition name="config-advanced">
                  <div v-if="advancedOpen" class="config-advanced-panel">
                    <p class="config-advanced-hint">Tweak expert settings here as more options are added.</p>
                  </div>
                </Transition>
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
          :person-only="true"
          @update:slot="(idx, val) => handleSlotUpdate(idx, val)"
          @clear-slot="removeSlotAt"
          @clear-search="clearSearch"
          @add-slot="addSlot"
        />

        <!-- ── Subtitle: names when we have results ── -->
        <p v-if="hasPeopleResults" class="genre-subtitle">
          {{ names.join(' · ') }}
        </p>
      </header>

      <!-- ── Main content ── -->
      <div class="genre-main" role="main">
        <!-- No results yet -->
        <div v-if="!hasPeopleResults" class="no-results">
          <div class="no-results-icon">◎</div>
          <p class="no-results-title">
            {{ canCompare ? 'Ready to compare' : 'Add at least 2 people to compare' }}
          </p>
          <p class="no-results-body">
            {{
              canCompare
                ? 'Click Compare to fetch credits and generate the genre fingerprint.'
                : 'Search for people above. Genre data is captured alongside their credits.'
            }}
          </p>
          <Transition name="compare-fade">
            <button
              v-if="canCompare"
              type="button"
              class="compare-btn"
              :class="{ 'compare-btn--loading': isLoading }"
              :disabled="isLoading"
              @click="runCompare"
            >
              <span class="compare-label">{{ isLoading ? 'Analyzing…' : 'Compare' }}</span>
              <span class="compare-sub">{{ isLoading ? 'do not interfere' : 'the subjects await' }}</span>
            </button>
            <RouterLink v-else to="/venn" class="go-btn">Go to Overlap view</RouterLink>
          </Transition>

          <p v-if="hasResults && searchMode === 'title'" class="mode-note">
            Genre charts are only available in person mode.
          </p>
        </div>

        <!-- Chart -->
        <div v-else class="chart-wrap">
          <GenreChart :credits="creditsForChart" :names="names" />
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.main {
  max-width: 1160px;
  margin: 0 auto;
  padding: 36px 32px 90px;
  width: 100%;
}

.genre-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 20px 24px 24px;
  margin-bottom: 28px;
  box-shadow: inset 0 0 60px rgba(var(--accent-rgb), 0.02);
}

/* ── Header ── */
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

/* ── Nav tabs ── */
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
  text-decoration: none;
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

.genre-subtitle {
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  font-size: 0.74rem;
  color: var(--text-3);
  margin: 0 0 16px;
}

/* ── Config ── */
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

.config-advanced-toggle {
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px 4px;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--text-3);
}

.config-advanced-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.config-advanced-chevron {
  transition: transform 0.12s ease;
}

.config-advanced-chevron--open {
  transform: rotate(180deg);
}

.config-advanced-panel {
  padding: 4px 14px 8px;
  border-top: 1px solid var(--border);
}

.config-advanced-hint {
  font-size: 0.72rem;
  color: var(--text-3);
  margin: 4px 0 2px;
}

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

.config-advanced-enter-active,
.config-advanced-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.config-advanced-enter-from,
.config-advanced-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

/* ── Main content ── */
.genre-main {
  min-height: 280px;
}

/* ── No results state ── */
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 24px;
  text-align: center;
}

.no-results-icon {
  font-size: 2.5rem;
  color: var(--text-3);
  opacity: 0.4;
  line-height: 1;
}

.no-results-title {
  font-size: 1.1rem;
  color: var(--text);
  font-weight: 600;
  margin: 0;
}

.no-results-body {
  font-size: 0.84rem;
  color: var(--text-2);
  max-width: 380px;
  line-height: 1.6;
  margin: 0;
}

/* ── Compare button ── */
.compare-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  margin-top: 12px;
  padding: 18px 52px;
  background: rgba(3, 8, 2, 0.92);
  color: var(--accent);
  border: 2px solid var(--accent);
  outline: 1px solid rgba(var(--accent-rgb), 0.25);
  outline-offset: 5px;
  border-radius: 0;
  cursor: pointer;
  white-space: nowrap;
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

.compare-btn:hover:not(:disabled) {
  animation: none;
  box-shadow:
    0 0 64px rgba(var(--accent-rgb), 0.5),
    0 0 120px rgba(var(--accent-rgb), 0.2);
  text-shadow: 0 0 24px rgba(var(--accent-rgb), 0.9);
}

.compare-btn--loading .compare-label {
  animation: compare-flicker 2.4s ease-in-out infinite;
}

.compare-btn:disabled {
  opacity: 0.7;
  cursor: wait;
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

.go-btn {
  display: inline-block;
  margin-top: 8px;
  padding: 8px 22px;
  background: var(--accent-dim);
  color: var(--accent);
  border: 1px solid rgba(var(--accent-rgb), 0.4);
  border-radius: 999px;
  font-size: 0.82rem;
  text-decoration: none;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.go-btn:hover {
  background: rgba(var(--accent-rgb), 0.2);
}

.mode-note {
  font-size: 0.75rem;
  color: var(--text-3);
  font-style: italic;
  margin: 4px 0 0;
}

/* ── Chart wrapper ── */
.chart-wrap {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 32px 24px;
  box-shadow: inset 0 0 40px rgba(var(--accent-rgb), 0.02);
}

@media (max-width: 640px) {
  .main {
    padding: 20px 16px 80px;
  }

  .logo-row {
    flex-wrap: wrap;
  }
}
</style>
