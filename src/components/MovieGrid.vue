<script setup lang="ts">
import type { ProjectWithRoles, TmdbPerson, RegionMask } from '@/types/tmdb';
import MovieCard from './MovieCard.vue';
import MovieCardSkeleton from './MovieCardSkeleton.vue';

defineProps<{
  items: ProjectWithRoles[];
  persons: TmdbPerson[];
  selectedMask: RegionMask;
  /** Map item key (media_type-id) to region mask for Venn highlight on hover. */
  itemRegionMask?: Map<string, RegionMask>;
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  'compare-with': [item: ProjectWithRoles];
  'region-hover': [mask: RegionMask];
}>();
</script>

<template>
  <section class="results-section">
    <div class="grid-header">
      <span class="results-count">{{ items.length }} title{{ items.length === 1 ? '' : 's' }}</span>
    </div>
    <div class="scroll-area">
      <div v-if="isLoading" class="movie-grid">
        <MovieCardSkeleton v-for="i in 12" :key="i" />
      </div>
      <div v-else-if="items.length" class="movie-grid">
        <MovieCard
          v-for="item in items"
          :key="`${item.media_type}-${item.id}`"
          :item="item"
          :persons="persons"
          :selected-mask="selectedMask"
          :region-mask="itemRegionMask?.get(`${item.media_type}-${item.id}`) ?? 0"
          @compare-with="emit('compare-with', $event)"
          @region-hover="emit('region-hover', $event)"
        />
      </div>
      <p v-else class="no-results">No overlapping credits found for these people.</p>
    </div>
  </section>
</template>

<style>
@import '@/style/grid.css';
</style>

<style scoped>
.scroll-area {
  max-height: 640px;
  overflow-y: auto;
  padding-right: 4px;
}

.movie-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 14px;
}

.no-results {
  padding: 24px;
  color: var(--text-3);
  font-size: 0.85rem;
}
</style>
