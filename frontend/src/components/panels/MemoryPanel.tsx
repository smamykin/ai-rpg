import { useState, useRef, useEffect } from 'react'
import type { Summary, LoreEntry, GameState, GalleryImage } from '../../types'
import { uid, LORE_TAGS } from '../../types'
import Lightbox from '../Lightbox'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'
import * as api from '../../api'

type Tab = 'summaries' | 'lore'

const TAG_COLORS: Record<string, string> = {
  world: 'var(--ac)',
  character: 'var(--ac2)',
  rule: 'var(--mt)',
  quest: 'var(--dng)',
  other: 'var(--bd)',
}

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
  const [selectedLoreId, setSelectedLoreId] = useState<string | null>(null)
  const [cfmDelete, setCfmDelete] = useState(false)
  const [loreLbImg, setLoreLbImg] = useState<GalleryImage | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiInstructions, setAiInstructions] = useState('')
  const [aiCtxStory, setAiCtxStory] = useState(true)
  const [aiCtxSummaries, setAiCtxSummaries] = useState(true)
  const [aiCtxLore, setAiCtxLore] = useState(true)
  const [aiCtxOverview, setAiCtxOverview] = useState(true)
  const [showAiPanel, setShowAiPanel] = useState(false)

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

  const selectedLore = selectedLoreId ? lore.find(l => l.id === selectedLoreId) : null

  const getLoreImage = (loreId: string) =>
    galleryImages.find(i => i.loreEntryId === loreId)

  const addNewLore = () => {
    const id = uid()
    dispatch({
      type: 'ADD_LORE',
      entry: { id, name: '', text: '', tag: 'world', enabled: true },
    })
    setSelectedLoreId(id)
  }

  const deleteLore = (id: string) => {
    dispatch({ type: 'REMOVE_LORE', id })
    setSelectedLoreId(null)
    setCfmDelete(false)
  }

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
            onClick={() => { setTab('summaries'); setSelectedLoreId(null) }}
          >
            Summaries ({summaries.length})
          </button>
          <button
            className="b bs"
            style={{ flex: 1, background: tab === 'lore' ? 'var(--ac)' : undefined, color: tab === 'lore' ? '#fff' : undefined }}
            onClick={() => { setTab('lore'); setSelectedLoreId(null) }}
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

        {tab === 'lore' && !selectedLore && (
          <>
            {/* Lore list view */}
            <button className="b ba" style={{ width: '100%', marginBottom: '.6rem' }} onClick={addNewLore}>
              + Add Entry
            </button>

            {lore.length === 0 && (
              <p style={{ color: 'var(--mt)', fontSize: '.82rem', textAlign: 'center', padding: '1rem 0' }}>
                No lore entries yet.
              </p>
            )}

            {lore.map(l => {
              const img = getLoreImage(l.id)
              const tagColor = TAG_COLORS[l.tag] || 'var(--bd)'
              return (
                <div
                  key={l.id}
                  className="lc"
                  style={{ opacity: l.enabled ? 1 : 0.5 }}
                  onClick={() => setSelectedLoreId(l.id)}
                >
                  {/* Thumbnail */}
                  <div className="lc-th">
                    {img ? (
                      <img src={img.url} alt="" />
                    ) : (
                      l.name ? l.name.charAt(0).toUpperCase() : '?'
                    )}
                  </div>

                  {/* Name */}
                  <div className="lc-nm">{l.name || '(untitled)'}</div>

                  {/* Tag */}
                  <span className="lc-tg" style={{ background: tagColor, color: '#fff' }}>{l.tag}</span>

                  {/* Enabled toggle */}
                  <input
                    type="checkbox"
                    checked={l.enabled}
                    onChange={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LORE', id: l.id }) }}
                    onClick={e => e.stopPropagation()}
                    style={{ width: '18px', height: '18px', flexShrink: 0 }}
                    title={l.enabled ? 'Included in prompt' : 'Excluded from prompt'}
                  />
                </div>
              )
            })}

            <div style={{ fontSize: '.7rem', color: 'var(--mt)', marginTop: '.5rem' }}>
              Enabled entries are included in every prompt.
            </div>
          </>
        )}

        {tab === 'lore' && selectedLore && (
          <>
            {/* Lore detail view */}
            <button className="b bs" onClick={() => { setSelectedLoreId(null); setCfmDelete(false) }}
              style={{ marginBottom: '.6rem' }}>
              &#x2190; Back
            </button>

            {/* Image area */}
            {(() => {
              const img = getLoreImage(selectedLore.id)
              if (img) return (
                <div className="ld-img" onClick={() => setLoreLbImg(img)} style={{ cursor: 'pointer' }}>
                  <img src={img.url} alt={selectedLore.name} />
                </div>
              )
              return (
                <div className="ld-img">
                  <span className="ld-ph">No image</span>
                </div>
              )
            })()}
            {onGenerateImage && (
              <button
                className="b bs"
                style={{ width: '100%', marginBottom: '.6rem' }}
                onClick={() => onGenerateImage(selectedLore.id)}
              >Generate Image</button>
            )}

            {/* Name */}
            <div className="gr">
              <label className="lb">Name</label>
              <input
                type="text"
                value={selectedLore.name}
                onChange={e => dispatch({ type: 'UPDATE_LORE', id: selectedLore.id, updates: { name: e.target.value } })}
                placeholder="Entry name..."
                style={{ width: '100%', fontSize: '.88rem', padding: '.45rem .5rem' }}
              />
            </div>

            {/* Tag */}
            <div className="gr">
              <label className="lb">Tag</label>
              <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap' }}>
                {LORE_TAGS.map(t => (
                  <button
                    key={t}
                    className={`b bs${selectedLore.tag === t ? ' ba' : ''}`}
                    style={selectedLore.tag === t ? { background: TAG_COLORS[t], borderColor: TAG_COLORS[t], color: '#fff' } : undefined}
                    onClick={() => dispatch({ type: 'UPDATE_LORE', id: selectedLore.id, updates: { tag: t } })}
                  >{t}</button>
                ))}
              </div>
            </div>

            {/* Text */}
            <div className="gr">
              <label className="lb">Content</label>
              <textarea
                className="mt"
                value={selectedLore.text}
                onChange={e => dispatch({ type: 'UPDATE_LORE', id: selectedLore.id, updates: { text: e.target.value } })}
                placeholder="Lore content..."
                rows={6}
              />
              <button
                className="b bs"
                style={{ width: '100%', marginTop: '.4rem' }}
                onClick={() => setShowAiPanel(p => !p)}
              >
                {showAiPanel ? 'Hide AI Generate' : 'AI Generate from Story'}
              </button>

              {showAiPanel && (
                <div style={{ border: '1px solid var(--bd)', borderRadius: '8px', padding: '.5rem', marginTop: '.4rem', background: 'var(--bg)' }}>
                  <div className="gr" style={{ marginBottom: '.5rem' }}>
                    <label className="lb">Instructions (optional)</label>
                    <textarea
                      className="mt"
                      value={aiInstructions}
                      onChange={e => setAiInstructions(e.target.value)}
                      placeholder="e.g. focus on appearance, describe relationships..."
                      rows={2}
                    />
                  </div>

                  <div className="gm-ctx" style={{ marginBottom: '.5rem' }}>
                    <label className="lb" style={{ marginBottom: '.2rem' }}>Context to include</label>
                    <label>
                      <input type="checkbox" checked={aiCtxStory} onChange={e => setAiCtxStory(e.target.checked)} />
                      {' '}Recent story
                    </label>
                    <label>
                      <input type="checkbox" checked={aiCtxSummaries} onChange={e => setAiCtxSummaries(e.target.checked)} />
                      {' '}Summaries
                    </label>
                    <label>
                      <input type="checkbox" checked={aiCtxLore} onChange={e => setAiCtxLore(e.target.checked)} />
                      {' '}Other lore entries
                    </label>
                    <label>
                      <input type="checkbox" checked={aiCtxOverview} onChange={e => setAiCtxOverview(e.target.checked)} />
                      {' '}Overview
                    </label>
                  </div>

                  <button
                    className="b ba"
                    style={{ width: '100%' }}
                    disabled={aiGenerating || !selectedLore.name.trim()}
                    onClick={async () => {
                      setAiGenerating(true)
                      setAiError('')
                      const ctx: Parameters<typeof api.generateLore>[3] = {}
                      if (aiCtxStory && story) {
                        ctx.recentStory = story.slice(-4000)
                      }
                      if (aiCtxSummaries && summaries.length > 0) {
                        ctx.summaries = summaries.map(s => s.text).join('\n\n')
                      }
                      if (aiCtxLore) {
                        const others = lore.filter(l => l.enabled && l.id !== selectedLore.id && l.text.trim())
                        if (others.length > 0) {
                          ctx.loreEntries = others.map(l => ({ name: l.name, text: l.text }))
                        }
                      }
                      if (aiCtxOverview && overview) {
                        ctx.overview = overview
                      }
                      try {
                        const text = await api.generateLore(
                          selectedLore.name.trim(),
                          selectedLore.tag,
                          aiInstructions.trim(),
                          ctx
                        )
                        dispatch({ type: 'UPDATE_LORE', id: selectedLore.id, updates: { text } })
                      } catch (e: any) {
                        setAiError(e.message || 'Failed to generate')
                      } finally {
                        setAiGenerating(false)
                      }
                    }}
                  >
                    {aiGenerating ? <><span className="spn" />Generating...</> : 'Generate'}
                  </button>
                  {aiError && <div className="er" style={{ marginTop: '.3rem' }}>{aiError}</div>}
                </div>
              )}
            </div>

            {/* Enabled */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.88rem', cursor: 'pointer', marginBottom: '.6rem' }}>
              <input
                type="checkbox"
                checked={selectedLore.enabled}
                onChange={() => dispatch({ type: 'TOGGLE_LORE', id: selectedLore.id })}
                style={{ width: '18px', height: '18px' }}
              />
              Include in prompts
            </label>

            {/* Delete */}
            {cfmDelete ? (
              <div className="cf">
                <span style={{ fontSize: '.82rem', flex: 1 }}>Delete this entry?</span>
                <button className="b bs" style={{ background: 'var(--dng)', borderColor: 'var(--dng)', color: '#fff' }}
                  onClick={() => deleteLore(selectedLore.id)}>Yes</button>
                <button className="b bs" onClick={() => setCfmDelete(false)}>No</button>
              </div>
            ) : (
              <button className="b bs" style={{ width: '100%', color: 'var(--dng)' }}
                onClick={() => setCfmDelete(true)}>Delete Entry</button>
            )}
          </>
        )}
      </div>

      {/* Lightbox for lore images */}
      {loreLbImg && (
        <Lightbox
          images={[loreLbImg]}
          index={0}
          onClose={() => setLoreLbImg(null)}
          onNavigate={() => {}}
        />
      )}
    </>
  )
}
