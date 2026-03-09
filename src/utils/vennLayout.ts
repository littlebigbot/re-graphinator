/**
 * Shared Venn-diagram layout geometry.
 *
 * Each circle centre is placed at angle `start + i*(2π/N)` from `(cx, cy)`,
 * displaced by `d` pixels.  The SVG viewBox is `W × H`.
 *
 * Exported so VennCanvas (D3 drawing) and VennDiagram (HTML overlay
 * positioning) can share identical geometry without duplication.
 */
export interface VennLayout {
  W: number
  H: number
  cx: number
  cy: number
  d: number
  r: number
  start: number
}

export const VENN_LAYOUTS: Record<number, VennLayout> = {
  1: { W: 800, H: 340, cx: 400, cy: 170, d:   0, r: 120, start: Math.PI / 2  },
  2: { W: 800, H: 340, cx: 400, cy: 170, d: 100, r: 138, start: Math.PI      },
  3: { W: 820, H: 500, cx: 410, cy: 275, d:  95, r: 115, start: -Math.PI / 2 },
  4: { W: 820, H: 460, cx: 410, cy: 230, d:  95, r: 100, start: -Math.PI / 4 },
  5: { W: 820, H: 520, cx: 410, cy: 265, d:  95, r: 105, start: -Math.PI / 2 },
}

// ── Label position helpers ────────────────────────────────────────────────────

/** SVG-space centre of the name label for slot `i` in an N-slot layout (internal). */
function labelXY(N: number, i: number): { lx: number; ly: number; W: number; H: number } {
  const { W, H, cx: CX, cy: CY, d, r, start } = VENN_LAYOUTS[N] ?? VENN_LAYOUTS[2]
  const angle  = start + (i * 2 * Math.PI) / N
  const labelR = d + r + 18           // must match VennCanvas draw()
  return {
    lx: CX + labelR * Math.cos(angle),
    ly: CY + labelR * Math.sin(angle),
    W, H,
  }
}

/**
 * CSS `{ left, top }` (as % of viewBox dimensions) centred on the name label
 * for slot `i`.  Pair with `transform: translate(-50%, -50%)` to pin an HTML
 * overlay exactly over the label text — e.g. a hover-remove button.
 */
export function slotLabelCenter(N: number, i: number): { pctLeft: number; pctTop: number } {
  const { lx, ly, W, H } = labelXY(N, i)
  return { pctLeft: (lx / W) * 100, pctTop: (ly / H) * 100 }
}

/**
 * CSS `{ left, top }` (as % of viewBox dimensions) for an HTML overlay placed
 * just below the name label for slot `i`.  Pair with `transform: translateX(-50%)`.
 *
 * The label text sits at `dominant-baseline: middle`, so the overlay is
 * offset down by 14 SVG units (≈ half the 13px font-size + 7 gap).
 * Use this to anchor role-filter dropdowns under each circle's name.
 */
export function slotLabelBelow(N: number, i: number): { pctLeft: number; pctTop: number } {
  const { lx, ly, W, H } = labelXY(N, i)
  return { pctLeft: (lx / W) * 100, pctTop: ((ly + 14) / H) * 100 }
}

/** @deprecated Renamed to slotLabelBelow for clarity. */
export const slotLabelPos = slotLabelBelow
