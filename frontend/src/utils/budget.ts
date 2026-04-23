import type { GameState, Chapter } from '../types'
import { renderChapterContent } from '../types'

// Rough heuristic: ~4 chars per token in English prose.
// This is intentionally imprecise — we just need a signal that scales monotonically.
const CHARS_PER_TOKEN = 4

const MAX_TOKENS_BY_STYLE: Record<string, number> = {
  '1 sentence': 150,
  '1 paragraph': 400,
  '2-3 paragraphs': 800,
  '3-4 detailed paragraphs': 1200,
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

// Roughly mirrors BuildPrompt on the backend: lore + overview + chapter summaries + active content.
// Plus headroom for the model's reply.
export function estimatePromptTokens(state: Pick<GameState, 'chapters' | 'lore' | 'overview' | 'secs' | 'style'>): number {
  let total = 0
  total += estimateTokens(state.overview || '')
  for (const l of state.lore) {
    if (l.enabled && l.text.trim()) total += estimateTokens(l.name + ': ' + l.text)
  }
  for (const s of state.secs) {
    if (s.content.trim()) total += estimateTokens(s.name + ': ' + s.content)
  }
  // Chapters: skip act-children (they're represented by their act's summary).
  const childOfAct = new Set<string>()
  for (const c of state.chapters) {
    if (c.status === 'act' && c.children) c.children.forEach(id => childOfAct.add(id))
  }
  for (const c of state.chapters) {
    if (childOfAct.has(c.id)) continue
    if (c.status === 'active') total += estimateTokens(renderChapterContent(c))
    else if (c.summary) total += estimateTokens(c.summary)
  }
  // System prompt overhead (constant ~300 tokens)
  total += 300
  // Response headroom
  total += MAX_TOKENS_BY_STYLE[state.style] || 400
  return total
}

export type BudgetLevel = 'ok' | 'warn' | 'block'

export function budgetLevel(used: number, max: number): BudgetLevel {
  if (max <= 0) return 'ok'
  const ratio = used / max
  if (ratio >= 0.9) return 'block'
  if (ratio >= 0.65) return 'warn'
  return 'ok'
}

export function estimateActiveWordChunk(chapter: Chapter | undefined): number {
  if (!chapter) return 0
  const text = renderChapterContent(chapter).trim()
  return text ? text.split(/\s+/).length : 0
}
