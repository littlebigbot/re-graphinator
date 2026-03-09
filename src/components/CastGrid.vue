<script setup lang="ts">
import { ref } from 'vue'
import type { CastMemberInRegion, TmdbTitle, RegionMask, CastSortBy } from '@/types/tmdb'
import { PERSON_COLORS } from '@/types/tmdb'
import { profileUrl, tmdbUrl } from '@/composables/useTmdb'
import { activeBits } from '@/utils/bitmask'
import { IconExternalLink, IconPerson } from '@/components/icons'

const props = defineProps<{
  items:        CastMemberInRegion[]
  titles:       TmdbTitle[]
  selectedMask: RegionMask
  sortBy:       CastSortBy
}>()

const emit = defineEmits<{
  'update:sortBy':  [sort: CastSortBy]
  'compare-with':   [member: CastMemberInRegion]
}>()

const confirming   = ref<number | null>(null)
const brokenPhotos = ref(new Set<number>())

function toggleConfirm(id: number) {
  confirming.value = confirming.value === id ? null : id
}

function onPhotoError(id: number) {
  brokenPhotos.value = new Set(brokenPhotos.value).add(id)
}

function activeTitleIndices(): number[] {
  return activeBits(props.selectedMask, props.titles.length)
}
</script>

<template>
  <section class="results-section">
    <div class="grid-header">
      <span class="results-count">{{ items.length }} person{{ items.length === 1 ? '' : 's' }}</span>
      <select
        class="sort-select"
        :value="sortBy"
        @change="emit('update:sortBy', ($event.target as HTMLSelectElement).value as CastSortBy)"
      >
        <option value="alpha">A–Z</option>
        <option value="popularity">Most popular</option>
        <option value="roles">Most roles</option>
      </select>
    </div>
    <div class="scroll-area">
      <div v-if="items.length" class="cast-grid">
        <div
          v-for="member in items"
          :key="member.id"
          class="cast-card"
          @click="toggleConfirm(member.id)"
        >
          <div class="photo-wrap">
            <img
              v-if="member.profile_path && !brokenPhotos.has(member.id)"
              class="cast-photo"
              :src="profileUrl(member.profile_path)"
              :alt="member.name"
              loading="lazy"
              @error="onPhotoError(member.id)"
            >
            <div v-else class="cast-photo-placeholder">
              <IconPerson />
            </div>

            <div class="cast-body">
            <div class="cast-name">{{ member.name }}</div>
            <div v-if="member.known_for_department" class="cast-dept">{{ member.known_for_department }}</div>
            <div class="cast-roles">
              <div
                v-for="i in activeTitleIndices()"
                :key="i"
                class="role-line"
              >
                <span class="role-dot" :style="`background: ${PERSON_COLORS[i]}`" />
                <span class="role-title">{{ titles[i]?.name }}</span>
                <span v-if="member.rolesBySlot[i]?.length" class="role-text">
                  — {{ member.rolesBySlot[i].slice(0, 2).join(', ') }}
                </span>
              </div>
            </div>
            <!-- TMDB external link -->
            <a
              class="tmdb-link"
              :href="tmdbUrl('person', member.id)"
              target="_blank"
              rel="noopener noreferrer"
              title="View on TMDB"
              @click.stop
            >
              <IconExternalLink />
            </a>
          </div>
          </div><!-- /photo-wrap -->

          <!-- Confirm inset -->
          <Transition name="confirm">
            <div
              v-if="confirming === member.id"
              class="confirm-overlay"
              @click.self="confirming = null"
            >
              <div class="confirm-box">
                <p class="confirm-prompt">Compare from<br><strong>{{ member.name }}</strong>?</p>
                <div class="confirm-btns">
                  <button
                    class="confirm-yes"
                    @click.stop="emit('compare-with', member); confirming = null"
                  >Start</button>
                  <button
                    class="confirm-no"
                    @click.stop="confirming = null"
                  >Cancel</button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
      <p v-else class="no-results">Nobody here for this combination.</p>
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

.sort-select {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 5px 10px;
  font-size: 0.78rem;
  outline: none;
}

.scroll-area {
  overflow-x: auto;
}

.cast-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

/* ── Card ── */
.cast-card {
  position: relative;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  overflow: hidden;
  cursor: pointer;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.cast-card:hover {
  border-color: rgba(107, 255, 42, 0.3);
  box-shadow: 0 0 12px rgba(107, 255, 42, 0.07);
}

.photo-wrap {
  position: relative;
}

.cast-photo {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  background: var(--surface3);
  display: block;
}

.cast-photo-placeholder {
  width: 100%;
  aspect-ratio: 2 / 3;
  background: var(--surface3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cast-photo-placeholder svg {
  width: 48%;
  color: var(--text-3);
  opacity: 0.4;
}

.cast-body {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px 10px 8px;
  background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 60%, transparent 100%);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cast-name {
  font-weight: 700;
  font-size: 0.82rem;
  line-height: 1.25;
  color: #fff;
}

.cast-dept {
  font-size: 0.68rem;
  color: rgba(255,255,255,0.5);
  margin-bottom: 2px;
}

.cast-roles {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 2px;
}

.role-line {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 0.7rem;
  min-width: 0;
}

.role-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
  top: -1px;
}

.role-title {
  color: rgba(255,255,255,0.75);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}

.role-text {
  color: rgba(255,255,255,0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  color: rgba(255,255,255,0.55);
  opacity: 0;
  background: rgba(0,0,0,0.5);
  box-shadow: 0 0 10px 8px rgba(0,0,0,0.5);
  transition: color 0.12s, opacity 0.15s;
}

.cast-card:hover .tmdb-link {
  opacity: 1;
}

.tmdb-link:hover {
  color: var(--text-2);
}

/* ── Confirm overlay ── */
.confirm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 10, 10, 0.72);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.confirm-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
  text-align: center;
}

.confirm-prompt {
  font-size: 0.82rem;
  color: var(--text-2);
  line-height: 1.5;
  margin: 0;
}

.confirm-prompt strong {
  color: var(--text);
  font-size: 0.9rem;
}

.confirm-btns {
  display: flex;
  gap: 8px;
}

.confirm-yes {
  padding: 6px 16px;
  border-radius: 6px;
  border: none;
  background: rgba(107, 255, 42, 0.18);
  color: #8fff5a;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;
}

.confirm-yes:hover {
  background: rgba(107, 255, 42, 0.3);
}

.confirm-no {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.confirm-no:hover {
  background: var(--surface3);
  color: var(--text-2);
}

/* ── Transition ── */
.confirm-enter-active, .confirm-leave-active {
  transition: opacity 0.15s ease;
}
.confirm-enter-from, .confirm-leave-to {
  opacity: 0;
}

.no-results {
  font-size: 0.82rem;
  color: var(--text-3);
  padding: 32px 0;
  text-align: center;
}
</style>
