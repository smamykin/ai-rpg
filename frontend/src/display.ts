export interface Theme {
  id: string
  name: string
  vars: Record<string, string>
}

export const THEMES: Theme[] = [
  {
    id: 'gold',
    name: 'Gold',
    vars: {
      '--bg': '#0c0a09', '--sf': '#161210', '--sf2': '#1e1a16', '--bd': '#2e2922',
      '--tx': '#e8e0d4', '--mt': '#8a8078', '--ac': '#d4a843', '--ac2': '#a37e2c', '--dng': '#c0392b',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    vars: {
      '--bg': '#090c14', '--sf': '#0f1420', '--sf2': '#151c2c', '--bd': '#1e2a40',
      '--tx': '#d4dce8', '--mt': '#6a7a90', '--ac': '#4a9eed', '--ac2': '#2d6fb5', '--dng': '#e04848',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    vars: {
      '--bg': '#080c0a', '--sf': '#0e1612', '--sf2': '#141e18', '--bd': '#1e3028',
      '--tx': '#d4e8dc', '--mt': '#6a8a78', '--ac': '#4ec07a', '--ac2': '#2d8a54', '--dng': '#d94444',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    vars: {
      '--bg': '#0e0908', '--sf': '#181010', '--sf2': '#221616', '--bd': '#3a2220',
      '--tx': '#e8d8d4', '--mt': '#907068', '--ac': '#e06040', '--ac2': '#b04430', '--dng': '#e04848',
    },
  },
]

export interface StoryFont {
  name: string
  category: 'serif' | 'sans-serif' | 'monospace'
}

export const FONTS: StoryFont[] = [
  { name: 'Crimson Pro', category: 'serif' },
  { name: 'Merriweather', category: 'serif' },
  { name: 'Lora', category: 'serif' },
  { name: 'EB Garamond', category: 'serif' },
  { name: 'Source Serif 4', category: 'serif' },
  { name: 'Literata', category: 'serif' },
  { name: 'Noto Serif', category: 'serif' },
  { name: 'PT Serif', category: 'serif' },
  { name: 'Spectral', category: 'serif' },
  { name: 'Inter', category: 'sans-serif' },
  { name: 'IBM Plex Sans', category: 'sans-serif' },
  { name: 'Nunito', category: 'sans-serif' },
  { name: 'JetBrains Mono', category: 'monospace' },
]

export interface DisplayPrefs {
  theme: string
  fontFamily: string
  fontSize: number
}

export const DISPLAY_DEFAULTS: DisplayPrefs = {
  theme: 'gold',
  fontFamily: 'Crimson Pro',
  fontSize: 1.1,
}

export const FONT_SIZE_MIN = 0.8
export const FONT_SIZE_MAX = 2.0
export const FONT_SIZE_STEP = 0.1
