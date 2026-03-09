<script setup lang="ts">
import { ref } from 'vue'
import type { HistoryEntry } from '@/composables/useHistory'
import { useHistory } from '@/composables/useHistory'
import { profileUrl, posterUrl } from '@/composables/useTmdb'
import { surname } from '@/utils/names'
import { IconClock } from '@/components/icons'
import { useClickOutside } from '@/composables/useClickOutside'

const emit = defineEmits<{
  restore: [entry: HistoryEntry]
}>()

const { load, remove, clear } = useHistory()

const entries = ref<HistoryEntry[]>([])
const open    = ref(false)
const root    = ref<HTMLElement | null>(null)

entries.value = load()
useClickOutside([root], () => { open.value = false })

function refresh() { entries.value = load() }

function handleRemove(id: string, ev: Event) {
  ev.stopPropagation()
  remove(id)
  refresh()
}

function handleClear() {
  clear()
  refresh()
}

function handleRestore(entry: HistoryEntry) {
  emit('restore', entry)
  open.value = false
}

function entryLabel(entry: HistoryEntry): string {
  return entry.mode === 'person'
    ? entry.persons.map(p => surname(p.name)).join(' · ')
    : entry.titles.map(t => t.name).join(' · ')
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

defineExpose({ refresh })
</script>

<template>
  <div ref="root" class="history-float">

    <!-- Popup panel (above button) -->
    <Transition name="panel">
      <div v-if="open" class="history-panel">
        <div class="panel-header">
          <span class="panel-title">Recent searches</span>
          <button v-if="entries.length" class="clear-btn" @click="handleClear">Clear all</button>
        </div>

        <div v-if="!entries.length" class="panel-empty">No searches yet</div>

        <ul v-else class="panel-list">
          <li
            v-for="entry in entries"
            :key="entry.id"
            class="panel-entry"
            @click="handleRestore(entry)"
          >
            <div class="avatars">

              <!-- Person mode: circular profile photos -->
              <template v-if="entry.mode === 'person'">
                <div
                  v-for="(p, i) in entry.persons.slice(0, 4)"
                  :key="p.id"
                  class="avatar"
                  :style="`z-index: ${entry.persons.length - i}`"
                >
                  <img v-if="p.profile_path" :src="profileUrl(p.profile_path)" :alt="p.name" loading="lazy" />
                  <span v-else class="avatar-initial">{{ p.name[0] }}</span>
                </div>
                <div v-if="entry.persons.length > 4" class="avatar avatar-more">
                  +{{ entry.persons.length - 4 }}
                </div>
              </template>

              <!-- Title mode: poster thumbnails -->
              <template v-else>
                <div
                  v-for="(t, i) in entry.titles.slice(0, 4)"
                  :key="t.id"
                  class="avatar avatar-poster"
                  :style="`z-index: ${entry.titles.length - i}`"
                >
                  <img v-if="t.poster_path" :src="posterUrl(t.poster_path)" :alt="t.name" loading="lazy" />
                  <span v-else class="avatar-initial">{{ t.name[0] }}</span>
                </div>
                <div v-if="entry.titles.length > 4" class="avatar avatar-more">
                  +{{ entry.titles.length - 4 }}
                </div>
              </template>

            </div>

            <div class="entry-meta">
              <div class="entry-names-row">
                <span class="entry-names">{{ entryLabel(entry) }}</span>
              </div>
              <span class="entry-time">{{ relativeTime(entry.timestamp) }}</span>
            </div>

            <button class="remove-btn" title="Remove" @click="handleRemove(entry.id, $event)">×</button>
          </li>
        </ul>
      </div>
    </Transition>

    <!-- Floating toggle button -->
    <button
      class="float-btn"
      :class="{ 'float-btn--active': open }"
      :title="open ? 'Close history' : 'Search history'"
      @click="open = !open"
    >
      <IconClock />
      <span class="float-label">History</span>
      <span v-if="entries.length && !open" class="float-badge">{{ entries.length }}</span>
    </button>

  </div>
</template>

<style scoped>
/* ── Float anchor ── */
.history-float {
  position: fixed;
  bottom: 28px;
  left: 28px;
  z-index: 300;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

/* ── Toggle button ── */
.float-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px 8px 11px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 24px;
  color: var(--text-3);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
  box-shadow: 0 2px 12px rgba(0,0,0,0.35);
  position: relative;
}

.float-btn:hover,
.float-btn--active {
  background: var(--surface3);
  color: var(--text);
  border-color: rgba(255,255,255,0.12);
}

.float-label {
  line-height: 1;
}

.float-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: var(--accent, #f5c518);
  color: #000;
  font-size: 0.6rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}

/* ── Popup panel ── */
.history-panel {
  width: 280px;
  max-height: 420px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Panel header ── */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.panel-title {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-3);
}

.clear-btn {
  font-size: 0.7rem;
  color: var(--text-3);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.12s, color 0.12s;
}

.clear-btn:hover {
  background: var(--surface3);
  color: var(--text-2);
}

/* ── Empty ── */
.panel-empty {
  padding: 24px 14px;
  font-size: 0.78rem;
  color: var(--text-3);
  text-align: center;
}

/* ── List ── */
.panel-list {
  list-style: none;
  margin: 0;
  padding: 5px 0;
  overflow-y: auto;
}

/* ── Entry ── */
.panel-entry {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px 7px 12px;
  cursor: pointer;
  border-radius: 7px;
  margin: 2px 5px;
  transition: background 0.12s;
}

.panel-entry:hover {
  background: var(--surface3);
}

.panel-entry:hover .remove-btn {
  opacity: 1;
}

/* ── Avatars ── */
.avatars {
  display: flex;
  flex-shrink: 0;
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--surface2);
  overflow: hidden;
  background: var(--surface3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--text-2);
  margin-left: -10px;
  flex-shrink: 0;
}

.avatar:first-child { margin-left: 0; }

.avatar img {
  width: 100%; height: 100%;
  object-fit: cover;
  object-position: top center;
  display: block;
}

/* Poster avatars use a rounded-rect shape instead of circle */
.avatar-poster {
  border-radius: 4px;
}

.avatar-initial { text-transform: uppercase; line-height: 1; }
.avatar-more { font-size: 0.58rem; background: var(--surface3); }

/* ── Meta ── */
.entry-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entry-names-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}


.entry-names {
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-time {
  font-size: 0.64rem;
  color: var(--text-3);
}

/* ── Remove ── */
.remove-btn {
  opacity: 0;
  background: none;
  border: none;
  color: var(--text-3);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  flex-shrink: 0;
  transition: opacity 0.12s, color 0.12s;
}

.remove-btn:hover { color: #e05c5c; }

/* ── Panel transition ── */
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}
</style>
