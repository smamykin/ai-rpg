import { useState, useCallback } from 'react'
import { X, Square, Play, SkipForward, RefreshCw, Trash2, Volume2, Target, Brain } from 'lucide-react'

interface Props {
  gen: boolean
  busy?: boolean // gen || summing — disables interactive controls without swapping Submit→Stop
  story: string
  onSubmit: (action: string) => void
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
  gen, busy, story, onSubmit, onContinue, onRegen, onDelete, onStop,
  showArc, onToggleArc, arc, onArcChange,
  secsLength, onShowTracking,
  onSpeak, canSpeak, ttsBusy, onStopTTS,
  thinkingSupported, thinkingOn, onToggleThinking,
}: Props) {
  const [action, setAction] = useState('')
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
          ><X size={16} className="ic" /></button>
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
          {gen ? (
            <button className="b bs" onClick={onStop} style={{ minHeight: 40 }} aria-label="Stop generation"><Square size={18} className="ic ic-danger" fill="currentColor" /></button>
          ) : action.trim() ? (
            <button className="b ba" onClick={handleSubmit} disabled={blocked} style={{ minHeight: 40 }} aria-label="Submit action"><Play size={18} className="ic" fill="currentColor" /></button>
          ) : !story.trim() ? (
            <button className="b ba" onClick={onContinue} disabled={blocked} style={{ minHeight: 40, padding: '0 .9rem' }}>Begin</button>
          ) : (
            <button className="b" onClick={onContinue} disabled={blocked} style={{ minHeight: 40 }} aria-label="Continue"><SkipForward size={18} className="ic" fill="currentColor" /></button>
          )}
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
