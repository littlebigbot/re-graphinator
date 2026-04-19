<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router';
import Toast from '@/components/Toast.vue';
</script>

<template>
  <nav class="app-nav">
    <RouterLink to="/venn" class="nav-link" active-class="nav-link--active">Venn</RouterLink>
    <RouterLink to="/ages" class="nav-link" active-class="nav-link--active">Ages</RouterLink>
  </nav>
  <RouterView />
  <div id="toast-portal" />
  <Toast />
</template>

<style scoped>
.app-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 8px 32px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-link {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  color: var(--text-3);
  text-decoration: none;
  padding: 3px 12px;
  border-radius: 999px;
  border: 1px solid transparent;
  transition:
    color 0.12s,
    background 0.12s,
    border-color 0.12s;
}

.nav-link:hover {
  color: var(--text-2);
}

.nav-link--active {
  color: var(--accent);
  background: var(--accent-dim);
  border-color: rgba(var(--accent-rgb), 0.3);
}
</style>
