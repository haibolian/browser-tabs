import { useLayoutEffect, useSyncExternalStore } from 'react'
import { resolveTheme, type ColorMode } from '@/lib/theme'

const systemPreference = '(prefers-color-scheme: dark)'
function subscribe(listener: () => void) {
  const query = window.matchMedia(systemPreference)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
function getSystemDark() {
  return window.matchMedia(systemPreference).matches
}

export function useTheme(mode: ColorMode) {
  const systemDark = useSyncExternalStore(subscribe, getSystemDark)
  const resolved = resolveTheme(mode, systemDark)
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.documentElement.style.colorScheme = resolved
    // This first-paint hint is also read by the external, CSP-safe bootstrap script.
    localStorage.setItem('blank:color-mode', mode)
  }, [mode, resolved])
  return resolved
}
