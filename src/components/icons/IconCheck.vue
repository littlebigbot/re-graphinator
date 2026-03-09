<script setup lang="ts">
defineProps<{ width?: number; height?: number }>()
</script>
<template>
  <svg :width="width ?? 10" :height="height ?? 10" viewBox="0 0 10 10" fill="currentColor">
    <path d="M1.5 5l2.5 2.5 4.5-4.5"/>
  </svg>
</template>
