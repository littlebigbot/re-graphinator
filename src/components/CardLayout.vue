<script setup lang="ts">
defineProps<{
  thumbnailSrc: string;
  thumbnailAlt: string;
  name: string;
  subText: string;
  onClear: () => void;
  onError: (e: Event) => void;
}>();
</script>

<template>
  <div class="card-layout">
    <img class="card-thumbnail" :src="thumbnailSrc" :alt="thumbnailAlt" @error="onError" />
    <div class="card-info">
      <div class="card-name">{{ name }}</div>
      <div class="card-sub">{{ subText }}</div>
      <slot name="extra-info"></slot>
    </div>
    <button class="card-clear" @click="onClear">✕</button>
  </div>
</template>

<style scoped>
.card-layout {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--slot-color);
  border-radius: var(--r);
  position: relative;
}
</style>
