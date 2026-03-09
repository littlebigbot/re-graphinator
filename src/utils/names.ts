/** Returns the last word of a name (surname heuristic), or the whole name if single-word. */
export function surname(name: string): string {
  return name.trim().split(' ').slice(-1)[0];
}
