<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TmdbPerson, ProjectWithRoles, RegionMask } from '@/types/tmdb';
import { popcount } from '@/utils/bitmask';
import { releaseYear } from '@/utils/date';

const props = defineProps<{
  persons: TmdbPerson[];
  credits: ProjectWithRoles[][];
  regions: Map<RegionMask, ProjectWithRoles[]>;
  filterKeys?: Set<string>;
}>();

// ── Types ──────────────────────────────────────────────────────────────────────

interface TimelineItem {
  key: string;
  project: ProjectWithRoles;
  year: number | null;
  isShared: boolean;
}

/** A shared credit — always visible, acts as a landmark. */
interface AnchorSegment {
  kind: 'anchor';
  item: TimelineItem;
}

/** Solo credits between (or before/after) two shared landmarks. Collapsible. */
interface GapSegment {
  kind: 'gap';
  id: string;
  label: string;
  items: TimelineItem[];
}

type Segment = AnchorSegment | GapSegment;

interface TimelineRow {
  person: TmdbPerson;
  segments: Segment[];
}

// ── Expand state ───────────────────────────────────────────────────────────────

const expandedGaps = ref<Set<string>>(new Set());

function toggleGap(id: string): void {
  const next = new Set(expandedGaps.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  expandedGaps.value = next;
}

// ── Segment builder ────────────────────────────────────────────────────────────

/**
 * Turns a flat sorted list of timeline items into alternating anchor/gap
 * segments. Shared credits become always-visible anchors; the solo credits
 * that sit between (or before/after) them become collapsible gaps.
 *
 * If there are no shared credits at all, every item is returned as an anchor
 * (flat list, no collapsing needed).
 */
function buildSegments(personIdx: number, items: TimelineItem[]): Segment[] {
  const hasShared = items.some((item) => item.isShared);

  // No landmarks → just render everything flat
  if (!hasShared) {
    return items.map((item) => ({ kind: 'anchor', item }));
  }

  const segments: Segment[] = [];
  let pending: TimelineItem[] = [];
  let lastAnchorYear: number | null = null;
  let gapIdx = 0;

  function flushGap(nextAnchorYear: number | null): void {
    if (pending.length === 0) {
      return;
    }

    let label: string;
    if (lastAnchorYear === null) {
      label = `Before ${nextAnchorYear ?? '?'}`;
    } else if (nextAnchorYear === null) {
      label = `After ${lastAnchorYear}`;
    } else {
      label = `${lastAnchorYear}–${nextAnchorYear}`;
    }

    segments.push({
      kind: 'gap',
      id: `p${personIdx}-g${gapIdx++}`,
      label,
      items: [...pending],
    });
    pending = [];
  }

  for (const item of items) {
    if (item.isShared) {
      flushGap(item.year);
      segments.push({ kind: 'anchor', item });
      lastAnchorYear = item.year;
    } else {
      pending.push(item);
    }
  }

  flushGap(null);

  return segments;
}

// ── Rows ───────────────────────────────────────────────────────────────────────

const rows = computed<TimelineRow[]>(() => {
  const maskByKey = new Map<string, RegionMask>();

  for (const [mask, items] of props.regions) {
    for (const project of items) {
      const key = `${project.media_type}-${project.id}`;
      maskByKey.set(key, mask);
    }
  }

  return props.persons.map((person, idx) => {
    const projects = props.credits[idx] ?? [];

    const allItems: TimelineItem[] = projects.map((project) => {
      const key = `${project.media_type}-${project.id}`;
      const mask = maskByKey.get(key) ?? 1 << idx;
      const yearStr = releaseYear(project.release_date);
      const yearNum = yearStr ? Number(yearStr) : null;
      return {
        key,
        project,
        year: Number.isFinite(yearNum) ? yearNum : null,
        isShared: popcount(mask) > 1,
      };
    });

    const items = props.filterKeys ? allItems.filter((item) => props.filterKeys!.has(item.key)) : allItems;

    items.sort((a, b) => {
      if (a.year === null && b.year === null) {
        return 0;
      }
      if (a.year === null) {
        return 1;
      }
      if (b.year === null) {
        return -1;
      }
      return a.year - b.year;
    });

    return { person, segments: buildSegments(idx, items) };
  });
});
</script>

<template>
  <section class="timeline">
    <div class="timeline-header">
      <h2 class="timeline-title">Collaboration timeline</h2>
      <p class="timeline-sub">Shared projects are landmarks. Solo credits collapse between them.</p>
    </div>

    <div class="timeline-grid">
      <div v-for="row in rows" :key="row.person.id" class="timeline-column">
        <div class="timeline-person">
          <span class="timeline-person-name">{{ row.person.name }}</span>
        </div>

        <div class="timeline-track">
          <template v-for="seg in row.segments" :key="seg.kind === 'anchor' ? seg.item.key : seg.id">
            <!-- Shared landmark — always visible -->
            <div v-if="seg.kind === 'anchor' && seg.item.isShared" class="timeline-item timeline-item--shared">
              <span class="timeline-year">{{ seg.item.year ?? '—' }}</span>
              <span class="timeline-dot" />
              <span class="timeline-label">{{ seg.item.project.title }}</span>
            </div>

            <!-- Solo item (no shared credits in this view) — flat, no toggle -->
            <div v-else-if="seg.kind === 'anchor'" class="timeline-item">
              <span class="timeline-year">{{ seg.item.year ?? '—' }}</span>
              <span class="timeline-dot" />
              <span class="timeline-label">{{ seg.item.project.title }}</span>
            </div>

            <!-- Gap — collapsible solo credits between landmarks -->
            <div v-else class="timeline-gap">
              <button
                class="timeline-gap-btn"
                :class="{ 'is-open': expandedGaps.has(seg.id) }"
                @click="toggleGap(seg.id)"
              >
                {{ seg.label }} · {{ seg.items.length }}
              </button>

              <div v-if="expandedGaps.has(seg.id)" class="timeline-gap-items">
                <div v-for="item in seg.items" :key="item.key" class="timeline-item">
                  <span class="timeline-year">{{ item.year ?? '—' }}</span>
                  <span class="timeline-dot" />
                  <span class="timeline-label">{{ item.project.title }}</span>
                </div>
              </div>
            </div>
          </template>

          <p v-if="!row.segments.length" class="timeline-empty">No dated credits for this subject.</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.timeline {
  margin-top: 20px;
  padding: 14px 14px 4px;
  border-radius: var(--r);
  background: var(--surface);
  border: 1px solid var(--border);
}

.timeline-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.timeline-title {
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.timeline-sub {
  font-size: 0.78rem;
  color: var(--text-3);
}

.timeline-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.timeline-column {
  min-width: 0;
}

.timeline-person {
  margin-bottom: 6px;
}

.timeline-person-name {
  font-size: 0.82rem;
  font-weight: 600;
}

.timeline-track {
  border-left: 1px solid var(--border);
  padding-left: 10px;
}

/* ── Items ── */

.timeline-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 0.76rem;
  color: var(--text-2);
}

.timeline-item--shared .timeline-dot {
  background: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.2);
}

.timeline-item--shared .timeline-label {
  color: var(--accent);
}

.timeline-year {
  width: 2.5rem;
  flex-shrink: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--text-3);
}

.timeline-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-3);
  flex-shrink: 0;
}

.timeline-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-empty {
  font-size: 0.76rem;
  color: var(--text-3);
  margin: 2px 0 6px;
}

/* ── Gap toggles ── */

.timeline-gap {
  margin-bottom: 4px;
}

.timeline-gap-btn {
  display: inline-block;
  padding: 1px 8px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  color: var(--text-3);
  font-size: 0.7rem;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.timeline-gap-btn:hover {
  color: var(--text-2);
  border-color: var(--text-3);
}

.timeline-gap-btn.is-open {
  background: var(--accent-dim);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.4);
}

.timeline-gap-items {
  margin-top: 2px;
  margin-bottom: 2px;
  padding-left: 4px;
  border-left: 1px dashed var(--border);
}
</style>
