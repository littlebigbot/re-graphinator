export { default as IconExternalLink } from './IconExternalLink.vue';
export { default as IconPerson } from './IconPerson.vue';
export { default as IconTv } from './IconTv.vue';
export { default as IconFilm } from './IconFilm.vue';
export { default as IconGear } from './IconGear.vue';
export { default as IconClock } from './IconClock.vue';
export { default as IconCaret } from './IconCaret.vue';
export { default as IconCheck } from './IconCheck.vue';
export { default as IconShare } from './IconShare.vue';

/** Path data for the person silhouette, for use with D3 (viewBox: 0 0 60 90) */
export const PERSON_SILHOUETTE = {
  headCx: 30,
  headCy: 28,
  headR: 16,
  bodyD: 'M2 88 C2 58 58 58 58 88',
} as const;
