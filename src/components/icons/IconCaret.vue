<script setup lang="ts">
defineProps<{ width?: number; height?: number }>();
</script>
<template>
  <svg :width="width ?? 10" :height="height ?? 10" viewBox="0 0 10 10" fill="currentColor">
    <path d="M2 3.5l3 3 3-3" />
  </svg>
</template>
