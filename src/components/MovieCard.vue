<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ProjectWithRoles, TmdbPerson, RegionMask } from '@/types/tmdb';
import { PERSON_COLORS } from '@/types/tmdb';
import { posterUrl, tmdbUrl } from '@/composables/useTmdb';
import { surname } from '@/utils/names';
import { releaseYear } from '@/utils/date';
import { activeBits } from '@/utils/bitmask';
import { IconExternalLink, IconTv, IconFilm } from '@/components/icons';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const props = withDefaults(
  defineProps<{
    item: ProjectWithRoles;
    persons: TmdbPerson[];
    selectedMask: RegionMask;
    /** This item's Venn region mask (for highlight-on-hover). Undefined in title mode. */
    regionMask?: RegionMask;
  }>(),
  { regionMask: 0 },
);

const emit = defineEmits<{
  'compare-with': [item: ProjectWithRoles];
  'region-hover': [mask: RegionMask];
}>();
/** Expose for template (props aren't auto-unwrapped as top-level bindings). */
const item = computed(() => props.item);
const regionMask = computed(() => props.regionMask ?? 0);

const confirming = ref(false);

const year = computed(() => releaseYear(props.item.release_date, '—'));
const href = computed(() => tmdbUrl(props.item.media_type, props.item.id));
const poster = computed(() => posterUrl(props.item.poster_path));
const isTV = computed(() => props.item.media_type === 'tv');

const activePeople = computed(() =>
  activeBits(props.selectedMask, props.persons.length).map((i) => ({ p: props.persons[i], i })),
);

function rolesStr(roles: string[]): string {
  return roles.join(', ') || '—';
}
</script>

<template>
  <div
    class="movie-card"
    @click="confirming = !confirming"
    @mouseenter="regionMask ? emit('region-hover', regionMask) : null"
    @mouseleave="emit('region-hover', 0)"
  >
    <div class="poster-wrap">
      <img v-if="poster" class="movie-poster" :src="poster" :alt="item.title" loading="lazy" />
      <div v-else class="movie-poster-placeholder">🎬</div>

      <!-- Title overlay — visible on hover (desktop), always visible on mobile -->
      <div class="poster-overlay">
        <div class="movie-title">
          {{ item.title }}
          <span class="title-year">({{ year }})</span>
          <span class="type-icon" :title="isTV ? 'TV' : 'Film'">
            <IconTv v-if="isTV" />
            <IconFilm v-else />
          </span>
        </div>
      </div>

      <!-- Title strip always visible on mobile (no hover) -->
      <div class="poster-title-mobile">
        <span class="mobile-title">{{ item.title }}</span>
        <span class="mobile-year">({{ year }})</span>
      </div>
    </div>

    <!-- Compare button — visible on hover (desktop) or always (mobile) -->
    <button type="button" class="compare-btn" title="Compare from this title" @click.stop="confirming = true">
      Compare
    </button>

    <div class="movie-body">
      <div v-if="activePeople.length > 1" class="movie-roles">
        <span v-for="{ p, i } in activePeople" :key="i" class="role-line">
          <span class="role-name" :style="`color: ${PERSON_COLORS[i]}`"> {{ surname(p.name) }} </span>:
          {{ rolesStr(item.rolesByPerson[i] ?? []) }}
        </span>
      </div>
      <div v-else-if="activePeople.length === 1" class="movie-roles single">
        {{ rolesStr(item.rolesByPerson[activePeople[0].i] ?? []) }}
      </div>

      <!-- TMDB external link — absolute bottom-right -->
      <a class="tmdb-link" :href="href" target="_blank" rel="noopener noreferrer" title="View on TMDB" @click.stop>
        <IconExternalLink />
      </a>
    </div>

    <!-- Confirm inset -->
    <ConfirmDialog
      :show="confirming"
      :name="item.title"
      @confirm="
        emit('compare-with', props.item);
        confirming = false;
      "
      @cancel="confirming = false"
    />
  </div>
</template>

<style scoped>
.movie-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  overflow: hidden;
  cursor: pointer;
  color: inherit;
  transition:
    border-color 0.18s,
    box-shadow 0.18s;
}

.movie-card:hover {
  border-color: rgba(var(--accent-rgb), 0.3);
  box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.12);
}

.poster-wrap {
  position: relative;
}

.movie-poster {
  width: 100%;
  aspect-ratio: 2/3;
  object-fit: cover;
  display: block;
  background: var(--surface3);
}

.movie-poster-placeholder {
  aspect-ratio: 2/3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface3);
  color: var(--text-3);
  font-size: 2rem;
}

.poster-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.4) 45%, transparent 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 8px 10px;
  opacity: 0;
  transition: opacity 0.18s;
}

.movie-card:hover .poster-overlay {
  opacity: 1;
}

.movie-title {
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.35;
  color: #fff;
}

.title-year {
  font-weight: 400;
  color: rgba(255, 255, 255, 0.65);
}

.type-icon {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  color: rgba(255, 255, 255, 0.55);
  margin-left: 3px;
  position: relative;
  top: -1px;
}

.movie-body {
  position: relative;
  padding: 6px 10px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.movie-roles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.68rem;
  color: var(--text-2);
  line-height: 1.4;
  margin-top: 2px;
}

.movie-roles.single {
  font-size: 0.68rem;
}
.role-line {
  display: block;
}
.role-name {
  font-weight: 600;
}

.tmdb-link {
  position: absolute;
  bottom: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: var(--text-3);
  opacity: 0;
  background: var(--surface2);
  box-shadow: 0 0 10px 8px var(--surface2);
  transition:
    color 0.12s,
    opacity 0.15s;
}

.movie-card:hover .tmdb-link {
  opacity: 1;
}

/* Title strip — visible on mobile only (no hover on touch) */
.poster-title-mobile {
  display: none;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 6px 8px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
  flex-direction: column;
  gap: 0;
}
@media (max-width: 640px), (pointer: coarse) {
  .poster-title-mobile {
    display: flex;
  }
  .movie-card:hover .poster-overlay {
    opacity: 0; /* prefer mobile strip on touch */
  }
  .compare-btn {
    opacity: 1;
  }
}

.mobile-title {
  font-size: 0.72rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mobile-year {
  font-size: 0.64rem;
  color: rgba(255, 255, 255, 0.7);
}

/* Compare button — hover (desktop) or always (mobile) */
.compare-btn {
  position: absolute;
  bottom: 8px;
  left: 8px;
  padding: 4px 10px;
  font-size: 0.7rem;
  font-weight: 600;
  background: rgba(var(--accent-rgb), 0.25);
  color: var(--accent);
  border: 1px solid rgba(var(--accent-rgb), 0.5);
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 2;
}
.movie-card:hover .compare-btn {
  opacity: 1;
}
.compare-btn:hover {
  background: rgba(var(--accent-rgb), 0.4);
}

.tmdb-link:hover {
  color: var(--text-2);
  background: var(--surface3);
}
</style>
