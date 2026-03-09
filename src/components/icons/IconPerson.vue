<script setup lang="ts">
defineProps<{ width?: number | string; height?: number | string }>()
</script>
<template>
  <svg :width="width" :height="height" viewBox="0 0 60 90" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="28" r="16" fill="currentColor"/>
    <path d="M2 88 C2 58 58 58 58 88" fill="currentColor"/>
  </svg>
</template>
