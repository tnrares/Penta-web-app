/**
 * App-wide accent color (Appearance → Accent).
 * Sets CSS variables on :root and persists name in localStorage.
 */
export const ACCENT_STORAGE_KEY = 'penta-accent-name'

export type AccentName = 'blue' | 'purple' | 'pink' | 'green' | 'orange' | 'red'

export const ACCENT_PALETTE: Record<
  AccentName,
  { main: string; hover: string; subtle: string; textMuted: string }
> = {
  blue: {
    main: '#3b82f6',
    hover: '#2563eb',
    subtle: 'rgba(59, 130, 246, 0.15)',
    textMuted: 'rgba(96, 165, 250, 0.95)'
  },
  purple: {
    main: '#8b5cf6',
    hover: '#7c3aed',
    subtle: 'rgba(139, 92, 246, 0.15)',
    textMuted: 'rgba(196, 181, 253, 0.95)'
  },
  pink: {
    main: '#ec4899',
    hover: '#db2777',
    subtle: 'rgba(236, 72, 153, 0.15)',
    textMuted: 'rgba(251, 207, 232, 0.95)'
  },
  green: {
    main: '#22c55e',
    hover: '#16a34a',
    subtle: 'rgba(34, 197, 94, 0.15)',
    textMuted: 'rgba(74, 222, 128, 0.95)'
  },
  orange: {
    main: '#f59e0b',
    hover: '#d97706',
    subtle: 'rgba(245, 158, 11, 0.15)',
    textMuted: 'rgba(253, 224, 71, 0.95)'
  },
  red: {
    main: '#ef4444',
    hover: '#dc2626',
    subtle: 'rgba(239, 68, 68, 0.15)',
    textMuted: 'rgba(252, 165, 165, 0.95)'
  }
}

function isAccentName(s: string): s is AccentName {
  return s in ACCENT_PALETTE
}

export function useAppAccent() {
  function applyAccentByName(name: string) {
    const key = isAccentName(name) ? name : 'green'
    const c = ACCENT_PALETTE[key]

    if (!import.meta.client) return

    const root = document.documentElement
    root.style.setProperty('--penta-accent', c.main)
    root.style.setProperty('--penta-accent-hover', c.hover)
    root.style.setProperty('--penta-accent-subtle', c.subtle)
    root.style.setProperty('--penta-accent-text-muted', c.textMuted)
    root.dataset.accent = key

    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, key)
    } catch {
      /* ignore */
    }
  }

  /** Call on client startup before paint if possible */
  function initAccentFromStorage() {
    if (!import.meta.client) return
    try {
      const name = localStorage.getItem(ACCENT_STORAGE_KEY)
      if (name) applyAccentByName(name)
    } catch {
      applyAccentByName('green')
    }
  }

  return {
    applyAccentByName,
    initAccentFromStorage,
    ACCENT_PALETTE
  }
}
