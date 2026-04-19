<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useTmdb, posterUrl, profileUrl } from '@/composables/useTmdb';
import { useTheme } from '@/composables/useTheme';
import type { TmdbTitle } from '@/types/tmdb';

useTheme();
const { searchTitles, fetchCast, fetchPersonBirthday, fetchTvAirDates } = useTmdb();

// ── Search ────────────────────────────────────────────────────────────────────
const query = ref('');
const searchResults = ref<TmdbTitle[]>([]);
const isSearching = ref(false);
const dropdownOpen = ref(false);

let searchAbort: AbortController | null = null;
watch(query, async (q) => {
  searchAbort?.abort();
  if (!q.trim()) {
    searchResults.value = [];
    dropdownOpen.value = false;
    return;
  }
  isSearching.value = true;
  searchAbort = new AbortController();
  try {
    const results = await searchTitles(q, searchAbort.signal);
    searchResults.value = results.slice(0, 8);
    dropdownOpen.value = true;
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      throw e;
    }
  } finally {
    isSearching.value = false;
  }
});

// ── Selected title ────────────────────────────────────────────────────────────
const selectedTitle = ref<TmdbTitle | null>(null);
const tvLastDate = ref('');
const tvInProduction = ref(false);

async function selectTitle(title: TmdbTitle): Promise<void> {
  selectedTitle.value = title;
  query.value = '';
  dropdownOpen.value = false;
  entries.value = [];

  if (title.media_type === 'tv') {
    const { lastAirDate, inProduction } = await fetchTvAirDates(title.id);
    tvLastDate.value = lastAirDate;
    tvInProduction.value = inProduction;
  } else {
    tvLastDate.value = '';
    tvInProduction.value = false;
  }

  await loadAges(title);
}

function clearTitle(): void {
  selectedTitle.value = null;
  entries.value = [];
  tvLastDate.value = '';
  tvInProduction.value = false;
  query.value = '';
}

// ── Age data ──────────────────────────────────────────────────────────────────
type AgeEntry = {
  id: number;
  name: string;
  profile_path: string | null;
  role: string;
  birthday: string | null;
  ageAtStart: number | null;
  ageAtEnd: number | null;
  isDead: boolean;
  popularity: number;
  episodeCount?: number;
  order?: number;
};

const entries = ref<AgeEntry[]>([]);
const isLoading = ref(false);
const loadProgress = ref(0);
const loadedCount = ref(0);
const totalCount = ref(0);
const loadError = ref<string | null>(null);

function ageAt(birthday: string | null, date: string | null): number | null {
  if (!birthday || !date) {
    return null;
  }
  const b = new Date(birthday);
  const d = new Date(date);
  if (isNaN(b.getTime()) || isNaN(d.getTime())) {
    return null;
  }
  let age = d.getFullYear() - b.getFullYear();
  const m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadAges(title: TmdbTitle): Promise<void> {
  isLoading.value = true;
  loadProgress.value = 0;
  loadedCount.value = 0;
  loadError.value = null;
  entries.value = [];
  sortBy.value = 'order-asc';

  try {
    const cast = await fetchCast(title.id, title.media_type);
    const topCast = cast
      .filter((m) => m.roleCategories.some((c) => c === 'actor' || c === 'self'))
      .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
      .slice(0, 100);

    totalCount.value = topCast.length;
    loadProgress.value = 8;

    const endDate =
      title.media_type === 'tv' ? (tvInProduction.value ? todayStr() : tvLastDate.value) : title.release_date;

    const CHUNK = 8;
    const result: AgeEntry[] = [];

    for (let i = 0; i < topCast.length; i += CHUNK) {
      const chunk = topCast.slice(i, i + CHUNK);
      const details = await Promise.all(chunk.map((m) => fetchPersonBirthday(m.id)));

      for (let j = 0; j < chunk.length; j++) {
        const member = chunk[j];
        const { birthday, deathday } = details[j];
        const ageStart = ageAt(birthday, title.release_date);
        const ageEnd = title.media_type === 'tv' ? ageAt(birthday, endDate) : null;
        result.push({
          id: member.id,
          name: member.name,
          profile_path: member.profile_path,
          role: member.roles[0] ?? '',
          birthday,
          ageAtStart: ageStart,
          ageAtEnd: ageEnd,
          isDead: !!deathday,
          popularity: member.popularity ?? 0,
          episodeCount: member.episodeCount,
        });
      }

      loadedCount.value = Math.min(i + CHUNK, topCast.length);
      loadProgress.value = 8 + Math.round((loadedCount.value / topCast.length) * 92);
    }

    entries.value = result;
    if (result.some((e) => e.episodeCount !== undefined)) {
      sortBy.value = 'order-desc';
    }
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    isLoading.value = false;
  }
}

// ── Sorting ───────────────────────────────────────────────────────────────────
const sortBy = ref<'age-asc' | 'age-desc' | 'name' | 'episodes' | 'order-asc' | 'order-desc'>('order-desc');

const hasEpisodeData = computed(() => entries.value.some((e) => e.episodeCount !== undefined));

const sortedEntries = computed<AgeEntry[]>(() => {
  return [...entries.value].sort((a, b) => {
    if (sortBy.value === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy.value === 'episodes') {
      return (b.episodeCount ?? -1) - (a.episodeCount ?? -1);
    }
    const aAge = a.ageAtStart ?? (sortBy.value === 'age-asc' ? Infinity : -Infinity);
    const bAge = b.ageAtStart ?? (sortBy.value === 'age-asc' ? Infinity : -Infinity);
    if (sortBy.value === 'age-asc') {
      return aAge - bAge;
    }
    if (sortBy.value === 'age-desc') {
      return bAge - aAge;
    }
    if (sortBy.value === 'order-asc') {
      return (a.order ?? 0) - (b.order ?? 0);
    }
    if (sortBy.value === 'order-desc') {
      return (b.order ?? 0) - (a.order ?? 0);
    }
    return 0;
  });
});

// ── Bar geometry ──────────────────────────────────────────────────────────────
const validEntries = computed(() => entries.value.filter((e) => e.ageAtStart !== null));

const minAge = computed(() => {
  if (!validEntries.value.length) {
    return 20;
  }
  return Math.max(0, Math.min(...validEntries.value.map((e) => e.ageAtStart!)) - 3);
});

const maxAge = computed(() => {
  if (!validEntries.value.length) {
    return 80;
  }
  return Math.min(
    100,
    Math.max(...validEntries.value.map((e) => Math.max(e.ageAtStart!, e.ageAtEnd ?? e.ageAtStart!))) + 3,
  );
});

const ageSpan = computed(() => maxAge.value - minAge.value);

function agePct(age: number): number {
  return ((age - minAge.value) / ageSpan.value) * 100;
}

const ageTicks = computed<number[]>(() => {
  const ticks: number[] = [];
  const step = ageSpan.value > 50 ? 10 : 5;
  const start = Math.ceil(minAge.value / step) * step;
  for (let t = start; t <= maxAge.value; t += step) {
    ticks.push(t);
  }
  return ticks;
});

// ── Display helpers ───────────────────────────────────────────────────────────
function formatYear(dateStr: string): string {
  return dateStr ? dateStr.slice(0, 4) : '?';
}

function ageLabel(entry: AgeEntry): string {
  if (entry.ageAtStart === null) {
    return '—';
  }
  if (entry.ageAtEnd !== null && entry.ageAtEnd !== entry.ageAtStart) {
    return `${entry.ageAtStart}–${entry.ageAtEnd}`;
  }
  return String(entry.ageAtStart);
}

function barStyle(entry: AgeEntry): Record<string, string> {
  if (entry.ageAtStart === null) {
    return { display: 'none' };
  }
  const endAge = entry.ageAtEnd ?? entry.ageAtStart;
  const left = agePct(entry.ageAtStart);
  const right = agePct(endAge);
  const widthPct = Math.max(right - left, 0);
  return {
    left: `${left}%`,
    width: widthPct > 0 ? `${widthPct}%` : '3px',
  };
}

function titleTypeLabel(title: TmdbTitle): string {
  if (title.media_type === 'movie') {
    return `Film · ${formatYear(title.release_date)}`;
  }
  const start = formatYear(title.release_date);
  const end = tvInProduction.value ? 'present' : formatYear(tvLastDate.value);
  return `TV Series · ${start}–${end}`;
}
</script>

<template>
  <main class="ages-main">
    <!-- ── Search section ── -->
    <div class="search-wrap">
      <div v-if="!selectedTitle" class="search-block">
        <h1 class="search-heading"><span class="big-r">A</span>ges</h1>
        <p class="search-sub">How old was the cast when a film or show was made?</p>
        <div class="search-input-wrap">
          <input
            v-model="query"
            class="search-input"
            type="search"
            placeholder="Search for a film or TV show…"
            autocomplete="off"
            spellcheck="false"
          />
          <div v-if="isSearching" class="search-spinner" />
          <Transition name="dd">
            <ul v-if="dropdownOpen && searchResults.length" class="search-dropdown">
              <li v-for="result in searchResults" :key="result.id" class="search-result" @click="selectTitle(result)">
                <img v-if="result.poster_path" :src="posterUrl(result.poster_path)" class="result-poster" alt="" />
                <div v-else class="result-poster result-poster--empty" />
                <div class="result-info">
                  <span class="result-name">{{ result.name }}</span>
                  <span class="result-meta"
                    >{{ result.media_type === 'tv' ? 'TV' : 'Film' }} · {{ formatYear(result.release_date) }}</span
                  >
                </div>
              </li>
            </ul>
          </Transition>
        </div>
      </div>

      <!-- ── Title card ── -->
      <div v-else class="title-card">
        <img
          v-if="selectedTitle.poster_path"
          :src="posterUrl(selectedTitle.poster_path)"
          class="title-poster"
          :alt="selectedTitle.name"
        />
        <div class="title-info">
          <div class="title-name">{{ selectedTitle.name }}</div>
          <div class="title-meta">{{ titleTypeLabel(selectedTitle) }}</div>
          <div v-if="isLoading" class="title-progress">
            <div class="progress-track">
              <div class="progress-bar" :style="{ width: loadProgress + '%' }" />
            </div>
            <span class="progress-label">{{ loadedCount }} / {{ totalCount }}</span>
          </div>
        </div>
        <button class="title-clear" aria-label="Clear" @click="clearTitle">✕</button>
      </div>
    </div>

    <!-- ── Results ── -->
    <template v-if="entries.length">
      <!-- Sort + count bar -->
      <div class="controls-bar">
        <div class="sort-group">
          <button
            class="sort-btn"
            :class="{ 'sort-btn--active': sortBy === 'order-desc' }"
            @click="sortBy = 'order-desc'"
          >
            Default (cast order)
          </button>
          <button
            v-if="hasEpisodeData"
            class="sort-btn"
            :class="{ 'sort-btn--active': sortBy === 'episodes' }"
            @click="sortBy = 'episodes'"
          >
            Most episodes
          </button>
          <button class="sort-btn" :class="{ 'sort-btn--active': sortBy === 'age-asc' }" @click="sortBy = 'age-asc'">
            Youngest first
          </button>
          <button class="sort-btn" :class="{ 'sort-btn--active': sortBy === 'age-desc' }" @click="sortBy = 'age-desc'">
            Oldest first
          </button>
          <button class="sort-btn" :class="{ 'sort-btn--active': sortBy === 'name' }" @click="sortBy = 'name'">
            Name
          </button>
        </div>
        <span class="entry-count">{{ validEntries.length }} of {{ entries.length }} with known ages</span>
      </div>

      <!-- Age axis -->
      <div class="axis-row">
        <div class="axis-name-col" />
        <div class="axis-track-col">
          <div class="axis-ticks">
            <div v-for="tick in ageTicks" :key="tick" class="axis-tick" :style="{ left: agePct(tick) + '%' }">
              <span class="axis-label">{{ tick }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Entries -->
      <div class="entries">
        <div
          v-for="entry in sortedEntries"
          :key="entry.id"
          class="entry"
          :class="{ 'entry--no-age': entry.ageAtStart === null, 'entry--dead': entry.isDead }"
        >
          <!-- Left: identity -->
          <div class="entry-identity">
            <div class="entry-photo-wrap">
              <img
                v-if="entry.profile_path"
                :src="profileUrl(entry.profile_path)"
                class="entry-photo"
                :alt="entry.name"
              />
              <div v-else class="entry-photo entry-photo--empty">
                <span>{{ entry.name[0] }}</span>
              </div>
            </div>
            <div class="entry-text">
              <span class="entry-name">{{ entry.name }}</span>
              <span v-if="entry.role" class="entry-role">{{ entry.role }}</span>
            </div>
          </div>

          <!-- Right: age bar -->
          <div class="entry-bar-col">
            <div v-if="entry.ageAtStart !== null" class="bar-track">
              <div
                class="bar-fill"
                :class="{
                  'bar-fill--range': entry.ageAtEnd !== null && entry.ageAtEnd !== entry.ageAtStart,
                  'bar-fill--dead': entry.isDead,
                  'bar-fill--ongoing': tvInProduction && entry.ageAtEnd !== null,
                }"
                :style="barStyle(entry)"
              />
            </div>
            <div v-else class="bar-track bar-track--empty" />
            <span v-if="sortBy === 'episodes' && entry.episodeCount !== undefined" class="ep-label" title="Episodes"
              >{{ entry.episodeCount }} ep</span
            >
            <span class="age-label" :class="{ 'age-label--unknown': entry.ageAtStart === null }">
              {{ ageLabel(entry) }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Empty / loading states ── -->
    <div v-if="!selectedTitle && !isLoading" class="empty-state">
      <p class="empty-hint">Search for any film or TV show to see how old the cast were during production.</p>
    </div>

    <div v-if="loadError" class="error-state">
      <span class="error-text">{{ loadError }}</span>
    </div>
  </main>
</template>

<style scoped>
.ages-main {
  max-width: 1000px;
  margin: 0 auto;
  padding: 36px 32px 90px;
  width: 100%;
}

/* ── Search ── */
.search-wrap {
  margin-bottom: 32px;
}

.search-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 0 8px;
}

.search-heading {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 3.5rem;
  letter-spacing: 0.08em;
  line-height: 1;
  color: var(--accent);
  text-shadow: var(--accent-glow);
  font-style: italic;
}

.big-r {
  font-size: 4.2rem;
  vertical-align: top;
}

.search-sub {
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  color: var(--text-3);
  font-size: 0.82rem;
  margin-bottom: 8px;
}

.search-input-wrap {
  position: relative;
  width: 100%;
  max-width: 520px;
}

.search-input {
  width: 100%;
  padding: 12px 40px 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  color: var(--text);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: rgba(var(--accent-rgb), 0.5);
}

.search-spinner {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: translateY(-50%) rotate(360deg);
  }
}

/* ── Search dropdown ── */
.search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  list-style: none;
  z-index: 400;
  overflow: hidden;
}

.search-result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.1s;
}

.search-result:hover {
  background: var(--surface3);
}

.result-poster {
  width: 28px;
  height: 40px;
  object-fit: cover;
  border-radius: 2px;
  flex-shrink: 0;
}

.result-poster--empty {
  background: var(--surface3);
  border-radius: 2px;
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.result-name {
  font-size: 0.85rem;
  color: var(--text);
  font-weight: 500;
}

.result-meta {
  font-size: 0.72rem;
  color: var(--text-3);
}

.dd-enter-active,
.dd-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
}
.dd-enter-from,
.dd-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Title card ── */
.title-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 12px 16px;
}

.title-poster {
  width: 44px;
  height: 64px;
  object-fit: cover;
  border-radius: 2px;
  flex-shrink: 0;
}

.title-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title-name {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.5rem;
  letter-spacing: 0.06em;
  color: var(--accent);
  line-height: 1;
}

.title-meta {
  font-size: 0.78rem;
  color: var(--text-3);
  font-style: italic;
}

.title-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.progress-track {
  flex: 1;
  height: 3px;
  background: var(--surface3);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.2s ease;
  box-shadow: 0 0 8px rgba(var(--accent-rgb), 0.5);
}

.progress-label {
  font-size: 0.7rem;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.title-clear {
  flex-shrink: 0;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-3);
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.72rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.12s,
    background 0.12s;
}
.title-clear:hover {
  color: var(--text);
  background: var(--surface2);
}

/* ── Controls ── */
.controls-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.sort-group {
  display: flex;
  gap: 4px;
}

.sort-btn {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: none;
  color: var(--text-3);
  font-size: 0.72rem;
  cursor: pointer;
  transition:
    color 0.12s,
    background 0.12s,
    border-color 0.12s;
}

.sort-btn:hover {
  color: var(--text-2);
}

.sort-btn--active {
  background: var(--accent-dim);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.4);
}

.entry-count {
  font-size: 0.72rem;
  color: var(--text-3);
}

/* ── Axis ── */
.axis-row {
  display: flex;
  align-items: flex-end;
  gap: 0;
  margin-bottom: 4px;
  padding-right: 64px;
}

.axis-name-col {
  width: 220px;
  flex-shrink: 0;
}

.axis-track-col {
  flex: 1;
  position: relative;
  height: 20px;
}

.axis-ticks {
  position: relative;
  width: 100%;
  height: 100%;
}

.axis-tick {
  position: absolute;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  bottom: 0;
}

.axis-label {
  font-size: 0.64rem;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}

/* ── Entries ── */
.entries {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entry {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 5px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  transition: background 0.1s;
}

.entry:hover {
  background: rgba(255, 255, 255, 0.015);
}

.entry--no-age {
  opacity: 0.45;
}

/* ── Identity ── */
.entry-identity {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 12px;
  min-width: 0;
}

.entry-photo-wrap {
  flex-shrink: 0;
}

.entry-photo {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center top;
  display: block;
}

.entry-photo--empty {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--text-3);
}

.entry-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.entry-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-role {
  font-size: 0.68rem;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;
}

/* ── Bar ── */
.entry-bar-col {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.bar-track {
  flex: 1;
  height: 8px;
  position: relative;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 2px;
}

.bar-track--empty {
  opacity: 0.3;
}

.bar-fill {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 2px;
  background: var(--accent);
  min-width: 8px;
}

.bar-fill--range {
  background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.85) 0%, rgba(var(--accent-rgb), 0.55) 100%);
}

.bar-fill--dead {
  background: var(--blood);
  opacity: 0.7;
}

.bar-fill--dead.bar-fill--range {
  background: linear-gradient(90deg, var(--blood) 0%, rgba(212, 28, 28, 0.4) 100%);
  opacity: 0.75;
}

.bar-fill--ongoing {
  border-right: none;
  border-radius: 2px 0 0 2px;
}

.bar-fill--ongoing::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 0;
  height: 100%;
  width: 6px;
  background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.4), transparent);
  border-radius: 0 2px 2px 0;
}

.ep-label {
  font-size: 0.68rem;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  width: 48px;
  text-align: right;
  flex-shrink: 0;
}

.age-label {
  font-size: 0.75rem;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  width: 52px;
  text-align: right;
  flex-shrink: 0;
}

.age-label--unknown {
  color: var(--text-3);
}

/* ── Empty + error states ── */
.empty-state {
  text-align: center;
  padding: 80px 0;
}

.empty-hint {
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  color: var(--text-3);
  font-size: 0.85rem;
  max-width: 400px;
  margin: 0 auto;
}

.error-state {
  padding: 24px 0;
  text-align: center;
}

.error-text {
  font-size: 0.82rem;
  color: var(--blood);
}

@media (max-width: 640px) {
  .ages-main {
    padding: 20px 16px 80px;
  }

  .axis-name-col,
  .entry-identity {
    width: 140px;
  }
}
</style>
