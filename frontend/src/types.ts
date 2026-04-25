export interface Turn {
  id: string
  action?: string
  response: string
  createdAt?: number
}

export interface Chapter {
  id: string
  title: string
  turns: Turn[]                      // empty for acts
  summary: string                    // empty while active
  status: 'active' | 'closed' | 'act'
  children?: string[]                // chapter IDs — only on acts
  summaryStale?: boolean
  createdAt: number
}

export interface LoreEntry {
  id: string
  name: string
  text: string
  tag: string
  enabled: boolean
}

export const LORE_TAGS = ['world', 'location', 'faction', 'character', 'mechanic', 'quest', 'item', 'creature', 'other'] as const

export function normalizeLoreTag(tag: string): string {
  if (tag === 'rule') return 'mechanic'
  return tag
}

export interface Section {
  id: string
  name: string
  description: string
  content: string
}

export interface Note {
  id: string
  body: string
  createdAt: number
  updatedAt: number
}

export interface DiceSpec {
  dice: string
  type: string
}

export interface RollVariant {
  id: string
  name: string
  dice: DiceSpec[]
}

export interface TTSModelSettings {
  voice?: string
  speed?: number
  instructions?: string
  dialogueVoice?: string
}

export interface TTSSettings {
  autoPlay: boolean
  activeModel?: string
  perModel?: Record<string, TTSModelSettings>
}

// Per-task max_token caps. Undefined = use built-in default; 0 = no cap.
// thinkingBonus is added on top of any base cap when reasoning effort is on.
export interface TokenCaps {
  storyShort?: number
  storyMedium?: number
  storyLong?: number
  storyDetailed?: number
  lore?: number
  summarize?: number
  updateStats?: number
  transform?: number
  imagePrompt?: number
  naming?: number
  thinkingBonus?: number
}

export const TOKEN_CAP_DEFAULTS: Required<TokenCaps> = {
  storyShort: 150,
  storyMedium: 400,
  storyLong: 800,
  storyDetailed: 1200,
  lore: 1200,
  summarize: 1000,
  updateStats: 1000,
  transform: 2000,
  imagePrompt: 500,
  naming: 30,
  thinkingBonus: 20000,
}

export interface TokenCapField {
  key: keyof TokenCaps
  label: string
  hint?: string
}

export const TOKEN_CAP_GROUPS: { name: string; fields: TokenCapField[] }[] = [
  {
    name: 'Story',
    fields: [
      { key: 'storyShort',    label: '1 sentence' },
      { key: 'storyMedium',   label: '1 paragraph' },
      { key: 'storyLong',     label: '2-3 paragraphs' },
      { key: 'storyDetailed', label: '3-4 detailed paragraphs' },
    ],
  },
  {
    name: 'Support tasks',
    fields: [
      { key: 'lore',        label: 'Lore' },
      { key: 'summarize',   label: 'Summary' },
      { key: 'updateStats', label: 'Tracking update' },
      { key: 'transform',   label: 'Selection transform' },
      { key: 'imagePrompt', label: 'Image prompt' },
      { key: 'naming',      label: 'Naming' },
    ],
  },
  {
    name: 'Reasoning',
    fields: [
      { key: 'thinkingBonus', label: 'Thinking bonus', hint: 'Added on top of the base cap when reasoning effort is on. Reasoning tokens count toward the API output budget.' },
    ],
  },
]

export interface GameState {
  sessionId: string
  name: string
  createdAt: number
  lastPlayedAt: number
  modelRoles: Record<string, string>

  overview: string
  style: string
  cStyle: string
  imgStyle?: string
  storyModel: string
  supportModel: string
  reasoningEffort?: string
  arc: string
  diff: string
  lore: LoreEntry[]
  secs: Section[]
  notes: Note[]
  rollVariants: RollVariant[]
  diceRulesLoreId?: string
  auFreq: number
  tts: TTSSettings

  // Chapters
  chapters: Chapter[]
  activeChapterId: string
  viewingChapterId: string
  archivedChapters: Chapter[]

  // Context budget
  effectiveCtxTokens: number

  tokenCaps?: TokenCaps

  format?: string
}

export interface SessionMeta {
  id: string
  name: string
  createdAt: number
  lastPlayedAt: number
  overviewHead?: string
  storyChars: number
}

export interface Scenario {
  id: string
  name: string
  description: string
  overview: string
  cStyle: string
  style: string
  diff: string
  lore: LoreEntry[]
  secs: Section[]
  rollVariants: RollVariant[]
  diceRulesLoreId?: string
  createdAt: number
  updatedAt: number
}

export function defaultScenario(): Scenario {
  return {
    id: '',
    name: '',
    description: '',
    overview: '',
    cStyle: '',
    style: '1 paragraph',
    diff: 'normal',
    lore: [],
    secs: [],
    rollVariants: [],
    diceRulesLoreId: '',
    createdAt: 0,
    updatedAt: 0,
  }
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function validateScenario(obj: unknown): Scenario | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  const name = asString(o.name).trim()
  const overview = asString(o.overview).trim()
  if (!name && !overview) return null

  const lore = Array.isArray(o.lore)
    ? (o.lore as unknown[]).filter(e => e && typeof e === 'object').map(e => {
      const l = e as Record<string, unknown>
      return {
        id: asString(l.id) || uid('l'),
        name: asString(l.name),
        text: asString(l.text),
        tag: normalizeLoreTag(asString(l.tag)) || 'other',
        enabled: l.enabled !== false,
      }
    })
    : []

  const secs = Array.isArray(o.secs)
    ? (o.secs as unknown[]).filter(e => e && typeof e === 'object').map(e => {
      const s = e as Record<string, unknown>
      return {
        id: asString(s.id) || uid('s'),
        name: asString(s.name),
        description: asString(s.description),
        content: asString(s.content),
      }
    })
    : []

  const rollVariants = Array.isArray(o.rollVariants)
    ? (o.rollVariants as unknown[]).filter(e => e && typeof e === 'object').map(e => {
      const v = e as Record<string, unknown>
      const dice = Array.isArray(v.dice)
        ? (v.dice as unknown[]).filter(d => d && typeof d === 'object').map(d => {
          const ds = d as Record<string, unknown>
          return { dice: asString(ds.dice), type: asString(ds.type) }
        })
        : []
      return {
        id: asString(v.id) || uid('rv'),
        name: asString(v.name),
        dice,
      }
    })
    : []

  const loreIds = new Set(lore.map(l => l.id))
  const diceRulesLoreIdRaw = asString(o.diceRulesLoreId)
  const diceRulesLoreId = loreIds.has(diceRulesLoreIdRaw) ? diceRulesLoreIdRaw : ''

  return {
    id: '',
    name: asString(o.name),
    description: asString(o.description),
    overview: asString(o.overview),
    cStyle: asString(o.cStyle),
    style: asString(o.style) || '1 paragraph',
    diff: asString(o.diff) || 'normal',
    lore,
    secs,
    rollVariants,
    diceRulesLoreId,
    createdAt: 0,
    updatedAt: 0,
  }
}

export const MODEL_ROLES = ['summary', 'imagePrompt', 'loreGen', 'scenarioPolish', 'naming'] as const
export type ModelRole = typeof MODEL_ROLES[number]

export const REASONING_EFFORTS = ['none', 'low', 'medium', 'high', 'xhigh'] as const
export type ReasoningEffort = typeof REASONING_EFFORTS[number]

// Mirrors backend nanogpt.DetectsThinking — keep the patterns in sync.
export function detectThinkingModel(id: string): boolean {
  return /(gpt-5|o1-|o3-|o4-|:thinking|-thinking|deepseek-r1|qwen3-thinking|grok-4-reasoning)/i.test(id || '')
}

export interface ModelInfo {
  id: string
  name: string
  ctx: number
  price: number | null
  supportsThinking: boolean
}

export interface ImageModelInfo {
  id: string
  name: string
}

export interface GalleryImage {
  id: string
  url: string
  prompt: string
  model: string
  width: number
  height: number
  createdAt: number
  source: 'story' | 'lore'
  loreEntryId?: string
  turnId?: string
  chapterId?: string
  sessionId?: string | null
}

export const DIMENSION_PRESETS = [
  { label: '1:1', w: 1024, h: 1024 },
  { label: '4:3', w: 1024, h: 768 },
  { label: '3:4', w: 768, h: 1024 },
  { label: '16:9', w: 1216, h: 832 },
  { label: '9:16', w: 832, h: 1216 },
] as const

export type Phase = 'hub' | 'setup' | 'playing' | 'scenarioEditor'
export type Task = 'open' | 'action' | 'continue'

export interface PromptSection {
  label: string
  text: string
  tokens: number
}

export interface PromptPreview {
  system: PromptSection
  sections: PromptSection[]
  user: string
  response: number
  total: number
  budget: number
}

export const STYLES = [
  { label: '1 paragraph', value: '1 paragraph' },
  { label: '2-3 paragraphs', value: '2-3 paragraphs' },
  { label: '1 sentence', value: '1 sentence' },
  { label: 'Detailed', value: '3-4 detailed paragraphs' },
] as const

let _counter = 0
export function uid(prefix = 's'): string {
  return prefix + (++_counter) + '_' + Date.now()
}

export function newChapterId(): string {
  return 'ch_' + Date.now() + '_' + (++_counter)
}

export function newTurnId(): string {
  return 't_' + Date.now() + '_' + (++_counter)
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

// Join a chapter's turns into the classic `> action\n\nresponse\n\n...` text form
// used by prompt building, summarization, export, and the token budget display.
export function renderChapterContent(ch: Pick<Chapter, 'turns'>): string {
  if (!ch.turns || ch.turns.length === 0) return ''
  return ch.turns.map(t => {
    if (t.action) {
      return t.response ? '> ' + t.action + '\n\n' + t.response : '> ' + t.action
    }
    return t.response
  }).join('\n\n')
}

export function defaultState(): GameState {
  const chapterId = newChapterId()
  const now = 0
  return {
    sessionId: '',
    name: 'Adventure',
    createdAt: 0,
    lastPlayedAt: 0,
    modelRoles: {},
    overview: '',
    style: '1 paragraph',
    cStyle: '',
    imgStyle: '',
    storyModel: '',
    supportModel: '',
    arc: '',
    diff: 'normal',
    lore: [],
    secs: [],
    notes: [],
    rollVariants: [],
    diceRulesLoreId: '',
    auFreq: 0,
    tts: { autoPlay: false, activeModel: 'Kokoro-82m', perModel: {} },
    chapters: [{
      id: chapterId,
      title: '',
      turns: [],
      summary: '',
      status: 'active',
      createdAt: now,
    }],
    activeChapterId: chapterId,
    viewingChapterId: chapterId,
    archivedChapters: [],
    effectiveCtxTokens: 32000,
    format: 'ai-rpg-nano-v6',
  }
}

// Helpers
export function findChapter(state: Pick<GameState, 'chapters'>, id: string): Chapter | undefined {
  return state.chapters.find(c => c.id === id)
}

export function getActiveChapter(state: Pick<GameState, 'chapters' | 'activeChapterId'>): Chapter | undefined {
  return findChapter(state, state.activeChapterId)
}

export function getViewingChapter(state: Pick<GameState, 'chapters' | 'viewingChapterId' | 'activeChapterId'>): Chapter | undefined {
  return findChapter(state, state.viewingChapterId) || findChapter(state, state.activeChapterId)
}
