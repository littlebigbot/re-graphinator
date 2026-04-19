/**
 * Simple toast for errors and feedback.
 * Renders via a teleport target in App.vue.
 */
import { ref, type Ref } from 'vue';

export interface ToastEntry {
  id: symbol;
  message: string;
  type: 'error' | 'success';
  retry?: () => void;
}

const toasts: Ref<ToastEntry[]> = ref([]);

export function useToast() {
  function show(message: string, type: 'error' | 'success' = 'error', retry?: () => void) {
    const id = Symbol();
    toasts.value = [...toasts.value, { id, message, type, retry }];
    setTimeout(
      () => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
      },
      type === 'error' ? 8000 : 3000,
    );
  }

  function dismiss(id: symbol) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    showError: (message: string, retry?: () => void) => show(message, 'error', retry),
    showSuccess: (message: string) => show(message, 'success'),
    dismiss,
  };
}
