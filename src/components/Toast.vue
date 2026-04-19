<script setup lang="ts">
import { useToast } from '@/composables/useToast';
const { toasts, dismiss } = useToast();

defineOptions({
  name: 'ToastNotification',
});
</script>
<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="String(t.id)" class="toast" :class="t.type">
          <span class="toast-msg">{{ t.message }}</span>
          <button
            v-if="t.retry"
            class="toast-retry"
            @click="
              t.retry?.();
              dismiss(t.id);
            "
          >
            Retry
          </button>
          <button class="toast-dismiss" @click="dismiss(t.id)">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
<style scoped>
.toast-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.toast-container > * {
  pointer-events: auto;
}
.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  max-width: 420px;
}
.toast.error {
  border-color: var(--blood);
}
.toast.success {
  border-color: var(--accent);
}
.toast-msg {
  flex: 1;
  font-size: 0.88rem;
}
.toast-retry,
.toast-dismiss {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--text-2);
}
.toast-retry {
  color: var(--accent);
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
