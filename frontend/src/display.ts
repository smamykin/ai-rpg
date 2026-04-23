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
  {
    id: 'noir',
    name: 'Noir',
    vars: {
      '--bg': '#030303', '--sf': '#0a0a0a', '--sf2': '#121212', '--bd': '#1f1f1f',
      '--tx': '#d8d4d0', '--mt': '#6a6660', '--ac': '#8b2635', '--ac2': '#5c1820', '--dng': '#c0392b',
    },
  },
  {
    id: 'arcane',
    name: 'Arcane',
    vars: {
      '--bg': '#0b0814', '--sf': '#130e20', '--sf2': '#1b142c', '--bd': '#2c2044',
      '--tx': '#e2d8f0', '--mt': '#8878a0', '--ac': '#b57aff', '--ac2': '#8a4fd0', '--dng': '#d94466',
    },
  },
  {
    id: 'frost',
    name: 'Frost',
    vars: {
      '--bg': '#080c10', '--sf': '#0e1620', '--sf2': '#15202e', '--bd': '#223244',
      '--tx': '#dce8f0', '--mt': '#7a8ea0', '--ac': '#6ad0e8', '--ac2': '#3c94b0', '--dng': '#e06060',
    },
  },
  {
    id: 'rust',
    name: 'Rust',
    vars: {
      '--bg': '#0e0a06', '--sf': '#18120a', '--sf2': '#221a10', '--bd': '#3a2a18',
      '--tx': '#ecdcc0', '--mt': '#908070', '--ac': '#d87c2a', '--ac2': '#a25618', '--dng': '#c0392b',
    },
  },
  {
    id: 'bloodmoon',
    name: 'Bloodmoon',
    vars: {
      '--bg': '#0a0404', '--sf': '#150808', '--sf2': '#1e0c0c', '--bd': '#381414',
      '--tx': '#e8d0cc', '--mt': '#906060', '--ac': '#d02030', '--ac2': '#8a0e18', '--dng': '#ff4848',
    },
  },
  {
    id: 'abyss',
    name: 'Abyss',
    vars: {
      '--bg': '#050c0e', '--sf': '#0a1518', '--sf2': '#0f2024', '--bd': '#183038',
      '--tx': '#d0e4e8', '--mt': '#6a8890', '--ac': '#3fb8b0', '--ac2': '#1e8078', '--dng': '#e85858',
    },
  },
  {
    id: 'wasteland',
    name: 'Wasteland',
    vars: {
      '--bg': '#0a0c06', '--sf': '#12160a', '--sf2': '#1a2010', '--bd': '#2a321c',
      '--tx': '#dce4c8', '--mt': '#808870', '--ac': '#a8cc30', '--ac2': '#708818', '--dng': '#d94030',
    },
  },
  {
    id: 'parchment',
    name: 'Parchment',
    vars: {
      '--bg': '#f0e8d4', '--sf': '#e4dac0', '--sf2': '#d8ccaa', '--bd': '#b8a67c',
      '--tx': '#2c2418', '--mt': '#6c5e44', '--ac': '#8a4a18', '--ac2': '#5c3010', '--dng': '#a02828',
    },
  },
  {
    id: 'void',
    name: 'Void',
    vars: {
      '--bg': '#000000', '--sf': '#040404', '--sf2': '#080808', '--bd': '#141414',
      '--tx': '#b8b8b8', '--mt': '#555555', '--ac': '#707070', '--ac2': '#4a4a4a', '--dng': '#8a2020',
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
  editorFontFamily: string
  editorFontSize: number
  ambientBg: boolean
  ambientBlur: number
}

export const DISPLAY_DEFAULTS: DisplayPrefs = {
  theme: 'gold',
  fontFamily: 'Crimson Pro',
  fontSize: 1.1,
  editorFontFamily: 'Crimson Pro',
  editorFontSize: 1.0,
  ambientBg: true,
  ambientBlur: 26,
}

export const AMBIENT_BLUR_MIN = 0
export const AMBIENT_BLUR_MAX = 60

export const FONT_SIZE_MIN = 0.8
export const FONT_SIZE_MAX = 2.0
export const FONT_SIZE_STEP = 0.1
