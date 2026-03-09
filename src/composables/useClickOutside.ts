import { onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

/**
 * Calls `onOutside` whenever a mousedown/click occurs outside ALL of the given
 * element refs.  Attaches and removes the listener on mount/unmount automatically.
 *
 * Usage:
 *   const btnRef   = ref<HTMLElement | null>(null)
 *   const panelRef = ref<HTMLElement | null>(null)
 *   useClickOutside([btnRef, panelRef], () => { open.value = false })
 */
export function useClickOutside(
  refs:      Ref<HTMLElement | null>[],
  onOutside: () => void,
): void {
  const handler = (e: MouseEvent) => {
    const clickedInside = refs.some(r => r.value?.contains(e.target as Node))
    if (!clickedInside) onOutside()
  }
  onMounted(()  => document.addEventListener('click', handler))
  onUnmounted(() => document.removeEventListener('click', handler))
}
