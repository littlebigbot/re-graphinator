import type { Project, CastMember, SortBy, CastSortBy } from '@/types/tmdb';

export function projectComparator(sortBy: SortBy): (a: Project, b: Project) => number {
  switch (sortBy) {
    case 'popularity':
      return (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0);
    case 'date-desc':
      return (a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? '');
    case 'date-asc':
      return (a, b) => (a.release_date ?? '').localeCompare(b.release_date ?? '');
    case 'rating-desc':
      return (a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0);
    case 'alpha':
      return (a, b) => (a.title ?? '').localeCompare(b.title ?? '');
    default:
      return () => 0;
  }
}

export function castComparator(sortBy: CastSortBy): (a: CastMember, b: CastMember) => number {
  switch (sortBy) {
    case 'popularity':
      return (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0);
    case 'roles':
      return (a, b) => b.roles.length - a.roles.length;
    default:
      return (a, b) => a.name.localeCompare(b.name);
  }
}
