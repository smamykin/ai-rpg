import { useState, useEffect, useMemo, useCallback } from 'react'
import type { PromptPreview, Task } from '../../types'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'
import { budgetLevel } from '../../utils/budget'
import * as api from '../../api'

interface Props {
  show: boolean
  onClose: () => void
  onSwitch?: (panel: PanelId) => void
  sessionId: string
  hasActiveContent: boolean
}

const SEG_COLORS = [
  'var(--ac)',
  'var(--ac2, var(--ac))',
  '#e0a040',
  '#b06ce0',
  '#40b0a0',
  '#e06060',
  '#70a0e0',
]

export default function PromptPanel({ show, onClose, onSwitch, sessionId, hasActiveContent }: Props) {
  const [task, setTask] = useState<Task>(hasActiveContent ? 'continue' : 'open')
  const [action, setAction] = useState('')
  const [preview, setPreview] = useState<PromptPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [showSystem, setShowSystem] = useState(false)

  const refresh = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setErr('')
    try {
      const p = await api.previewPrompt(task, task === 'action' ? action : '')
      setPreview(p)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    }
    setLoading(false)
  }, [sessionId, task, action])

  // Initial fetch on open; re-fetch when task changes or panel is re-opened.
  useEffect(() => {
    if (!show) return
    refresh()
  }, [show, task, refresh])

  // Debounced refresh when action text changes (task=action only).
  useEffect(() => {
    if (!show || task !== 'action') return
    const t = setTimeout(refresh, 400)
    return () => clearTimeout(t)
  }, [action, task, show, refresh])

  const segments = preview?.sections || []
  const userTokens = useMemo(() => segments.reduce((a, s) => a + s.tokens, 0), [segments])

  const level = preview ? budgetLevel(preview.total, preview.budget) : 'ok'
  const levelColor = level === 'block' ? 'var(--dng)' : level === 'warn' ? '#e0a040' : 'var(--ac)'
  const pct = preview && preview.budget > 0 ? Math.round((preview.total / preview.budget) * 100) : 0

  const scrollToSection = (label: string) => {
    const el = document.getElementById('pv-sec-' + label.replace(/\s+/g, '-'))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>Prompt preview</span>
          <button className="b bs" onClick={onClose}>&#x2715;</button>
        </div>
        {onSwitch && <PanelTabs active="prompt" onSwitch={onSwitch} />}

        <div className="gr">
          <label className="lb">Task</label>
          <div style={{ display: 'flex', gap: '.3rem' }}>
            {(['open', 'continue', 'action'] as Task[]).map(t => (
              <button
                key={t}
                className={`b bs${task === t ? ' ba' : ''}`}
                onClick={() => setTask(t)}
                style={{ flex: 1 }}
              >{t}</button>
            ))}
          </div>
        </div>

        {task === 'action' && (
          <div className="gr">
            <label className="lb">Action text</label>
            <textarea
              value={action}
              onChange={e => setAction(e.target.value)}
              placeholder="e.g. open the door"
              rows={2}
              style={{ fontSize: '.85rem' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '.3rem', marginBottom: '.6rem' }}>
          <button className="b bs" onClick={refresh} disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {err && <div className="hint" style={{ color: 'var(--dng)' }}>{err}</div>}

        {preview && (
          <>
            <div className="gr">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.3rem' }}>
                <span className="lb" style={{ margin: 0 }}>Total</span>
                <span style={{ fontSize: '.85rem', color: levelColor, fontWeight: 600 }}>
                  {preview.total.toLocaleString()} / {preview.budget.toLocaleString()} tok &nbsp;({pct}%)
                </span>
              </div>
              <div className="pvb">
                {preview.system.tokens > 0 && (
                  <div
                    className="pvb-seg"
                    style={{ flex: preview.system.tokens, background: 'var(--mt)' }}
                    title={`System: ${preview.system.tokens} tok`}
                  />
                )}
                {segments.map((s, i) => (
                  <div
                    key={s.label}
                    className="pvb-seg"
                    style={{ flex: s.tokens, background: SEG_COLORS[i % SEG_COLORS.length] }}
                    title={`${s.label}: ${s.tokens} tok`}
                    onClick={() => scrollToSection(s.label)}
                  />
                ))}
                {preview.response > 0 && (
                  <div
                    className="pvb-seg"
                    style={{ flex: preview.response, background: 'var(--bd)' }}
                    title={`Response headroom: ${preview.response} tok`}
                  />
                )}
              </div>
              <div className="pvl">
                <div className="pvl-r">
                  <span className="pvl-sw" style={{ background: 'var(--mt)' }} />
                  <span className="pvl-l">System</span>
                  <span className="pvl-t">{preview.system.tokens}</span>
                </div>
                {segments.map((s, i) => (
                  <div key={s.label} className="pvl-r" onClick={() => scrollToSection(s.label)} style={{ cursor: 'pointer' }}>
                    <span className="pvl-sw" style={{ background: SEG_COLORS[i % SEG_COLORS.length] }} />
                    <span className="pvl-l">{s.label}</span>
                    <span className="pvl-t">{s.tokens}</span>
                  </div>
                ))}
                <div className="pvl-r">
                  <span className="pvl-sw" style={{ background: 'var(--bd)' }} />
                  <span className="pvl-l">Response (reserved)</span>
                  <span className="pvl-t">{preview.response}</span>
                </div>
              </div>
              <div className="hint" style={{ marginTop: '.3rem' }}>
                User prompt: {userTokens.toLocaleString()} tok over {segments.length} sections.
                Tokens estimated as chars/4.
              </div>
            </div>

            <div className="gr">
              <button
                className="b bs"
                onClick={() => setShowSystem(s => !s)}
                style={{ width: '100%', justifyContent: 'space-between' }}
              >
                <span>{showSystem ? '\u25bc' : '\u25b6'} System prompt</span>
                <span style={{ color: 'var(--mt)' }}>{preview.system.tokens} tok</span>
              </button>
              {showSystem && <pre className="pvt">{preview.system.text}</pre>}
            </div>

            <div className="gr">
              <label className="lb">User prompt</label>
              {segments.length === 0 ? (
                <div className="hint">(empty)</div>
              ) : segments.map((s, i) => (
                <div key={s.label} id={'pv-sec-' + s.label.replace(/\s+/g, '-')} style={{ marginBottom: '.5rem' }}>
                  <div className="pvs-h">
                    <span className="pvl-sw" style={{ background: SEG_COLORS[i % SEG_COLORS.length] }} />
                    <span className="pvs-l">{s.label}</span>
                    <span className="pvs-t">{s.tokens} tok</span>
                  </div>
                  <pre className="pvt">{s.text}</pre>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
