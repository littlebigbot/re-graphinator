import { describe, it, expect } from 'vitest';
import { VENN_LAYOUTS, slotPosition } from './vennLayout';

describe('vennLayout', () => {
  it('defines layouts for 1–5 slots', () => {
    for (let n = 1; n <= 5; n += 1) {
      expect(VENN_LAYOUTS[n]).toBeDefined();
      const layout = VENN_LAYOUTS[n];
      expect(layout.W).toBeGreaterThan(0);
      expect(layout.H).toBeGreaterThan(0);
    }
  });

  it('computes slot positions within 0–100% bounds', () => {
    const n = 3;
    for (let i = 0; i < n; i += 1) {
      const pos = slotPosition(n, i, { y: 'below' });
      expect(pos.pctLeft).toBeGreaterThanOrEqual(0);
      expect(pos.pctLeft).toBeLessThanOrEqual(100);
      expect(pos.pctTop).toBeGreaterThanOrEqual(0);
      expect(pos.pctTop).toBeLessThanOrEqual(100);
    }
  });
});
