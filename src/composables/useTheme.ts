import { ref, watch, onMounted } from 'vue'

export type ThemeMode = 'dark' | 'light' | 'auto'

const STORAGE_KEY = 'reGraphinator-theme'

// Singleton — shared across all callers
const mode = ref<ThemeMode>('auto')

function applyTheme(m: ThemeMode): void {
  const root = document.documentElement
  if (m === 'dark')  { root.setAttribute('data-theme', 'dark') }
  else if (m === 'light') { root.setAttribute('data-theme', 'light') }
  else               { root.removeAttribute('data-theme') }
}

export function useTheme() {
  onMounted(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    mode.value = stored ?? 'auto'
    applyTheme(mode.value)
  })

  watch(mode, (m) => {
    applyTheme(m)
    if (m === 'auto') localStorage.removeItem(STORAGE_KEY)
    else              localStorage.setItem(STORAGE_KEY, m)
  })

  /** Cycle: auto → dark → light → auto */
  function cycleTheme(): void {
    const order: ThemeMode[] = ['auto', 'dark', 'light']
    const idx = order.indexOf(mode.value)
    mode.value = order[(idx + 1) % order.length]
  }

  /** Resolved theme based on mode + OS */
  function resolvedTheme(): 'dark' | 'light' {
    if (mode.value !== 'auto') return mode.value
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  return { mode, cycleTheme, resolvedTheme }
}
