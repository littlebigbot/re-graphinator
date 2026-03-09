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

const props = defineProps<{
  item: ProjectWithRoles;
  persons: TmdbPerson[];
  selectedMask: RegionMask;
}>();

const emit = defineEmits<{ 'compare-with': [item: ProjectWithRoles] }>();

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
  <div class="movie-card" @click="confirming = !confirming">
    <div class="poster-wrap">
      <img v-if="poster" class="movie-poster" :src="poster" :alt="item.title" loading="lazy" />
      <div v-else class="movie-poster-placeholder">🎬</div>

      <!-- Title overlay — visible on hover -->
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
    </div>

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
        emit('compare-with', item);
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
  border-color: rgba(107, 255, 42, 0.3);
  box-shadow: 0 0 12px rgba(107, 255, 42, 0.12);
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

.tmdb-link:hover {
  color: var(--text-2);
  background: var(--surface3);
}
</style>
