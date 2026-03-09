<script setup lang="ts">
defineProps<{ width?: number; height?: number }>();
</script>
<template>
  <svg
    :width="width ?? 12"
    :height="height ?? 12"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" />
    <path d="M8 1h3v3" />
    <path d="M11 1 5.5 6.5" />
  </svg>
</template>
