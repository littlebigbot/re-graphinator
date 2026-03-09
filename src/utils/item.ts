import type { TmdbPerson, TmdbTitle } from '@/types/tmdb';
import { isPersonSlot } from '@/types/tmdb';
import { profileUrl, posterUrl } from '@/composables/useTmdb';
import { releaseYear } from '@/utils/date';

export function mediaTypeLabel(mediaType: 'movie' | 'tv'): string {
  return mediaType === 'tv' ? 'TV' : 'Film';
}

export function itemLabel(item: TmdbPerson | TmdbTitle): string {
  if (isPersonSlot(item)) {
    const dept = item.known_for_department ?? '';
    const known = (item.known_for ?? [])
      .map((k) => k.title ?? k.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(', ');
    return [dept, known].filter(Boolean).join(' · ');
  }
  const year = releaseYear(item.release_date);
  const type = mediaTypeLabel(item.media_type);
  return [year, type].filter(Boolean).join(' · ');
}

export function itemBadge(item: TmdbPerson | TmdbTitle, searchMode: string | null): string | null {
  if (searchMode !== null) {
    return null;
  }
  if (isPersonSlot(item)) {
    return 'Person';
  }
  return mediaTypeLabel(item.media_type);
}

export function itemThumb(item: TmdbPerson | TmdbTitle): string {
  return isPersonSlot(item)
    ? profileUrl((item as TmdbPerson).profile_path)
    : posterUrl((item as TmdbTitle).poster_path);
}
