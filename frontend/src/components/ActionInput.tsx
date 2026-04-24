import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { X, Square, Play, SkipForward, RefreshCw, Trash2, Volume2, Target, Brain, ChevronDown } from 'lucide-react'
import type { RollVariant } from '../types'
import { rollVariant as rollVariantDice, formatRolled } from '../utils/dice'

interface Props {
  gen: boolean
  busy?: boolean // gen || summing — disables interactive controls without swapping Submit→Stop
  story: string
  rollVariants: RollVariant[]
  onSubmit: (action: string, hasRolls?: boolean) => void
  onContinue: () => void
  onRegen: () => void
  onDelete: () => void
  onStop: () => void
  showArc: boolean
  onToggleArc: () => void
  arc: string
  onArcChange: (arc: string) => void
  secsLength: number
  onShowTracking: () => void
  onSpeak: () => void
  canSpeak: boolean
  ttsBusy: boolean
  onStopTTS: () => void
  thinkingSupported: boolean
  thinkingOn: boolean
  onToggleThinking: () => void
}

export default function ActionInput({
  gen, busy, story, rollVariants, onSubmit, onContinue, onRegen, onDelete, onStop,
  showArc, onToggleArc, arc, onArcChange,
  secsLength, onShowTracking,
  onSpeak, canSpeak, ttsBusy, onStopTTS,
  thinkingSupported, thinkingOn, onToggleThinking,
}: Props) {
  const [action, setAction] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const hasRollsRef = useRef(false)
  const diceCountRef = useRef(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const blocked = busy ?? gen

  const resetRolls = () => {
    hasRollsRef.current = false
    diceCountRef.current = 0
  }

  const handleSubmit = useCallback(() => {
    if (!action.trim() || blocked) return
    const had = hasRollsRef.current
    onSubmit(action.trim(), had)
    setAction('')
    resetRolls()
  }, [action, blocked, onSubmit])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
    if (e.key === 'Tab' && !action.trim() && story && !blocked) { e.preventDefault(); onContinue() }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 110) + 'px'
  }

  const pickVariant = (v: RollVariant) => {
    const rolled = rollVariantDice(v)
    const text = formatRolled(rolled, diceCountRef.current + 1)
    diceCountRef.current += rolled.length
    hasRollsRef.current = true
    setAction(prev => {
      const trimmed = prev.trimEnd()
      if (!trimmed) return text
      const sep = /[.!?]$/.test(trimmed) ? ' ' : '. '
      return trimmed + sep + text
    })
    setMenuOpen(false)
    setQuery('')
  }

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    // Focus the search input when the menu opens
    const t = setTimeout(() => searchRef.current?.focus(), 0)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      clearTimeout(t)
    }
  }, [menuOpen])

  const filteredVariants = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rollVariants
    return rollVariants.filter(v => {
      if (v.name.toLowerCase().includes(q)) return true
      return v.dice.some(d =>
        d.dice.toLowerCase().includes(q) || (d.type || '').toLowerCase().includes(q),
      )
    })
  }, [rollVariants, query])

  const handleMenuKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); setMenuOpen(false); setQuery('') }
    if (e.key === 'Enter' && filteredVariants.length > 0) {
      e.preventDefault()
      pickVariant(filteredVariants[0])
    }
  }

  const canRoll = !blocked && rollVariants.length > 0
  const rollTitle = rollVariants.length === 0
    ? 'Define a roll variant in Story → Rolls first'
    : 'Roll a variant (appends to action)'

  const renderMainButton = () => {
    if (gen) return <button className="b bs" onClick={onStop} style={{ minHeight: 40 }} aria-label="Stop generation"><Square size={18} className="ic ic-danger" fill="currentColor" /></button>
    if (action.trim()) return <button className="b ba" onClick={handleSubmit} disabled={blocked} style={{ minHeight: 40 }} aria-label="Submit action"><Play size={18} className="ic" fill="currentColor" /></button>
    if (!story.trim()) return <button className="b ba" onClick={onContinue} disabled={blocked} style={{ minHeight: 40, padding: '0 .9rem' }}>Begin</button>
    return <button className="b" onClick={onContinue} disabled={blocked} style={{ minHeight: 40 }} aria-label="Continue"><SkipForward size={18} className="ic" fill="currentColor" /></button>
  }

  return (
    <>
      {showArc && (
        <div className="ab" style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <input
            type="text"
            value={arc}
            onChange={e => onArcChange(e.target.value)}
            placeholder="Guide story toward..."
            style={{ fontSize: '.82rem', padding: '.4rem .6rem', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 8 }}
          />
          <button
            className="b bs"
            onClick={() => onArcChange('')}
            disabled={!arc}
            title="Clear"
            style={{ padding: '.35rem .55rem' }}
            aria-label="Clear arc"
          ><X size={16} className="ic ic-muted" /></button>
        </div>
      )}
      <div className="ia">
        <div className="ir">
          <textarea
            className="ai"
            value={action}
            onChange={e => setAction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={!story.trim() ? 'Describe your first action, or press Begin' : story.length > 500 ? 'What do you do? (Tab = continue)' : 'What do you do next?'}
            disabled={blocked}
            rows={1}
            onInput={handleInput}
          />
          <div className="sb" ref={wrapRef}>
            {renderMainButton()}
            {!gen && (
              <button
                className="b"
                onClick={() => setMenuOpen(o => !o)}
                disabled={!canRoll}
                title={rollTitle}
                aria-label="Roll dice variant"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                style={{ minHeight: 40 }}
              ><ChevronDown size={16} className="ic" /></button>
            )}
            {menuOpen && (
              <div className="dd" role="menu">
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleMenuKey}
                  placeholder="Search variants..."
                  style={{ fontSize: '.82rem', padding: '.35rem .5rem', marginBottom: '.25rem' }}
                />
                {filteredVariants.length === 0 ? (
                  <div style={{ padding: '.4rem .55rem', fontSize: '.8rem', color: 'var(--mt)' }}>
                    No matches.
                  </div>
                ) : filteredVariants.map(v => (
                  <button
                    key={v.id}
                    className="dd-i"
                    onClick={() => pickVariant(v)}
                    role="menuitem"
                  >
                    <span>{v.name || '(unnamed)'}</span>
                    <span className="dd-i-sub">
                      {v.dice.map(d => `${d.type ? d.type + ' ' : ''}${d.dice}`).join(', ') || 'no dice'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="ct">
          <button className="b bs" onClick={onRegen} disabled={blocked || !story.trim()} title="Regenerate" aria-label="Regenerate"><RefreshCw size={16} className="ic" /></button>
          <button className="b bs" onClick={onDelete} disabled={blocked || !story.trim()} title="Delete last" aria-label="Delete last turn"><Trash2 size={16} className="ic ic-danger-hover" /></button>
          {ttsBusy ? (
            <button className="b bs" onClick={onStopTTS} title="Stop TTS" aria-label="Stop TTS"><Square size={16} className="ic ic-danger" fill="currentColor" /></button>
          ) : (
            <button className="b bs" onClick={onSpeak} disabled={!canSpeak} title="Read last narration" aria-label="Read last narration"><Volume2 size={16} className="ic" /></button>
          )}
          <button className={`b bs${showArc ? ' ba' : ''}`} onClick={onToggleArc} title="Arc guidance" aria-label="Toggle arc guidance" aria-pressed={showArc}><Target size={16} className="ic" /></button>
          {thinkingSupported && (
            <button
              className={`b bs${thinkingOn ? ' ba' : ''}`}
              onClick={onToggleThinking}
              disabled={blocked}
              title={thinkingOn ? 'Thinking on (click to disable)' : 'Thinking off (click to enable)'}
              aria-label="Toggle thinking"
              aria-pressed={thinkingOn}
            ><Brain size={16} className="ic" /></button>
          )}
          <div style={{ flex: 1 }} />
          {secsLength === 0 && story.length > 100 && (
            <button className="b bs" onClick={onShowTracking} style={{ color: 'var(--ac)' }}>Track</button>
          )}
        </div>
      </div>
    </>
  )
}
