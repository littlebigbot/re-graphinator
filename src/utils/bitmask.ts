/**
 * Bit manipulation helpers shared across the Venn diagram system.
 * All functions operate on non-negative integers treated as bitmasks.
 */

/** Count the number of set bits (population count). */
export function popcount(n: number): number {
  let count = 0;
  let x = n;
  while (x) {
    count += x & 1;
    x >>>= 1;
  }
  return count;
}

/**
 * Returns true if toggling person i off would drop the enabled count below 2,
 * which would make the Venn diagram meaningless (need at least 2 circles).
 */
export function isToggleDisabled(enabledMask: number, i: number): boolean {
  return ((enabledMask >> i) & 1) === 1 && popcount(enabledMask) <= 2;
}

/**
 * Returns the indices (0-based) of all set bits in `mask`, up to `length`.
 * e.g. activeBits(0b0101, 4) → [0, 2]
 */
export function activeBits(mask: number, length: number): number[] {
  return Array.from({ length }, (_, i) => i).filter((i) => (mask >> i) & 1);
}
