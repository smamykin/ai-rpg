import { useState, useRef, useEffect } from 'react'
import type { Summary, LoreEntry, GameState } from '../../types'
import { uid, LORE_TAGS } from '../../types'

type Tab = 'summaries' | 'lore'

interface Props {
  show: boolean
  onClose: () => void
  summaries: Summary[]
  lore: LoreEntry[]
  autoSum: boolean
  autoAccept: boolean
  sumThreshold: number
  sumPreview: string | null
  wordCount: number
  canSummarize: boolean
  summarizeWordCount: number
  summing: boolean
  dispatch: React.Dispatch<any>
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
  onSummarize: () => void
  onConfirmSummary: (text: string) => void
  onDismissSummary: () => void
}

export default function MemoryPanel({
  show, onClose, summaries, lore, autoSum, autoAccept, sumThreshold, sumPreview,
  wordCount: wc, canSummarize, summarizeWordCount, summing,
  dispatch, setField, onSummarize, onConfirmSummary, onDismissSummary,
}: Props) {
  const [tab, setTab] = useState<Tab>('summaries')
  const [newLoreName, setNewLoreName] = useState('')
  const [newLoreText, setNewLoreText] = useState('')
  const [newLoreTag, setNewLoreTag] = useState('world')
  const [editPreview, setEditPreview] = useState('')

  // Sync preview text when a new preview appears
  const prevPreview = useRef<string | null>(null)
  useEffect(() => {
    if (sumPreview !== null && sumPreview !== prevPreview.current) {
      setEditPreview(sumPreview)
    }
    prevPreview.current = sumPreview
  }, [sumPreview])

  const ancients = summaries.filter(s => s.tier === 'ancient')
  const recents = summaries.filter(s => s.tier === 'recent')
  const enabledCount = lore.filter(l => l.enabled).length

  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>Memory</span>
          <button className="b bs" onClick={onClose}>&#x2715;</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '.3rem', marginBottom: '.6rem' }}>
          <button
            className="b bs"
            style={{ flex: 1, background: tab === 'summaries' ? 'var(--ac)' : undefined, color: tab === 'summaries' ? '#fff' : undefined }}
            onClick={() => setTab('summaries')}
          >
            Summaries ({summaries.length})
          </button>
          <button
            className="b bs"
            style={{ flex: 1, background: tab === 'lore' ? 'var(--ac)' : undefined, color: tab === 'lore' ? '#fff' : undefined }}
            onClick={() => setTab('lore')}
          >
            Lore ({enabledCount}/{lore.length})
          </button>
        </div>

        {tab === 'summaries' && (
          <>
            {/* Summary preview */}
            {sumPreview !== null && (
              <div style={{ border: '1px solid var(--ac)', borderRadius: '.4rem', padding: '.5rem', marginBottom: '.6rem', background: 'rgba(var(--ac-rgb, 100,149,237), 0.08)' }}>
                <label className="lb" style={{ color: 'var(--ac)' }}>Preview summary</label>
                <textarea
                  className="mt"
                  value={editPreview}
                  onChange={e => setEditPreview(e.target.value)}
                  rows={4}
                />
                <div style={{ display: 'flex', gap: '.3rem', marginTop: '.3rem' }}>
                  <button className="b bs" onClick={() => onConfirmSummary(editPreview.trim())} disabled={!editPreview.trim()}>Accept</button>
                  <button className="b bs" onClick={onDismissSummary}>Dismiss</button>
                </div>
              </div>
            )}

            {/* Ancient summaries */}
            {ancients.length > 0 && (
              <>
                <label className="lb" style={{ fontSize: '.7rem', color: 'var(--mt)' }}>Deep history ({ancients.length})</label>
                {ancients.map((s, i) => (
                  <div key={s.id} className="me">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.25rem' }}>
                      <span style={{ fontSize: '.7rem', color: 'var(--mt)' }}>Ancient {i + 1}</span>
                      <button className="b bs" onClick={() => dispatch({ type: 'REMOVE_SUMMARY', id: s.id })} style={{ padding: '.15rem .35rem', fontSize: '.68rem' }}>&#x2715;</button>
                    </div>
                    <textarea
                      className="mt"
                      value={s.text}
                      onChange={ev => dispatch({ type: 'UPDATE_SUMMARY', id: s.id, text: ev.target.value })}
                      rows={3}
                    />
                  </div>
                ))}
              </>
            )}

            {/* Recent summaries */}
            <label className="lb">Recent summaries ({recents.length})</label>
            {recents.length === 0 && <p style={{ color: 'var(--mt)', fontSize: '.82rem', marginBottom: '.5rem' }}>No entries yet.</p>}
            {recents.map((s, i) => (
              <div key={s.id} className="me">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.25rem' }}>
                  <span style={{ fontSize: '.7rem', color: 'var(--mt)' }}>Entry {i + 1}</span>
                  <button className="b bs" onClick={() => dispatch({ type: 'REMOVE_SUMMARY', id: s.id })} style={{ padding: '.15rem .35rem', fontSize: '.68rem' }}>&#x2715;</button>
                </div>
                <textarea
                  className="mt"
                  value={s.text}
                  onChange={ev => dispatch({ type: 'UPDATE_SUMMARY', id: s.id, text: ev.target.value })}
                  rows={3}
                />
              </div>
            ))}

            {/* Summarize controls */}
            <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '.6rem', marginBottom: '.75rem' }}>
              <label className="lb">Summarize</label>
              <div style={{ fontSize: '.82rem', color: 'var(--mt)' }}>{wc.toLocaleString()} words</div>
              {canSummarize ? (
                <button className="b bs" onClick={onSummarize} disabled={summing} style={{ marginTop: '.4rem' }}>
                  {summing ? '\u23f3...' : `Summarize ${summarizeWordCount.toLocaleString()}w`}
                </button>
              ) : (
                <p style={{ fontSize: '.75rem', color: 'var(--mt)', marginTop: '.3rem' }}>Needs more text.</p>
              )}
            </div>

            {/* Auto-summarization settings */}
            <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '.6rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.82rem', cursor: 'pointer', marginBottom: '.4rem' }}>
                <input type="checkbox" checked={autoSum} onChange={e => setField('autoSum', e.target.checked)} />
                Auto-summarize
              </label>
              {autoSum && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.82rem', cursor: 'pointer', marginBottom: '.4rem' }}>
                    <input type="checkbox" checked={autoAccept} onChange={e => setField('autoAccept', e.target.checked)} />
                    Auto-accept (skip preview)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.82rem' }}>
                    <span>Threshold:</span>
                    <input
                      type="range" min={1000} max={8000} step={500}
                      value={sumThreshold || 2500}
                      onChange={e => setField('sumThreshold', Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: '.75rem', color: 'var(--mt)', minWidth: '3.5rem' }}>~{Math.round((sumThreshold || 2500) / 5)}w</span>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {tab === 'lore' && (
          <>
            {/* Lore entries */}
            {lore.length === 0 && <p style={{ color: 'var(--mt)', fontSize: '.82rem', marginBottom: '.5rem' }}>No lore entries yet.</p>}
            {lore.map(l => (
              <div key={l.id} className="me" style={{ opacity: l.enabled ? 1 : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                    <input
                      type="checkbox" checked={l.enabled}
                      onChange={() => dispatch({ type: 'TOGGLE_LORE', id: l.id })}
                      title={l.enabled ? 'Included in prompt' : 'Excluded from prompt'}
                    />
                    <input
                      value={l.name}
                      onChange={e => dispatch({ type: 'UPDATE_LORE', id: l.id, updates: { name: e.target.value } })}
                      style={{ background: 'transparent', border: 'none', color: 'var(--tx)', fontSize: '.82rem', fontWeight: 600, width: '8rem', padding: 0 }}
                    />
                    <select
                      value={l.tag}
                      onChange={e => dispatch({ type: 'UPDATE_LORE', id: l.id, updates: { tag: e.target.value } })}
                      style={{ fontSize: '.65rem', background: 'var(--sf)', color: 'var(--mt)', border: '1px solid var(--bd)', borderRadius: '.2rem', padding: '.1rem .2rem' }}
                    >
                      {LORE_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <button className="b bs" onClick={() => dispatch({ type: 'REMOVE_LORE', id: l.id })} style={{ padding: '.15rem .35rem', fontSize: '.68rem' }}>&#x2715;</button>
                </div>
                <textarea
                  className="mt"
                  value={l.text}
                  onChange={e => dispatch({ type: 'UPDATE_LORE', id: l.id, updates: { text: e.target.value } })}
                  rows={3}
                />
              </div>
            ))}

            {/* Add new lore entry */}
            <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '.6rem' }}>
              <label className="lb">Add lore entry</label>
              <div style={{ display: 'flex', gap: '.3rem', marginBottom: '.3rem' }}>
                <input
                  value={newLoreName}
                  onChange={e => setNewLoreName(e.target.value)}
                  placeholder="Name..."
                  style={{ flex: 1, fontSize: '.82rem' }}
                />
                <select
                  value={newLoreTag}
                  onChange={e => setNewLoreTag(e.target.value)}
                  style={{ fontSize: '.75rem', background: 'var(--sf)', color: 'var(--mt)', border: '1px solid var(--bd)', borderRadius: '.3rem', padding: '.2rem' }}
                >
                  {LORE_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <textarea className="mt" value={newLoreText} onChange={e => setNewLoreText(e.target.value)} placeholder="Lore content..." rows={2} style={{ marginBottom: '.3rem' }} />
              <button className="b bs" onClick={() => {
                if (newLoreName.trim() && newLoreText.trim()) {
                  dispatch({
                    type: 'ADD_LORE',
                    entry: { id: uid(), name: newLoreName.trim(), text: newLoreText.trim(), tag: newLoreTag, enabled: true },
                  })
                  setNewLoreName('')
                  setNewLoreText('')
                }
              }} disabled={!newLoreName.trim() || !newLoreText.trim()}>+ Add</button>
            </div>

            <div style={{ fontSize: '.7rem', color: 'var(--mt)', marginTop: '.5rem' }}>
              Enabled entries are included in every prompt.
            </div>
          </>
        )}
      </div>
    </>
  )
}
