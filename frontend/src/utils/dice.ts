import type { DiceSpec, RollVariant } from '../types'

export interface RolledDie {
  spec: DiceSpec
  total: number
  rolls: number[]
  invalid?: boolean
}

const DICE_RE = /^(\d+)d(\d+)$/

export function parseDice(expr: string): { count: number; sides: number } | null {
  const m = DICE_RE.exec((expr || '').trim())
  if (!m) return null
  const count = parseInt(m[1], 10)
  const sides = parseInt(m[2], 10)
  if (!count || !sides || count > 100 || sides > 1000) return null
  return { count, sides }
}

export function rollOne(count: number, sides: number): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(1 + Math.floor(Math.random() * sides))
  return out
}

export function rollSpec(spec: DiceSpec): RolledDie {
  const parsed = parseDice(spec.dice)
  if (!parsed) return { spec, total: 0, rolls: [], invalid: true }
  const rolls = rollOne(parsed.count, parsed.sides)
  return { spec, total: rolls.reduce((a, b) => a + b, 0), rolls }
}

export function rollVariant(v: RollVariant): RolledDie[] {
  return (v.dice || []).map(rollSpec)
}

// formatRolled renders "dice N(type NdM) resulted X" separated by ", ".
// startIndex controls the starting N so multiple rolls in one action turn
// number continuously (dice 1, dice 2, ...).
export function formatRolled(rolled: RolledDie[], startIndex: number): string {
  return rolled.map((r, i) => {
    const n = startIndex + i
    if (r.invalid) return `dice ${n}(invalid dice: ${r.spec.dice})`
    const type = r.spec.type ? `${r.spec.type} ` : ''
    return `dice ${n}(${type}${r.spec.dice}) resulted ${r.total}`
  }).join(', ')
}
