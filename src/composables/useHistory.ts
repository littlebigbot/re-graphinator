import type { TmdbPerson, TmdbTitle } from '@/types/tmdb'

const KEY = 'filmgraph-history'
const MAX = 20

export type HistoryMode = 'person' | 'title'

export interface HistoryEntry {
  id:        string
  mode:      HistoryMode
  persons:   TmdbPerson[]   // populated when mode === 'person'
  titles:    TmdbTitle[]    // populated when mode === 'title'
  timestamp: number
}

export function useHistory() {
  function load(): HistoryEntry[] {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return []
      // Coerce legacy entries (pre-title-mode) that lack mode/titles
      return (JSON.parse(raw) as Partial<HistoryEntry>[]).map(e => ({
        id:        e.id        ?? Date.now().toString(),
        mode:      e.mode      ?? 'person',
        persons:   e.persons   ?? [],
        titles:    e.titles    ?? [],
        timestamp: e.timestamp ?? 0,
      }))
    } catch {
      return []
    }
  }

  function dedupeKey(entry: HistoryEntry): string {
    return entry.mode === 'person'
      ? entry.persons.map(p => p.id).sort().join(',')
      : entry.titles.map(t => `${t.media_type}-${t.id}`).sort().join(',')
  }

  function save(entry: HistoryEntry): void {
    const key = dedupeKey(entry)
    const rest = load().filter(e => dedupeKey(e) !== key)
    rest.unshift(entry)
    localStorage.setItem(KEY, JSON.stringify(rest.slice(0, MAX)))
  }

  function savePerson(persons: TmdbPerson[]): void {
    save({ id: Date.now().toString(), mode: 'person', persons, titles: [], timestamp: Date.now() })
  }

  function saveTitle(titles: TmdbTitle[]): void {
    save({ id: Date.now().toString(), mode: 'title', persons: [], titles, timestamp: Date.now() })
  }

  function remove(id: string): void {
    localStorage.setItem(KEY, JSON.stringify(load().filter(e => e.id !== id)))
  }

  function clear(): void {
    localStorage.removeItem(KEY)
  }

  return { load, savePerson, saveTitle, remove, clear }
}
