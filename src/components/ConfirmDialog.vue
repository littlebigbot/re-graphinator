<script setup lang="ts">
defineProps<{
  show: boolean;
  name: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <Transition name="confirm">
    <div v-if="show" class="confirm-overlay" @click.self="emit('cancel')">
      <div class="confirm-box">
        <p class="confirm-prompt">
          Compare from<br /><strong>{{ name }}</strong
          >?
        </p>
        <div class="confirm-btns">
          <button class="confirm-yes" @click.stop="emit('confirm')">Start</button>
          <button class="confirm-no" @click.stop="emit('cancel')">Cancel</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
/* ── Confirm overlay ── */
.confirm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 10, 10, 0.72);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.confirm-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
  text-align: center;
}

.confirm-prompt {
  font-size: 0.82rem;
  color: var(--text-2);
  line-height: 1.5;
  margin: 0;
}

.confirm-prompt strong {
  color: var(--text);
  font-size: 0.9rem;
}

.confirm-btns {
  display: flex;
  gap: 8px;
}

.confirm-yes {
  padding: 6px 16px;
  border-radius: 6px;
  border: none;
  background: rgba(107, 255, 42, 0.18);
  color: #8fff5a;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;
}

.confirm-yes:hover {
  background: rgba(107, 255, 42, 0.3);
}

.confirm-no {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  font-size: 0.8rem;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.confirm-no:hover {
  background: var(--surface3);
  color: var(--text-2);
}

/* ── Transition ── */
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.15s ease;
}
.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}
</style>
