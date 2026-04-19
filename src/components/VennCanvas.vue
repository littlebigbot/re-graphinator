<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import * as d3 from 'd3';
import type { TmdbPerson, TmdbTitle, RegionMask } from '@/types/tmdb';
import { PERSON_COLORS, isPersonSlot } from '@/types/tmdb';
import { popcount } from '@/utils/bitmask';
import { profileUrl, posterUrl } from '@/composables/useTmdb';
import { VENN_LAYOUTS } from '@/utils/vennLayout';
import { surname } from '@/utils/names';

const props = withDefaults(
  defineProps<{
    slots: (TmdbPerson | TmdbTitle | null)[];
    hasResults: boolean;
    isLoading: boolean;
    regionCounts: Map<RegionMask, number>;
    enabledMask: number;
    selectedMask: RegionMask;
    /** Hover mask from external source (e.g. movie card hover). */
    externalHoverMask?: RegionMask;
  }>(),
  { externalHoverMask: 0 },
);

const emit = defineEmits<{
  select: [mask: RegionMask];
}>();

const svgRef = ref<SVGSVGElement | null>(null);

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  names: string[];
  count: number;
};

const tooltip = ref<TooltipState>({ visible: false, x: 0, y: 0, names: [], count: 0 });
const lastHoverMask = ref<RegionMask>(0);
const applyStylesRef = ref<(mask: RegionMask) => void>(() => {});

/** Effective hover: diagram pointer takes precedence when over SVG, else external (e.g. card). */
function effectiveHoverMask(): RegionMask {
  return lastHoverMask.value || (props.externalHoverMask ?? 0);
}

// Display count: filled slots, but always at least 2 so the initial dashed pair shows.
// Extra null slots added while typing are clamped out — the new circle only appears on selection.
// Layout geometry is defined in vennLayout.ts (shared with VennDiagram for HTML overlay alignment).
const displayCount = computed(() => Math.max(props.slots.filter((slot) => slot !== null).length, 2));
const stageLayout = computed(() => VENN_LAYOUTS[displayCount.value] ?? VENN_LAYOUTS[2]);

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw(): void {
  const el = svgRef.value;
  if (!el || !props.slots.length) {
    return;
  }

  const N = displayCount.value; // clamp to filled + 2 minimum
  const cfg = VENN_LAYOUTS[N] ?? VENN_LAYOUTS[2];
  const { W, H, cx: CX, cy: CY, d, r, start } = cfg;

  // Only consider the first N slots; beyond that are search-bar null stubs
  const centers = props.slots.slice(0, N).map((_, i) => {
    const angle = start + (i * 2 * Math.PI) / N;
    return { x: CX + d * Math.cos(angle), y: CY + d * Math.sin(angle), origIdx: i, angle };
  });

  const isEnabled = (i: number) => ((props.enabledMask >> i) & 1) === 1;
  const isSelected = (i: number) => props.slots[i] !== null;

  const svg = d3.select(el);
  svg.selectAll('*').remove();
  svg.attr('viewBox', `0 0 ${W} ${H}`);

  // ── Defs ──
  const defs = svg.append('defs');
  const filt = defs
    .append('filter')
    .attr('id', 'venn-glow')
    .attr('x', '-40%')
    .attr('y', '-40%')
    .attr('width', '180%')
    .attr('height', '180%');
  filt.append('feGaussianBlur').attr('stdDeviation', 6).attr('result', 'blur');
  const merge = filt.append('feMerge');
  merge.append('feMergeNode').attr('in', 'blur');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  // ── Circle images — rendered before circles so circle fill tints over them ──
  centers.forEach(({ x, y, origIdx }) => {
    const slot = props.slots[origIdx];
    if (!slot) {
      return;
    }
    const imgUrl = isPersonSlot(slot) ? profileUrl(slot.profile_path) : posterUrl((slot as TmdbTitle).poster_path);

    if (imgUrl) {
      defs
        .append('clipPath')
        .attr('id', `img-clip-${origIdx}`)
        .append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', r);
      svg
        .append('image')
        .attr('href', imgUrl)
        .attr('x', x - r)
        .attr('y', y - r)
        .attr('width', r * 2)
        .attr('height', r * 2)
        .attr('preserveAspectRatio', 'xMidYMin slice')
        .attr('clip-path', `url(#img-clip-${origIdx})`)
        .attr('opacity', isEnabled(origIdx) ? 0.38 : 0.12)
        .attr('pointer-events', 'none');
    } else if (isPersonSlot(slot)) {
      // Silhouette fallback — scale viewBox(0 0 60 90) to fit inside the circle
      const scale = (r * 1.4) / 90;
      const tx = x - 30 * scale;
      const ty = y - 52 * scale;
      const group = svg
        .append('g')
        .attr('transform', `translate(${tx}, ${ty}) scale(${scale})`)
        .attr('fill', PERSON_COLORS[origIdx])
        .attr('opacity', isEnabled(origIdx) ? 0.18 : 0.07)
        .attr('pointer-events', 'none');
      group.append('circle').attr('cx', 30).attr('cy', 28).attr('r', 16);
      group.append('path').attr('d', 'M2 88 C2 58 58 58 58 88');
    }
  });

  // ── Main circles ──
  const circles = centers.map(({ x, y, origIdx }) => {
    const enabled = isEnabled(origIdx);
    const selected = isSelected(origIdx);
    return svg
      .append('circle')
      .attr('cx', x)
      .attr('cy', y)
      .attr('r', r)
      .attr('fill', selected ? PERSON_COLORS[origIdx] : 'none')
      .attr('fill-opacity', selected ? (enabled ? 0.18 : 0.08) : 0)
      .attr('stroke', selected ? (enabled ? 'none' : '#555') : '#666')
      .attr('stroke-width', selected ? 1 : 1.5)
      .attr('stroke-dasharray', selected ? null : '6 4')
      .attr('stroke-opacity', selected ? (enabled ? 0 : 0.35) : 0.25)
      .style('cursor', props.hasResults ? 'pointer' : 'default');
  });

  // ── Hit test: returns the bitmask of all circles that contain (mx, my) ──
  function maskAt(mx: number, my: number): RegionMask {
    let mask = 0;
    for (const { x, y, origIdx } of centers) {
      if (Math.hypot(mx - x, my - y) <= r) {
        mask |= 1 << origIdx;
      }
    }
    return mask;
  }

  // ── Selected-region sliver highlight — only when results exist ──
  if (props.hasResults && props.selectedMask > 0) {
    const selCenters = centers.filter((center) => (props.selectedMask >> center.origIdx) & 1);
    if (selCenters.length >= 2) {
      selCenters.forEach(({ x, y }, idx) => {
        const cp = defs.append('clipPath').attr('id', `vsel-${idx}`);
        const circ = cp.append('circle').attr('cx', x).attr('cy', y).attr('r', r);
        if (idx > 0) {
          circ.attr('clip-path', `url(#vsel-${idx - 1})`);
        }
      });
      svg
        .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', W)
        .attr('height', H)
        .attr('clip-path', `url(#vsel-${selCenters.length - 1})`)
        .attr('fill', 'white')
        .attr('fill-opacity', 0.3)
        .attr('pointer-events', 'none');
    }
  }

  // ── Hover sliver group ──
  const hoverSliverGroup = svg.append('g');

  function updateHoverSliver(hoveredMask: RegionMask): void {
    defs.selectAll('[id^="vhov-"]').remove();
    hoverSliverGroup.selectAll('*').remove();
    if (popcount(hoveredMask) < 2 || hoveredMask === props.selectedMask) {
      return;
    }

    const hovCenters = centers.filter((center) => (hoveredMask >> center.origIdx) & 1);
    hovCenters.forEach(({ x, y }, idx) => {
      const cp = defs.append('clipPath').attr('id', `vhov-${idx}`);
      const circ = cp.append('circle').attr('cx', x).attr('cy', y).attr('r', r);
      if (idx > 0) {
        circ.attr('clip-path', `url(#vhov-${idx - 1})`);
      }
    });
    hoverSliverGroup
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', W)
      .attr('height', H)
      .attr('clip-path', `url(#vhov-${hovCenters.length - 1})`)
      .attr('fill', 'white')
      .attr('fill-opacity', 0.15)
      .attr('pointer-events', 'none');
  }

  // ── Apply visual state for hover ──
  function applyStyles(hoveredMask: RegionMask): void {
    const hasSel = props.selectedMask > 0;
    circles.forEach((circle, j) => {
      const { origIdx } = centers[j];
      const enabled = isEnabled(origIdx);
      const selected = isSelected(origIdx);
      const inHover = hoveredMask > 0 && ((hoveredMask >> origIdx) & 1) !== 0;

      if (selected && enabled) {
        const base = hasSel ? 0.07 : 0.18;
        circle.attr('fill-opacity', inHover ? base + 0.18 : base);
      } else if (selected && !enabled) {
        circle
          .attr('fill', inHover ? '#555' : 'none')
          .attr('fill-opacity', inHover ? 0.1 : 0)
          .attr('stroke-opacity', hasSel ? 0.12 : 0.35);
      }
      // unselected (empty) circles don't respond to hover
    });
    updateHoverSliver(hoveredMask);
  }

  applyStyles(0);

  // ── SVG events — disabled when no results yet ──
  svg.on('mousemove', function (this: SVGSVGElement, event: MouseEvent) {
    if (!props.hasResults) {
      return;
    }
    const [mx, my] = d3.pointer(event, this);
    const mask = maskAt(mx, my);

    if (mask === lastHoverMask.value) {
      return;
    }
    lastHoverMask.value = mask;
    applyStyles(mask);

    const count =
      mask > 0
        ? [...props.regionCounts.entries()]
            .filter(([regionMask]) => (regionMask & mask) === mask)
            .reduce((sum, [, n]) => sum + n, 0)
        : 0;
    if (mask > 0 && count > 0) {
      const names = centers
        .filter((center) => (mask >> center.origIdx) & 1)
        .map((center) => surname(props.slots[center.origIdx]!.name));
      tooltip.value = { visible: true, x: event.clientX, y: event.clientY, names, count };
    } else {
      tooltip.value = { ...tooltip.value, visible: false };
    }
  });

  svg.on('mouseleave', () => {
    lastHoverMask.value = 0;
    const effective = props.externalHoverMask || 0;
    applyStyles(effective);
    tooltip.value = { ...tooltip.value, visible: false };
  });

  // React to external hover (e.g. from movie card) when not hovering the diagram
  applyStylesRef.value = applyStyles;

  svg.on('click', function (this: SVGSVGElement, event: MouseEvent) {
    if (!props.hasResults) {
      return;
    }
    const [mx, my] = d3.pointer(event, this);
    const mask = maskAt(mx, my);
    if (mask > 0) {
      emit('select', mask === props.selectedMask ? 0 : mask);
    }
  });

  // ── Text helper ──
  type TextSel = d3.Selection<SVGTextElement, unknown, null, undefined>;
  const makeText = (x: number, y: number, fill: string, size: number, weight: number, opacity = 1): TextSel =>
    svg
      .append('text')
      .attr('x', x)
      .attr('y', y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', fill)
      .attr('fill-opacity', opacity)
      .attr('font-size', size)
      .attr('font-weight', weight)
      .attr('font-family', 'inherit')
      .attr('pointer-events', 'none');

  // ── Name labels — drawn outside each filled circle, always centred ──
  centers.forEach(({ origIdx, angle }) => {
    const slot = props.slots[origIdx];
    if (!slot) {
      return;
    }
    const labelR = d + r + 18;
    const lx = CX + labelR * Math.cos(angle);
    const ly = CY + labelR * Math.sin(angle);
    const raw = slot.name;
    const label = raw.length > 22 ? raw.slice(0, 20) + '…' : raw;
    makeText(lx, ly, PERSON_COLORS[origIdx], 13, 600)
      .text(label)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('opacity', isEnabled(origIdx) ? 1 : 0.4);
  });

  // ── Intersection count — shown whenever results exist ──
  if (props.hasResults) {
    const activeMask = props.selectedMask > 0 ? props.selectedMask : (1 << N) - 1;
    const selCenters = centers.filter((center) => (activeMask >> center.origIdx) & 1);
    if (selCenters.length > 0) {
      const cx = selCenters.reduce((sum, center) => sum + center.x, 0) / selCenters.length;
      const cy = selCenters.reduce((sum, center) => sum + center.y, 0) / selCenters.length;
      const selCount = [...props.regionCounts.entries()]
        .filter(([selMask]) => (selMask & activeMask) === activeMask)
        .reduce((sum, [, n]) => sum + n, 0);
      const selColor = selCenters.length === 1 ? PERSON_COLORS[selCenters[0].origIdx] : '#c8b4e8';
      // Background pill for legibility over overlapping circles
      const textWidth = String(selCount).length * 18 + 12;
      svg
        .append('rect')
        .attr('x', cx - textWidth / 2)
        .attr('y', cy - 20)
        .attr('width', textWidth)
        .attr('height', 38)
        .attr('rx', 6)
        .attr('fill', 'rgba(8, 12, 8, 0.72)')
        .attr('pointer-events', 'none');
      makeText(cx, cy, selColor, 30, 800, 0.95).text(selCount);
    }
  }
}

onMounted(draw);
watch(() => [props.slots, props.hasResults, props.regionCounts, props.enabledMask, props.selectedMask] as const, draw);
watch(
  () => props.externalHoverMask,
  () => applyStylesRef.value(effectiveHoverMask()),
);
watch(
  () => props.externalHoverMask,
  () => {
    applyStylesRef.value(effectiveHoverMask());
  },
);
watch(
  () => props.externalHoverMask,
  (ext) => {
    applyStylesRef.value(lastHoverMask.value || (ext ?? 0));
  },
);
watch(
  () => props.externalHoverMask,
  () => {
    applyStylesRef.value(effectiveHoverMask());
  },
);
</script>

<template>
  <div
    class="venn-stage"
    :class="{ 'venn-stage--loading': isLoading }"
    :style="`aspect-ratio: ${stageLayout.W} / ${stageLayout.H}`"
  >
    <svg ref="svgRef" class="venn-svg" />
  </div>

  <Teleport to="body">
    <Transition name="tip">
      <div v-if="tooltip.visible" class="venn-tooltip" :style="`left: ${tooltip.x + 14}px; top: ${tooltip.y - 52}px`">
        <span class="tip-count">{{ tooltip.count }}</span>
        <span class="tip-label">{{ tooltip.names.join(' + ') }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.venn-stage {
  position: relative;
  width: 100%;
  transition: opacity 0.3s;
}

.venn-stage--loading {
  opacity: 0.35;
  pointer-events: none;
}

.venn-svg {
  display: block;
  width: 100%;
  height: 100%;
}

/* ── Tooltip ── */
.venn-tooltip {
  position: fixed;
  z-index: 500;
  pointer-events: none;
  background: rgba(18, 18, 18, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 7px 12px;
  display: flex;
  align-items: baseline;
  gap: 7px;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}

.tip-count {
  font-size: 1.05rem;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}
.tip-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1;
}

.tip-enter-active,
.tip-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
}
.tip-enter-from,
.tip-leave-to {
  opacity: 0;
  transform: translateY(3px);
}

@media (prefers-reduced-motion: reduce) {
  .tip-enter-active,
  .tip-leave-active {
    transition: none;
  }
}
</style>
