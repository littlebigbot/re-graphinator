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
  W: number;
  H: number;
  cx: number;
  cy: number;
  d: number;
  r: number;
  start: number;
}

export const VENN_LAYOUTS: Record<number, VennLayout> = {
  1: { W: 800, H: 340, cx: 400, cy: 170, d: 0, r: 120, start: Math.PI / 2 },
  2: { W: 800, H: 340, cx: 400, cy: 170, d: 100, r: 138, start: Math.PI },
  3: { W: 820, H: 500, cx: 410, cy: 275, d: 95, r: 115, start: -Math.PI / 2 },
  4: { W: 820, H: 460, cx: 410, cy: 230, d: 95, r: 100, start: -Math.PI / 4 },
  5: { W: 820, H: 520, cx: 410, cy: 265, d: 95, r: 105, start: -Math.PI / 2 },
};

// ── Label position helpers ────────────────────────────────────────────────────

/**
 * Horizontal anchor relative to the slot's name label.
 * Pass a semantic string for the built-in offsets, or a raw SVG-unit number
 * for precise control (negative = left, positive = right).
 */
export type SlotAnchorX = 'left' | 'center' | 'right' | number;

/**
 * Vertical anchor relative to the slot's name label.
 * Pass a semantic string for the built-in offsets, or a raw SVG-unit number
 * for precise control (negative = up, positive = down).
 */
export type SlotAnchorY = 'above' | 'center' | 'below' | number;

/** SVG-unit offsets for semantic horizontal anchors, relative to the label centre. */
const NAMED_OFFSET_X: Record<string, number> = { left: -14, center: 0, right: 14 };

/** SVG-unit offsets for semantic vertical anchors, relative to the label centre. */
const NAMED_OFFSET_Y: Record<string, number> = { above: -14, center: 0, below: 14 };

function resolveX(anchor: SlotAnchorX): number {
  return typeof anchor === 'number' ? anchor : (NAMED_OFFSET_X[anchor] ?? 0);
}

function resolveY(anchor: SlotAnchorY): number {
  return typeof anchor === 'number' ? anchor : (NAMED_OFFSET_Y[anchor] ?? 0);
}

/** SVG-space centre of the name label for slot `i` in an N-slot layout (internal). */
function labelXY(N: number, i: number): { lx: number; ly: number; W: number; H: number } {
  const { W, H, cx: CX, cy: CY, d, r, start } = VENN_LAYOUTS[N] ?? VENN_LAYOUTS[2];
  const angle = start + (i * 2 * Math.PI) / N;
  const labelR = d + r + 18; // must match VennCanvas draw()
  return {
    lx: CX + labelR * Math.cos(angle),
    ly: CY + labelR * Math.sin(angle),
    W,
    H,
  };
}

/**
 * Returns CSS `{ pctLeft, pctTop }` (as % of viewBox dimensions) for an HTML
 * overlay anchored at the given position relative to slot `i`'s name label.
 *
 * @param N      - total number of slots
 * @param i      - zero-based slot index
 * @param anchor - x/y offsets from the label centre; each accepts a semantic
 *                 string or a raw SVG-unit number (default: both centered)
 *
 * @example
 * slotPosition(N, i, { y: 'below' })       // dropdown below label
 * slotPosition(N, i, { x: 'right', y: -20 }) // right of label, 20 units up
 * slotPosition(N, i, { x: -50 })           // 50 SVG units to the left
 */
export function slotPosition(
  N: number,
  i: number,
  anchor: { x?: SlotAnchorX; y?: SlotAnchorY } = {},
): { pctLeft: number; pctTop: number } {
  const { lx, ly, W, H } = labelXY(N, i);
  return {
    pctLeft: ((lx + resolveX(anchor.x ?? 'center')) / W) * 100,
    pctTop: ((ly + resolveY(anchor.y ?? 'center')) / H) * 100,
  };
}
