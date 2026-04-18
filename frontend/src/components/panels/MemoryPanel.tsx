import { useState, useRef, useEffect } from 'react'
import type { Summary, LoreEntry, GameState, GalleryImage } from '../../types'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'
import LoreEditor from '../LoreEditor'

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
  galleryImages?: GalleryImage[]
  onGenerateImage?: (loreId: string) => void
  story?: string
  overview?: string
  onSwitch?: (panel: PanelId) => void
}

export default function MemoryPanel({
  show, onClose, summaries, lore, autoSum, autoAccept, sumThreshold, sumPreview,
  wordCount: wc, canSummarize, summarizeWordCount, summing,
  dispatch, setField, onSummarize, onConfirmSummary, onDismissSummary,
  galleryImages = [], onGenerateImage,
  story = '', overview = '',
  onSwitch,
}: Props) {
  const [tab, setTab] = useState<Tab>('summaries')
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
        {onSwitch && <PanelTabs active="mem" onSwitch={onSwitch} />}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '.3rem', marginBottom: '.6rem' }}>
          <button
            className="b bs"
            style={{ flex: 1, background: tab === 'summaries' ? 'var(--ac)' : undefined, color: tab === 'summaries' ? '#fff' : undefined }}
            onClick={() => { setTab('summaries') }}
          >
            Summaries ({summaries.length})
          </button>
          <button
            className="b bs"
            style={{ flex: 1, background: tab === 'lore' ? 'var(--ac)' : undefined, color: tab === 'lore' ? '#fff' : undefined }}
            onClick={() => { setTab('lore') }}
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
          <LoreEditor
            lore={lore}
            onChange={next => dispatch({ type: 'SET_LORE', lore: next })}
            galleryImages={galleryImages}
            onGenerateImage={onGenerateImage}
            aiContext={{ story, overview, summaries }}
          />
        )}
      </div>
    </>
  )
}
