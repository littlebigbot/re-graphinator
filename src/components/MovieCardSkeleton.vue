<script setup lang="ts"></script>

<template>
  <div class="skeleton-card">
    <div class="skeleton-poster" />
    <div class="skeleton-body">
      <div class="skeleton-line skeleton-line--short" />
      <div class="skeleton-line" />
    </div>
  </div>
</template>

<style scoped>
.skeleton-card {
  display: flex;
  flex-direction: column;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  overflow: hidden;
}

.skeleton-poster {
  aspect-ratio: 2/3;
  background: linear-gradient(110deg, var(--surface3) 25%, var(--surface2) 50%, var(--surface3) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
}

.skeleton-body {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skeleton-line {
  height: 10px;
  border-radius: 4px;
  background: linear-gradient(110deg, var(--surface3) 25%, var(--surface2) 50%, var(--surface3) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
  animation-delay: 0.1s;
}

.skeleton-line--short {
  width: 70%;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-poster,
  .skeleton-line {
    animation: none;
  }
}
</style>
