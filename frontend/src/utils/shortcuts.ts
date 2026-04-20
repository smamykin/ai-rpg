// Silent expansions for common action shortcuts.
// Rules: the shortcut letter must be the first token (case-insensitive),
// followed by either end-of-string or whitespace + the remainder.
// If nothing matches, the input is returned unchanged.
//
//   l                   -> I look around
//   l at menu           -> I look at menu
//   l the door          -> I look at the door
//   x the door          -> I examine the door
//   s what should I do? -> I ask: "What should I do?"
//   s I glad to see you -> I say: "I glad to see you"
//   i                   -> I check my inventory
//   g north             -> I go north

const LOOK_PREPOSITIONS = ['at', 'around', 'into', 'in', 'under', 'behind', 'through', 'up', 'down', 'over', 'toward', 'towards']

function startsWithPrep(s: string): boolean {
  const low = s.toLowerCase()
  return LOOK_PREPOSITIONS.some(p => low === p || low.startsWith(p + ' '))
}

function capFirst(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export function expandShortcut(raw: string): string {
  const t = raw.trim()
  if (!t) return raw
  const m = t.match(/^([A-Za-z])(?:\s+(.+))?$/s)
  if (!m) return raw
  const letter = m[1].toLowerCase()
  const rest = (m[2] || '').trim()

  switch (letter) {
    case 'l':
      if (!rest) return 'I look around'
      return startsWithPrep(rest) ? `I look ${rest}` : `I look at ${rest}`
    case 'x':
      if (!rest) return raw
      return `I examine ${rest}`
    case 'i':
      if (rest) return raw
      return 'I check my inventory'
    case 'g':
      if (!rest) return raw
      return `I go ${rest}`
    case 's': {
      if (!rest) return raw
      const text = capFirst(rest)
      const verb = text.trimEnd().endsWith('?') ? 'ask' : 'say'
      return `I ${verb}: "${text}"`
    }
    default:
      return raw
  }
}
