import { describe, it, expect, beforeEach } from 'vitest';
import { useVennState, MAX_PERSONS, MIN_PERSONS } from './useVennState';
import type { TmdbPerson } from '@/types/tmdb';

function makePerson(id: number, name: string): TmdbPerson {
  return {
    id,
    name,
    profile_path: null,
    known_for_department: 'Acting',
    known_for: [],
  };
}

describe('useVennState', () => {
  beforeEach(() => {
    // ensure a fresh instance per test by calling clearSearch
    const venn = useVennState();
    venn.clearSearch();
  });

  it('starts with two empty slots and no results', () => {
    const venn = useVennState();
    expect(venn.slots.value.length).toBe(2);
    expect(venn.slots.value.every((s) => s === null)).toBe(true);
    expect(venn.hasResults.value).toBe(false);
  });

  it('locks searchMode to person when first person is set', () => {
    const venn = useVennState();
    const p = makePerson(1, 'Person One');
    venn.handleSlotUpdate(0, p);
    expect(venn.searchMode.value).toBe('person');
  });

  it('adds and removes slots within bounds', () => {
    const venn = useVennState();

    // add up to MAX_PERSONS
    for (let i = venn.slots.value.length; i < MAX_PERSONS; i += 1) {
      venn.addSlot();
    }
    expect(venn.slots.value.length).toBe(MAX_PERSONS);

    // further adds should be ignored
    venn.addSlot();
    expect(venn.slots.value.length).toBe(MAX_PERSONS);

    // remove down to MIN_PERSONS
    while (venn.slots.value.length > MIN_PERSONS) {
      venn.removeSlot();
    }
    expect(venn.slots.value.length).toBe(MIN_PERSONS);
  });

  it('compactSlots drops null slots and keeps non-null ones', () => {
    const venn = useVennState();
    const p1 = makePerson(1, 'A');
    const p2 = makePerson(2, 'B');

    venn.handleSlotUpdate(0, p1);
    venn.handleSlotUpdate(1, null);
    venn.addSlot();
    venn.handleSlotUpdate(2, p2);

    expect(venn.slots.value.length).toBe(3);
    venn.compactSlots();
    expect(venn.slots.value.length).toBe(2);
    expect(venn.activePeople.value.map((p) => p.id)).toEqual([1, 2]);
  });
});
