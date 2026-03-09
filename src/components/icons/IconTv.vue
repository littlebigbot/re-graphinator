<script setup lang="ts">
defineProps<{ width?: number; height?: number }>();
</script>
<template>
  <svg
    :width="width ?? 11"
    :height="height ?? 11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <polyline points="8 21 12 17 16 21" />
  </svg>
</template>
