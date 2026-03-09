<script setup lang="ts">
import { ref } from 'vue'
import JsonTree from '@/components/JsonTree.vue'

const props = defineProps<{
  data: unknown
}>()

const open = ref(false)

function copyJson(): void {
  navigator.clipboard.writeText(JSON.stringify(props.data, null, 2))
    .catch(() => {/* ignore */})
}
</script>

<template>
  <div class="dbg-root">
    <!-- Floating action button -->
    <button
      class="dbg-fab"
      :class="{ 'dbg-fab--open': open }"
      title="Debug panel"
      @click="open = !open"
    >{ }</button>

    <!-- Panel -->
    <Transition name="dbg-slide">
      <div v-if="open" class="dbg-panel">
        <div class="dbg-header">
          <span class="dbg-title">Debug · persons + credits</span>
          <div class="dbg-actions">
            <button class="dbg-icon-btn" title="Copy JSON" @click="copyJson">⎘</button>
            <button class="dbg-icon-btn" title="Close" @click="open = false">✕</button>
          </div>
        </div>
        <div class="dbg-body">
          <JsonTree :value="data" :depth="0" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── Anchor ── */
.dbg-root {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 800;
}

/* ── FAB ── */
.dbg-fab {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text-3);
  font-size: 0.72rem;
  font-family: ui-monospace, monospace;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.45);
  transition: all 0.15s;
  letter-spacing: -1px;
}

.dbg-fab:hover,
.dbg-fab--open {
  background: var(--surface3, #2a2a2a);
  color: var(--text);
  border-color: rgba(255, 255, 255, 0.2);
}

/* ── Panel ── */
.dbg-panel {
  position: absolute;
  bottom: 48px;
  right: 0;
  width: 440px;
  max-height: 72vh;
  background: #141414;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ── */
.dbg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 8px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.02);
  flex-shrink: 0;
}

.dbg-title {
  font-size: 0.72rem;
  font-family: ui-monospace, monospace;
  color: var(--text-3);
  letter-spacing: 0.3px;
}

.dbg-actions {
  display: flex;
  gap: 4px;
}

.dbg-icon-btn {
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 2px 5px;
  border-radius: 4px;
  line-height: 1;
  transition: all 0.1s;
}
.dbg-icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

/* ── Scrollable body ── */
.dbg-body {
  overflow-y: auto;
  overflow-x: auto;
  padding: 10px 14px 14px;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

/* ── Slide-up transition ── */
.dbg-slide-enter-active,
.dbg-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dbg-slide-enter-from,
.dbg-slide-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.97);
}
</style>
