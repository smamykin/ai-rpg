import type { DiceSpec, RollVariant } from '../types'

export interface RolledDie {
  spec: DiceSpec
  total: number
  rolls: number[]
  invalid?: boolean
}

// diceExpr renders a DiceSpec as the canonical "NdM" notation used in roll
// text and the prompt's <task> block.
export function diceExpr(spec: DiceSpec): string {
  return `${spec.count}d${spec.sides}`
}

function specValid(spec: DiceSpec): boolean {
  return spec.count >= 1 && spec.count <= 100 && spec.sides >= 1 && spec.sides <= 1000
}

export function rollOne(count: number, sides: number): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(1 + Math.floor(Math.random() * sides))
  return out
}

export function rollSpec(spec: DiceSpec): RolledDie {
  if (!specValid(spec)) return { spec, total: 0, rolls: [], invalid: true }
  const rolls = rollOne(spec.count, spec.sides)
  return { spec, total: rolls.reduce((a, b) => a + b, 0), rolls }
}

export function rollVariant(v: RollVariant): RolledDie[] {
  return (v.dice || []).map(rollSpec)
}

// combineActionAndRoll joins the player's typed action with the formatted roll
// text for storage in a Turn. Mirrors backend game.CombineActionAndRoll so the
// optimistic UI matches what the backend ends up storing.
export function combineActionAndRoll(action: string, roll: string): string {
  const a = action.trim()
  const r = roll.trim()
  if (a && r) {
    const sep = /[.!?]$/.test(a) ? ' ' : '. '
    return a + sep + r
  }
  return a || r
}

// formatRolled renders "dice N(type NdM) resulted X" separated by ", ".
// startIndex controls the starting N so multiple rolls in one action turn
// number continuously (dice 1, dice 2, ...). When variantName is provided it
// is prefixed in brackets for context (e.g. "[Combat] dice 1(2d6) resulted 9").
export function formatRolled(rolled: RolledDie[], startIndex: number, variantName?: string): string {
  const body = rolled.map((r, i) => {
    const n = startIndex + i
    if (r.invalid) return `dice ${n}(invalid dice: ${diceExpr(r.spec)})`
    const type = r.spec.type ? `${r.spec.type} ` : ''
    return `dice ${n}(${type}${diceExpr(r.spec)}) resulted ${r.total}`
  }).join(', ')
  const name = (variantName || '').trim()
  return name ? `[${name}] ${body}` : body
}
