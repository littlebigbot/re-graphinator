<script setup lang="ts">
import type { ProjectWithRoles, TmdbPerson, RegionMask } from '@/types/tmdb';
import MovieCard from './MovieCard.vue';

defineProps<{
  items: ProjectWithRoles[];
  persons: TmdbPerson[];
  selectedMask: RegionMask;
}>();

const emit = defineEmits<{
  'compare-with': [item: ProjectWithRoles];
}>();
</script>

<template>
  <section class="results-section">
    <div class="grid-header">
      <span class="results-count">{{ items.length }} title{{ items.length === 1 ? '' : 's' }}</span>
    </div>
    <div class="scroll-area">
      <div v-if="items.length" class="movie-grid">
        <MovieCard
          v-for="item in items"
          :key="item.id"
          :item="item"
          :persons="persons"
          :selected-mask="selectedMask"
          @compare-with="emit('compare-with', $event)"
        />
      </div>
      <p v-else class="no-results">Nothing here for this combination.</p>
    </div>
  </section>
</template>

<style scoped>
.grid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.results-count {
  font-size: 0.78rem;
  color: var(--text-3);
}

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
