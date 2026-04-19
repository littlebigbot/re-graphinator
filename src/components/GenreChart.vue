<script setup lang="ts">
import { computed } from 'vue';
import type { Project } from '@/types/tmdb';
import { PERSON_COLORS } from '@/types/tmdb';
import { normalizeGenreId, genreName } from '@/utils/genres';

const props = defineProps<{
  /** One array of credits per person — index-aligned with `names`. */
  credits: Project[][];
  names: string[];
}>();

/** Expose for template (props aren't auto-unwrapped in setup scope). */
const names = computed(() => props.names);

// ── Constants ─────────────────────────────────────────────────────────────────
const W = 560;
const H = 480;
const CX = W / 2;
const CY = H / 2 + 10; // slight downward shift so labels don't clip at top
const R = 160; // outer radius of chart
const LABEL_PAD = 26; // extra distance beyond R for genre labels
const NUM_GENRES = 9; // how many axes to show
const TICK_STEPS = 4; // concentric rings (at 25%, 50%, 75%, 100% of max)

// ── Genre counting ─────────────────────────────────────────────────────────────

/**
 * For each person, produce a Map<genreId, count> where genre IDs are normalised
 * and count represents number of credits that include that genre.
 */
const genreCountMaps = computed<Map<number, number>[]>(() =>
  props.credits.map((creditArr) => {
    const counts = new Map<number, number>();
    for (const project of creditArr) {
      for (const rawId of project.genre_ids ?? []) {
        const id = normalizeGenreId(rawId);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }),
);

/** Sum of all genre-occurrences for each person (one project can count multiple times). */
const genreTotals = computed<number[]>(() =>
  genreCountMaps.value.map((m) => {
    let sum = 0;
    for (const v of m.values()) {
      sum += v;
    }
    return sum;
  }),
);

/** Top NUM_GENRES genre IDs. Sorted by "comparison interest": genres where people differ most come first. */
const topGenres = computed<number[]>(() => {
  const combined = new Map<number, number>();
  for (const personMap of genreCountMaps.value) {
    for (const [id, cnt] of personMap) {
      combined.set(id, (combined.get(id) ?? 0) + cnt);
    }
  }
  const topByTotal = [...combined.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, NUM_GENRES)
    .map(([id]) => id);
  if (props.credits.length < 2) {
    return topByTotal;
  }
  // Sort by spread (max - min fraction across people) so the most different genres surface first
  const withSpread = topByTotal.map((genreId) => {
    const fracs = genreCountMaps.value.map((m, pIdx) => {
      const total = genreTotals.value[pIdx];
      return total > 0 ? (m.get(genreId) ?? 0) / total : 0;
    });
    const spread = Math.max(...fracs) - Math.min(...fracs);
    return { genreId, spread };
  });
  return withSpread.sort((a, b) => b.spread - a.spread).map(({ genreId }) => genreId);
});

/** fraction[personIdx][axisIdx] = genre_count / person_total (0–1 scale). */
const fractions = computed<number[][]>(() =>
  genreCountMaps.value.map((personMap, pIdx) => {
    const total = genreTotals.value[pIdx];
    return topGenres.value.map((genreId) => (total > 0 ? (personMap.get(genreId) ?? 0) / total : 0));
  }),
);

/** Maximum fraction across all people × genres, used to scale the chart. */
const maxFraction = computed<number>(() => {
  let max = 0;
  for (const row of fractions.value) {
    for (const f of row) {
      if (f > max) {
        max = f;
      }
    }
  }
  return max || 1;
});

// ── Geometry helpers ──────────────────────────────────────────────────────────

const N = computed(() => topGenres.value.length);

/** Angle for axis i, starting at top (−π/2) going clockwise. */
function axisAngle(i: number): number {
  return -Math.PI / 2 + (i / N.value) * 2 * Math.PI;
}

/** SVG x,y on axis i at radial fraction t (0=centre, 1=outer ring). */
function axisPoint(i: number, t: number): { x: number; y: number } {
  const a = axisAngle(i);
  return { x: CX + t * R * Math.cos(a), y: CY + t * R * Math.sin(a) };
}

/** Polygon points string for one concentric tick ring. */
function ringPoints(t: number): string {
  return topGenres.value
    .map((_, i) => {
      const p = axisPoint(i, t);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(' ');
}

/** Polygon points string for one person. */
function personPoints(pIdx: number): string {
  return topGenres.value
    .map((_, axisIdx) => {
      const f = fractions.value[pIdx]?.[axisIdx] ?? 0;
      const t = f / maxFraction.value;
      const p = axisPoint(axisIdx, t);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(' ');
}

/** Position of the genre label for axis i (outside the outer ring). */
function labelPos(i: number): { x: number; y: number } {
  const a = axisAngle(i);
  const dist = R + LABEL_PAD;
  return { x: CX + dist * Math.cos(a), y: CY + dist * Math.sin(a) };
}

/** SVG text-anchor for a label at angle of axis i. */
function labelAnchor(i: number): string {
  const cos = Math.cos(axisAngle(i));
  if (cos < -0.25) {
    return 'end';
  }
  if (cos > 0.25) {
    return 'start';
  }
  return 'middle';
}

/** SVG dominant-baseline for a label at angle of axis i. */
function labelBaseline(i: number): string {
  const sin = Math.sin(axisAngle(i));
  if (sin < -0.25) {
    return 'auto';
  }
  if (sin > 0.25) {
    return 'hanging';
  }
  return 'middle';
}

/** Format a fraction as a percentage string for tooltip. */
function pct(pIdx: number, axisIdx: number): string {
  const f = fractions.value[pIdx]?.[axisIdx] ?? 0;
  return `${Math.round(f * 100)}%`;
}

// Tick labels: percentages at each ring level
const tickLabels = computed<string[]>(() => {
  const maxPct = Math.round(maxFraction.value * 100);
  return Array.from({ length: TICK_STEPS }, (_, k) => {
    const pctVal = Math.round(((k + 1) / TICK_STEPS) * maxPct);
    return `${pctVal}%`;
  });
});

// ── Colour helpers ─────────────────────────────────────────────────────────────
function personColor(pIdx: number): string {
  return PERSON_COLORS[pIdx % PERSON_COLORS.length];
}

/** True if person pIdx has the highest share for this genre (for visual emphasis). */
function isGenreLeader(pIdx: number, axisIdx: number): boolean {
  const vals = props.names.map((_, i) => fractions.value[i]?.[axisIdx] ?? 0);
  const max = Math.max(...vals);
  return vals[pIdx] === max && max > 0;
}
</script>

<template>
  <div class="genre-chart">
    <!-- ── Empty state ── -->
    <div v-if="topGenres.length === 0" class="empty">
      <span class="empty-text">No genre data available</span>
      <span class="empty-hint"
        >Genre data is captured when you run a comparison — try Compare if you haven't yet, or re-run to refresh.</span
      >
    </div>

    <template v-else>
      <!-- ── Legend ── -->
      <div class="legend">
        <span v-for="(name, pIdx) in names" :key="pIdx" class="legend-item">
          <span class="legend-dot" :style="{ background: personColor(pIdx) }" />
          {{ name }}
        </span>
      </div>

      <!-- ── SVG Radar ── -->
      <svg
        class="radar-svg"
        :viewBox="`0 0 ${W} ${H}`"
        :width="W"
        :height="H"
        role="img"
        :aria-label="`Genre radar chart for ${names.join(' vs ')}`"
      >
        <!-- Grid rings -->
        <polygon
          v-for="k in TICK_STEPS"
          :key="`ring-${k}`"
          :points="ringPoints(k / TICK_STEPS)"
          fill="none"
          stroke="var(--border)"
          stroke-width="1"
          :opacity="k === TICK_STEPS ? 0.5 : 0.25"
        />

        <!-- Tick % labels on the vertical axis (top-most) -->
        <text
          v-for="(label, k) in tickLabels"
          :key="`tick-${k}`"
          :x="CX + 4"
          :y="CY - ((k + 1) / TICK_STEPS) * R"
          fill="var(--text-3)"
          font-size="9"
          text-anchor="start"
          dominant-baseline="middle"
        >
          {{ label }}
        </text>

        <!-- Axis spokes -->
        <line
          v-for="(_, i) in topGenres"
          :key="`axis-${i}`"
          :x1="CX"
          :y1="CY"
          :x2="axisPoint(i, 1).x"
          :y2="axisPoint(i, 1).y"
          stroke="var(--border)"
          stroke-width="1"
          opacity="0.4"
        />

        <!-- Person polygons (filled, layered back-to-front) -->
        <polygon
          v-for="pIdx in names.length"
          :key="`poly-fill-${pIdx - 1}`"
          :points="personPoints(pIdx - 1)"
          :fill="personColor(pIdx - 1)"
          fill-opacity="0.14"
        />
        <polygon
          v-for="pIdx in names.length"
          :key="`poly-stroke-${pIdx - 1}`"
          :points="personPoints(pIdx - 1)"
          fill="none"
          :stroke="personColor(pIdx - 1)"
          stroke-width="2.5"
          stroke-linejoin="round"
          stroke-opacity="0.95"
        />

        <!-- Dots at data points -->
        <template v-for="pIdx in names.length" :key="`dots-${pIdx - 1}`">
          <circle
            v-for="(_, axisIdx) in topGenres"
            :key="`dot-${axisIdx}`"
            :cx="axisPoint(axisIdx, (fractions[pIdx - 1]?.[axisIdx] ?? 0) / maxFraction).x"
            :cy="axisPoint(axisIdx, (fractions[pIdx - 1]?.[axisIdx] ?? 0) / maxFraction).y"
            r="3"
            :fill="personColor(pIdx - 1)"
            fill-opacity="0.9"
          >
            <title>{{ names[pIdx - 1] }}: {{ genreName(topGenres[axisIdx]) }} {{ pct(pIdx - 1, axisIdx) }}</title>
          </circle>
        </template>

        <!-- Genre axis labels -->
        <text
          v-for="(genreId, i) in topGenres"
          :key="`label-${i}`"
          :x="labelPos(i).x"
          :y="labelPos(i).y"
          :text-anchor="labelAnchor(i)"
          :dominant-baseline="labelBaseline(i)"
          fill="var(--text-2)"
          font-size="11"
          font-family="inherit"
        >
          {{ genreName(genreId) }}
        </text>
      </svg>

      <!-- ── Genre breakdown ── -->
      <div class="genre-breakdown">
        <p class="breakdown-caption">% of each person's credits in this genre</p>
        <ul class="genre-list">
          <li v-for="(genreId, axisIdx) in topGenres" :key="genreId" class="genre-row">
            <span class="genre-label">{{ genreName(genreId) }}</span>
            <span class="genre-values">
              <template v-for="(_, pIdx) in names" :key="pIdx">
                <span v-if="pIdx > 0" class="genre-sep"> · </span>
                <span
                  class="genre-pct"
                  :class="{ 'genre-pct--lead': isGenreLeader(pIdx, axisIdx) }"
                  :style="{ color: personColor(pIdx) }"
                >
                  {{ pct(pIdx, axisIdx) }}
                </span>
              </template>
            </span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.genre-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

/* Responsive: scale chart down on mobile */
@media (max-width: 640px) {
  .genre-chart {
    gap: 16px;
  }
  .radar-svg {
    max-width: min(100%, 360px);
  }
  .genre-table {
    font-size: 0.74rem;
    max-width: 100%;
  }
}

/* ── Legend ── */
.legend {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--text-2);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── SVG Radar ── */
.radar-svg {
  max-width: 100%;
  height: auto;
  overflow: visible;
}

@media (max-width: 640px) {
  .genre-chart {
    padding: 0 8px;
  }
  .radar-svg {
    max-width: min(100%, 360px);
    margin: 0 auto;
  }
  .genre-table {
    font-size: 0.75rem;
  }
}

/* ── Genre breakdown ── */
.genre-breakdown {
  width: 100%;
  max-width: 560px;
}

.breakdown-caption {
  margin: 0 0 8px;
  font-size: 0.75rem;
  color: var(--text-3);
  font-weight: 500;
}

.genre-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.85rem;
}

.genre-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.genre-row:last-child {
  border-bottom: none;
}

.genre-label {
  color: var(--text-2);
  font-weight: 500;
  flex-shrink: 0;
}

.genre-values {
  display: flex;
  align-items: center;
  gap: 0;
  font-variant-numeric: tabular-nums;
}

.genre-sep {
  color: var(--text-3);
  font-weight: 400;
  opacity: 0.6;
}

.genre-pct {
  font-size: 0.9rem;
}

.genre-pct--lead {
  font-weight: 600;
}

/* ── Empty state ── */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
}

.empty-text {
  font-size: 0.9rem;
  color: var(--text-2);
}

.empty-hint {
  font-size: 0.78rem;
  color: var(--text-3);
  font-style: italic;
}
</style>
