<script setup lang="ts">
import { useTheme } from '@/composables/useTheme';
const { mode, cycleTheme } = useTheme();

const ICONS: Record<string, string> = {
  auto: '◑',
  dark: '●',
  light: '○',
};
const LABELS: Record<string, string> = {
  auto: 'AUTO',
  dark: 'DARK',
  light: 'LIGHT',
};
</script>

<template>
  <header class="header">
    <div class="logo">
      <span class="logo-text">Re-Graphinator</span>
      <span class="logo-sub">Filmography Overlap System</span>
    </div>

    <button class="theme-btn" :title="`Theme: ${LABELS[mode]}`" @click="cycleTheme">
      <span class="theme-icon">{{ ICONS[mode] }}</span>
      <span class="theme-label">{{ LABELS[mode] }}</span>
    </button>

    <div class="header-rule" />
  </header>
</template>

<style scoped>
.header {
  padding: 14px 32px 0;
  background: var(--bg);
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding-bottom: 11px;
  flex: 1;
}

.logo-text {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2rem;
  letter-spacing: 0.05em;
  line-height: 1;
  color: var(--accent);
  text-shadow: var(--accent-glow);
}

.logo-sub {
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  color: var(--text-3);
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  align-self: center;
}

/* ── Theme toggle ── */
.theme-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  margin-bottom: 10px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--r);
  color: var(--text-3);
  font-family: 'Lora', Georgia, serif;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  white-space: nowrap;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
  flex-shrink: 0;
}

.theme-btn:hover {
  color: var(--accent);
  border-color: rgba(107, 255, 42, 0.25);
  background: var(--accent-dim);
}

.theme-icon {
  font-size: 0.78rem;
  line-height: 1;
}

/* ── Rule ── */
.header-rule {
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(to right, var(--accent) 0%, var(--accent) 30%, transparent 100%);
  opacity: 0.4;
}

@media (max-width: 640px) {
  .header {
    padding: 12px 16px 0;
  }
  .logo-text {
    font-size: 1.6rem;
  }
  .logo-sub {
    display: none;
  }
}
</style>
