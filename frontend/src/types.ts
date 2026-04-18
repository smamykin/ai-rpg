export interface Summary {
  id: string
  text: string
  tier: 'recent' | 'ancient'
  charRange: [number, number]
  createdAt: number
}

export interface LoreEntry {
  id: string
  name: string
  text: string
  tag: string
  enabled: boolean
}

export const LORE_TAGS = ['world', 'character', 'rule', 'quest', 'other'] as const

export interface Section {
  id: string
  name: string
  description: string
  content: string
}

export interface GameState {
  story: string
  overview: string
  style: string
  cStyle: string
  storyModel: string
  supportModel: string
  arc: string
  diff: string
  summaries: Summary[]
  lore: LoreEntry[]
  sumUpTo: number
  autoSum: boolean
  autoAccept: boolean
  sumThreshold: number
  secs: Section[]
  auFreq: number
  format?: string

  // Legacy fields — present only in old saves before migration
  mems?: { id: string; text: string }[]
  addlMem?: string
}

export interface ModelInfo {
  id: string
  name: string
  ctx: number
  price: number | null
}

export type Phase = 'setup' | 'playing'
export type Task = 'open' | 'action' | 'continue'

export const STYLES = [
  { label: '1 paragraph', value: '1 paragraph' },
  { label: '2-3 paragraphs', value: '2-3 paragraphs' },
  { label: '1 sentence', value: '1 sentence' },
  { label: 'Detailed', value: '3-4 detailed paragraphs' },
] as const

export function defaultState(): GameState {
  return {
    story: '',
    overview: '',
    style: '1 paragraph',
    cStyle: '',
    storyModel: '',
    supportModel: '',
    arc: '',
    diff: 'normal',
    summaries: [],
    lore: [],
    sumUpTo: 0,
    autoSum: false,
    autoAccept: false,
    sumThreshold: 2500,
    secs: [],
    auFreq: 0,
  }
}

let _counter = 0
export function uid(): string {
  return 's' + (++_counter) + '_' + Date.now()
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}
