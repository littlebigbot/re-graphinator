/** Extract a 4-digit year string from a date string like "2003-11-14". */
export function releaseYear(date?: string | null, fallback = ''): string {
  return date?.slice(0, 4) ?? fallback;
}
