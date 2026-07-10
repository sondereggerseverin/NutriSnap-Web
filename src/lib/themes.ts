const STORAGE_KEY = 'nutrisnap_theme'

export interface AppTheme {
  id: string
  label: string
  emoji: string
  primary: string
  primaryDark: string
  primaryLight: string
  accent: string
  accentLight: string
  background: string
}

// Identisch zu AppTheme in Theme.kt (Android) — id entspricht dem Kotlin-Enum-Namen,
// damit Werte plattformübergreifend eindeutig referenzierbar bleiben.
export const APP_THEMES: AppTheme[] = [
  {
    id: 'FOREST_GREEN', label: 'Forest Green', emoji: '🌿',
    primary: '#2D6A4F', primaryDark: '#1B4332', primaryLight: '#D8F3DC',
    accent: '#E07A5F', accentLight: '#F2C4BB', background: '#F8F4EF',
  },
  {
    id: 'OCEAN_BLUE', label: 'Ocean Blue', emoji: '🌊',
    primary: '#1E6091', primaryDark: '#0D3B5E', primaryLight: '#D0E8F5',
    accent: '#F4A261', accentLight: '#FDE8D0', background: '#F0F6FB',
  },
  {
    id: 'SUNSET_ORANGE', label: 'Sunset Orange', emoji: '🌅',
    primary: '#D4622A', primaryDark: '#8B3A10', primaryLight: '#FFE0CC',
    accent: '#4ECDC4', accentLight: '#B8F0EC', background: '#FFF8F4',
  },
  {
    id: 'LAVENDER_DUSK', label: 'Lavender Dusk', emoji: '🌆',
    primary: '#7C3AED', primaryDark: '#4C1D95', primaryLight: '#DDD6FE',
    accent: '#F472B6', accentLight: '#FCE7F3', background: '#F5F3FF',
  },
  {
    id: 'MINT_FRESH', label: 'Mint Fresh', emoji: '🍃',
    primary: '#10B981', primaryDark: '#047857', primaryLight: '#D1FAE5',
    accent: '#60A5FA', accentLight: '#DBEAFE', background: '#F0FDF4',
  },
  {
    id: 'ROSE_GOLD', label: 'Rose Gold', emoji: '🌸',
    primary: '#B5636E', primaryDark: '#7A3841', primaryLight: '#FDE8EA',
    accent: '#D4A017', accentLight: '#FFF3CC', background: '#FFF5F6',
  },
  {
    id: 'LAGOON_TEAL', label: 'Lagoon Teal', emoji: '🏝️',
    primary: '#0F766E', primaryDark: '#0B4F49', primaryLight: '#CCFBF1',
    accent: '#FB923C', accentLight: '#FFEDD5', background: '#F0FDFA',
  },
  {
    id: 'GOLDEN_AMBER', label: 'Golden Amber', emoji: '🍯',
    primary: '#B45309', primaryDark: '#78350F', primaryLight: '#FEF3C7',
    accent: '#0891B2', accentLight: '#CFFAFE', background: '#FFFBEB',
  },
  {
    id: 'SLATE_CHARCOAL', label: 'Slate Charcoal', emoji: '🖤',
    primary: '#334155', primaryDark: '#1E293B', primaryLight: '#E2E8F0',
    accent: '#F59E0B', accentLight: '#FEF3C7', background: '#F8FAFC',
  },
  {
    id: 'CHERRY_RED', label: 'Cherry Red', emoji: '🍒',
    primary: '#B91C1C', primaryDark: '#7F1D1D', primaryLight: '#FEE2E2',
    accent: '#10B981', accentLight: '#D1FAE5', background: '#FFF5F5',
  },
  {
    id: 'MIDNIGHT_INDIGO', label: 'Midnight Indigo', emoji: '🌌',
    primary: '#3730A3', primaryDark: '#1E1B4B', primaryLight: '#E0E7FF',
    accent: '#FBBF24', accentLight: '#FEF3C7', background: '#F5F5FF',
  },
  {
    id: 'CITRUS_ZEST', label: 'Citrus Zest', emoji: '🍋',
    primary: '#65A30D', primaryDark: '#3F6212', primaryLight: '#ECFCCB',
    accent: '#EC4899', accentLight: '#FCE7F3', background: '#FAFDF0',
  },
]

const DEFAULT_THEME_ID = APP_THEMES[0].id

export function getThemeById(id: string): AppTheme {
  return APP_THEMES.find((t) => t.id === id) ?? APP_THEMES[0]
}

export function getStoredThemeId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID
  } catch {
    return DEFAULT_THEME_ID
  }
}

export function setStoredThemeId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // localStorage kann in seltenen Fällen (z.B. Privatmodus) nicht verfügbar sein.
  }
}

// Setzt die Farb-Variablen aus index.css passend zum gewählten Theme. Neutrale Rollen
// (ink, ink-muted, line, success, danger, bg-elevated) bleiben fix — analog zu
// onBackground/onSurfaceVariant/outline/error in Theme.kt, die ebenfalls über alle
// Android-Themes hinweg konstant bleiben.
export function applyTheme(theme: AppTheme) {
  const root = document.documentElement.style
  root.setProperty('--bg', theme.background)
  root.setProperty('--accent', theme.primary)
  root.setProperty('--accent-hover', theme.primaryDark)
  root.setProperty('--accent-soft', theme.primaryLight)
}
