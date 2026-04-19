/**
 * TMDB genre IDs are stable — hardcode them to avoid extra API calls.
 * TV-specific IDs are normalised to their movie equivalents where they overlap.
 */

/** Genre ID → display name. TV-specific entries are included for completeness. */
export const GENRE_NAMES: Record<number, string> = {
  // Movie genres
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  // TV-specific genres (not normalised)
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10766: 'Soap',
  10767: 'Talk',
};

/**
 * Map TV-specific genre IDs onto movie equivalents so radar axes stay
 * consistent across mixed movie/TV filmographies.
 */
const TV_TO_MOVIE: Record<number, number> = {
  10759: 28, // Action & Adventure → Action
  10765: 878, // Sci-Fi & Fantasy → Sci-Fi
  10768: 10752, // War & Politics → War
};

/** Normalise a raw TMDB genre ID, collapsing TV variants into their movie siblings. */
export function normalizeGenreId(id: number): number {
  return TV_TO_MOVIE[id] ?? id;
}

/** Human-readable label for a (normalised) genre ID. */
export function genreName(id: number): string {
  return GENRE_NAMES[id] ?? `Genre ${id}`;
}
