<script setup lang="ts">
import { computed } from 'vue';
import type { TmdbPerson, TmdbTitle, RegionMask } from '@/types/tmdb';
import { PERSON_COLORS } from '@/types/tmdb';
import { VENN_LAYOUTS } from '@/utils/vennLayout';

const props = defineProps<{
  slots: (TmdbPerson | TmdbTitle | null)[];
  hasResults: boolean;
  regionCounts: Map<RegionMask, number>;
  enabledMask: number;
  selectedMask: RegionMask;
}>();

const emit = defineEmits<{
  select: [mask: RegionMask];
}>();

// ── Geometry ───────────────────────────────────────────────────────────────────

const filledSlots = computed(() =>
  props.slots.map((slot, i) => ({ slot: slot as TmdbPerson | TmdbTitle, i })).filter(({ slot }) => slot !== null),
);

const N = computed(() => Math.max(filledSlots.value.length, 2));
const layout = computed(() => VENN_LAYOUTS[N.value] ?? VENN_LAYOUTS[2]);

/** Node centres in SVG space, reusing the same circle-centre geometry as VennCanvas. */
const nodePositions = computed(() => {
  const { cx, cy, d, start } = layout.value;
  return filledSlots.value.map((_, nodeIdx) => {
    const angle = start + (nodeIdx * 2 * Math.PI) / N.value;
    return { x: cx + d * Math.cos(angle), y: cy + d * Math.sin(angle) };
  });
});

// ── Edge data ──────────────────────────────────────────────────────────────────

function pairCount(i: number, j: number): number {
  const pairMask = (1 << i) | (1 << j);
  let count = 0;
  for (const [regionMask, cnt] of props.regionCounts) {
    if ((regionMask & pairMask) === pairMask) {
      count += cnt;
    }
  }
  return count;
}

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mx: number;
  my: number;
  count: number;
  mask: RegionMask;
  strokeWidth: number;
}

const NODE_R = 46;

const edges = computed<Edge[]>(() => {
  if (!props.hasResults) {
    return [];
  }
  const filled = filledSlots.value;
  const positions = nodePositions.value;
  const result: Edge[] = [];

  for (let a = 0; a < filled.length; a++) {
    for (let b = a + 1; b < filled.length; b++) {
      const count = pairCount(filled[a].i, filled[b].i);
      if (count === 0) {
        continue;
      }

      const x1 = positions[a].x;
      const y1 = positions[a].y;
      const x2 = positions[b].x;
      const y2 = positions[b].y;

      // Trim line ends to node surface so they don't draw through the circles
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len;
      const uy = dy / len;
      const pad = NODE_R + 6;

      result.push({
        x1: x1 + ux * pad,
        y1: y1 + uy * pad,
        x2: x2 - ux * pad,
        y2: y2 - uy * pad,
        mx: (x1 + x2) / 2,
        my: (y1 + y2) / 2,
        count,
        mask: (1 << filled[a].i) | (1 << filled[b].i),
        strokeWidth: Math.max(2, Math.min(10, 2 + Math.sqrt(count) * 0.55)),
      });
    }
  }

  return result;
});

// ── Interaction ────────────────────────────────────────────────────────────────

function handleNodeClick(slotIdx: number): void {
  if (!props.hasResults) {
    return;
  }
  emit('select', 1 << slotIdx);
}

function handleEdgeClick(mask: RegionMask): void {
  if (!props.hasResults) {
    return;
  }
  emit('select', mask);
}
</script>

<template>
  <svg class="network-svg" :viewBox="`0 0 ${layout.W} ${layout.H}`" preserveAspectRatio="xMidYMid meet">
    <!-- ── Edges ── -->
    <g v-for="(edge, idx) in edges" :key="`e-${idx}`" class="edge-group" @click="handleEdgeClick(edge.mask)">
      <!-- Wide invisible hit target -->
      <line :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2" stroke="transparent" stroke-width="20" />
      <!-- Visual line -->
      <line
        :x1="edge.x1"
        :y1="edge.y1"
        :x2="edge.x2"
        :y2="edge.y2"
        class="edge-line"
        :class="{ 'edge-line--selected': selectedMask === edge.mask }"
        :stroke-width="edge.strokeWidth"
      />
      <!-- Count badge -->
      <circle
        :cx="edge.mx"
        :cy="edge.my"
        r="14"
        class="edge-badge"
        :class="{ 'edge-badge--selected': selectedMask === edge.mask }"
      />
      <text
        :x="edge.mx"
        :y="edge.my"
        class="edge-count"
        :class="{ 'edge-count--selected': selectedMask === edge.mask }"
      >
        {{ edge.count }}
      </text>
    </g>

    <!-- ── Nodes ── -->
    <g
      v-for="({ slot, i }, nodeIdx) in filledSlots"
      :key="`n-${i}`"
      class="node-group"
      :class="{ 'node-group--selected': hasResults && (selectedMask >> i) & 1 }"
      @click="handleNodeClick(i)"
    >
      <!-- Glow ring (selected state) -->
      <circle
        :cx="nodePositions[nodeIdx].x"
        :cy="nodePositions[nodeIdx].y"
        :r="NODE_R + 8"
        class="node-glow"
        :style="{ fill: PERSON_COLORS[i] }"
      />
      <!-- Main circle -->
      <circle
        :cx="nodePositions[nodeIdx].x"
        :cy="nodePositions[nodeIdx].y"
        :r="NODE_R"
        class="node-circle"
        :style="{ stroke: PERSON_COLORS[i] }"
        :fill="PERSON_COLORS[i]"
        fill-opacity="0.12"
      />
      <!-- Name label -->
      <text
        :x="nodePositions[nodeIdx].x"
        :y="nodePositions[nodeIdx].y + NODE_R + 18"
        class="node-label"
        :style="{ fill: PERSON_COLORS[i] }"
      >
        {{ slot.name }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.network-svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* ── Edges ── */

.edge-group {
  cursor: pointer;
}

.edge-line {
  stroke: var(--border);
  transition: stroke 0.2s;
}

.edge-line--selected {
  stroke: var(--accent);
}

.edge-group:hover .edge-line {
  stroke: var(--text-3);
}

.edge-badge {
  fill: var(--surface2);
  stroke: var(--border);
  stroke-width: 1;
  transition:
    fill 0.2s,
    stroke 0.2s;
}

.edge-badge--selected {
  fill: var(--accent-dim);
  stroke: rgba(var(--accent-rgb), 0.5);
}

.edge-group:hover .edge-badge {
  stroke: var(--text-3);
}

.edge-count {
  font-size: 11px;
  text-anchor: middle;
  dominant-baseline: central;
  fill: var(--text-3);
  pointer-events: none;
  font-variant-numeric: tabular-nums;
}

.edge-count--selected {
  fill: var(--accent);
}

/* ── Nodes ── */

.node-group {
  cursor: pointer;
}

.node-glow {
  opacity: 0;
  transition: opacity 0.2s;
  fill-opacity: 0.12;
}

.node-group--selected .node-glow,
.node-group:hover .node-glow {
  opacity: 1;
}

.node-circle {
  stroke-width: 2;
  transition:
    fill-opacity 0.2s,
    stroke-width 0.2s;
}

.node-group--selected .node-circle {
  fill-opacity: 0.22;
  stroke-width: 3;
}

.node-group:hover .node-circle {
  fill-opacity: 0.2;
}

.node-label {
  font-size: 13px;
  text-anchor: middle;
  dominant-baseline: hanging;
  pointer-events: none;
  font-weight: 600;
}
</style>
