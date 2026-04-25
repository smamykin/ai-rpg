import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Square, Play, SkipForward, RefreshCw, Trash2, Volume2, Target, Brain, ChevronDown } from 'lucide-react'
import type { RollVariant } from '../types'
import { rollVariant as rollVariantDice, formatRolled, diceExpr } from '../utils/dice'

interface Props {
  gen: boolean
  busy?: boolean // gen || summing — disables interactive controls without swapping Submit→Stop
  story: string
  rollVariants: RollVariant[]
  onSubmit: (action: string, roll?: string) => void
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
  onGenerateImage: () => void
  onSpeak: () => void
  canSpeak: boolean
  ttsBusy: boolean
  onStopTTS: () => void
  thinkingSupported: boolean
  thinkingOn: boolean
  thinkingForced: boolean
  onToggleThinking: () => void
}

export default function ActionInput({
  gen, busy, story, rollVariants, onSubmit, onContinue, onRegen, onDelete, onStop,
  showArc, onToggleArc, arc, onArcChange,
  secsLength, onShowTracking, onGenerateImage,
  onSpeak, canSpeak, ttsBusy, onStopTTS,
  thinkingSupported, thinkingOn, thinkingForced, onToggleThinking,
}: Props) {
  const [action, setAction] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const blocked = busy ?? gen

  const handleSubmit = useCallback(() => {
    if (!action.trim() || blocked) return
    onSubmit(action.trim())
    setAction('')
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

  // Picking a variant rolls the dice and submits immediately. The roll text
  // (always carrying the variant name as a [bracket] label) is sent separately
  // from the typed action so the prompt builder can format them on distinct
  // lines. The textarea clears so shortcut state stays consistent.
  const pickVariant = (v: RollVariant) => {
    if (blocked) return
    const rolled = rollVariantDice(v)
    const rollText = formatRolled(rolled, 1, v.name)
    const typed = action.trim()
    setMenuOpen(false)
    setAction('')
    onSubmit(typed, rollText)
  }

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  const canRoll = !blocked && rollVariants.length > 0
  const rollTitle =
    rollVariants.length === 0 ? 'Define a roll variant in Story → Rolls first'
    : rollVariants.length === 1 ? `Roll ${rollVariants[0].name || 'variant'} (submits immediately)`
    : 'Roll a variant (submits immediately)'

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
          {renderMainButton()}
        </div>
        <div className="ct">
          {!gen && (
            <div ref={wrapRef} style={{ position: 'relative' }}>
              <button
                className="b bs"
                onClick={() => {
                  if (rollVariants.length === 1) pickVariant(rollVariants[0])
                  else setMenuOpen(o => !o)
                }}
                disabled={!canRoll}
                title={rollTitle}
                aria-haspopup={rollVariants.length > 1 ? 'menu' : undefined}
                aria-expanded={rollVariants.length > 1 ? menuOpen : undefined}
                aria-label="Roll dice"
              >
                Roll
                {rollVariants.length > 1 && <ChevronDown size={14} className="ic" />}
              </button>
              {menuOpen && rollVariants.length > 1 && (
                <div className="dd" style={{ left: 0, right: 'auto' }} role="menu">
                  {rollVariants.map(v => (
                    <button
                      key={v.id}
                      className="dd-i"
                      onClick={() => pickVariant(v)}
                      role="menuitem"
                    >
                      <span>{v.name || '(unnamed)'}</span>
                      <span className="dd-i-sub">
                        {v.dice.map(d => `${d.type ? d.type + ' ' : ''}${diceExpr(d)}`).join(', ') || 'no dice'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
              onClick={thinkingForced ? undefined : onToggleThinking}
              disabled={blocked && !thinkingForced}
              title={
                thinkingForced
                  ? 'Model reasons by default — can’t be turned off'
                  : thinkingOn
                    ? 'Thinking on (click to disable)'
                    : 'Thinking off (click to enable)'
              }
              aria-label="Toggle thinking"
              aria-pressed={thinkingOn}
              aria-disabled={thinkingForced || undefined}
              style={thinkingForced ? { cursor: 'default' } : undefined}
            ><Brain size={16} className="ic" /></button>
          )}
          <div style={{ flex: 1 }} />
          {story.length > 100 && (
            <button className="b bs" onClick={onGenerateImage} style={{ color: 'var(--ac)' }}>Image</button>
          )}
          {secsLength === 0 && story.length > 100 && (
            <button className="b bs" onClick={onShowTracking} style={{ color: 'var(--ac)' }}>Track</button>
          )}
        </div>
      </div>
    </>
  )
}
