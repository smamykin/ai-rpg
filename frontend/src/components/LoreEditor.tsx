import { useState } from 'react'
import type { LoreEntry, GalleryImage } from '../types'
import { uid, LORE_TAGS } from '../types'
import * as api from '../api'
import Lightbox from './Lightbox'
import SuggestNameButton from './SuggestNameButton'

const TAG_COLORS: Record<string, string> = {
  world: 'var(--ac)',
  character: 'var(--ac2)',
  rule: 'var(--mt)',
  quest: 'var(--dng)',
  item: 'var(--itm)',
  creature: 'var(--crt)',
  other: 'var(--bd)',
}

export interface LoreEditorAIContext {
  story?: string
  overview?: string
  summaries?: string // joined summaries text (from chapters)
}

interface Props {
  lore: LoreEntry[]
  onChange: (next: LoreEntry[]) => void
  galleryImages?: GalleryImage[]
  onGenerateImage?: (loreId: string) => void
  aiContext?: LoreEditorAIContext
}

function upsert(list: LoreEntry[], id: string, patch: Partial<LoreEntry>): LoreEntry[] {
  return list.map(l => l.id === id ? { ...l, ...patch } : l)
}

export default function LoreEditor({ lore, onChange, galleryImages = [], onGenerateImage, aiContext }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cfmDelete, setCfmDelete] = useState(false)
  const [lbImg, setLbImg] = useState<GalleryImage | null>(null)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiInstructions, setAiInstructions] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiCtxStory, setAiCtxStory] = useState(true)
  const [aiCtxSummaries, setAiCtxSummaries] = useState(true)
  const [aiCtxLore, setAiCtxLore] = useState(true)
  const [aiCtxOverview, setAiCtxOverview] = useState(true)

  const selected = selectedId ? lore.find(l => l.id === selectedId) : null

  const getLoreImage = (loreId: string) =>
    galleryImages.find(i => i.loreEntryId === loreId)

  const addNew = () => {
    const id = uid()
    onChange([...lore, { id, name: '', text: '', tag: 'world', enabled: true }])
    setSelectedId(id)
  }

  const update = (id: string, patch: Partial<LoreEntry>) => {
    onChange(upsert(lore, id, patch))
  }

  const remove = (id: string) => {
    onChange(lore.filter(l => l.id !== id))
    setSelectedId(null)
    setCfmDelete(false)
  }

  const toggle = (id: string) => {
    onChange(lore.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l))
  }

  if (!selected) {
    // List view
    return (
      <>
        <button className="b ba" style={{ width: '100%', marginBottom: '.6rem' }} onClick={addNew}>
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
              onClick={() => setSelectedId(l.id)}
            >
              <div className="lc-th">
                {img ? <img src={img.url} alt="" /> : (l.name ? l.name.charAt(0).toUpperCase() : '?')}
              </div>
              <div className="lc-nm">{l.name || '(untitled)'}</div>
              <span className="lc-tg" style={{ background: tagColor, color: '#fff' }}>{l.tag}</span>
              <input
                type="checkbox"
                checked={l.enabled}
                onChange={e => { e.stopPropagation(); toggle(l.id) }}
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
    )
  }

  // Detail view
  const img = getLoreImage(selected.id)
  const story = aiContext?.story ?? ''
  const overview = aiContext?.overview ?? ''
  const summaries = aiContext?.summaries ?? ''

  return (
    <>
      <button className="b bs" onClick={() => { setSelectedId(null); setCfmDelete(false) }}
        style={{ marginBottom: '.6rem' }}>
        &#x2190; Back
      </button>

      {(img || onGenerateImage) && (
        <>
          {img ? (
            <div className="ld-img" onClick={() => setLbImg(img)} style={{ cursor: 'pointer' }}>
              <img src={img.url} alt={selected.name} />
            </div>
          ) : (
            <div className="ld-img"><span className="ld-ph">No image</span></div>
          )}
          {onGenerateImage && (
            <button
              className="b bs"
              style={{ width: '100%', marginBottom: '.6rem' }}
              onClick={() => onGenerateImage(selected.id)}
            >Generate Image</button>
          )}
        </>
      )}

      <div className="gr">
        <label className="lb">Name</label>
        <div style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
          <input
            type="text"
            value={selected.name}
            onChange={e => update(selected.id, { name: e.target.value })}
            placeholder="Entry name (or let AI suggest)..."
            style={{ flex: 1, fontSize: '.88rem', padding: '.45rem .5rem' }}
          />
          <SuggestNameButton
            kind="lore"
            text={selected.text}
            tag={selected.tag}
            context={{ overview, recentStory: story.slice(-2000) }}
            disabled={!selected.text.trim()}
            onSuggest={n => update(selected.id, { name: n })}
          />
        </div>
      </div>

      <div className="gr">
        <label className="lb">Tag</label>
        <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap' }}>
          {LORE_TAGS.map(t => (
            <button
              key={t}
              className={`b bs${selected.tag === t ? ' ba' : ''}`}
              style={selected.tag === t ? { background: TAG_COLORS[t], borderColor: TAG_COLORS[t], color: '#fff' } : undefined}
              onClick={() => update(selected.id, { tag: t })}
            >{t}</button>
          ))}
        </div>
      </div>

      <div className="gr">
        <label className="lb">Content</label>
        <textarea
          className="mt"
          value={selected.text}
          onChange={e => update(selected.id, { text: e.target.value })}
          placeholder="Lore content..."
          rows={6}
        />
        {aiContext && (
          <>
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
                  <label><input type="checkbox" checked={aiCtxStory} onChange={e => setAiCtxStory(e.target.checked)} /> Recent story</label>
                  <label><input type="checkbox" checked={aiCtxSummaries} onChange={e => setAiCtxSummaries(e.target.checked)} /> Summaries</label>
                  <label><input type="checkbox" checked={aiCtxLore} onChange={e => setAiCtxLore(e.target.checked)} /> Other lore entries</label>
                  <label><input type="checkbox" checked={aiCtxOverview} onChange={e => setAiCtxOverview(e.target.checked)} /> Overview</label>
                </div>
                <button
                  className="b ba"
                  style={{ width: '100%' }}
                  disabled={aiGenerating || (!selected.name.trim() && !aiInstructions.trim())}
                  onClick={async () => {
                    setAiGenerating(true); setAiError('')
                    const ctx: Parameters<typeof api.generateLore>[3] = {}
                    if (aiCtxStory && story) ctx.recentStory = story.slice(-4000)
                    if (aiCtxSummaries && summaries) ctx.summaries = summaries
                    if (aiCtxLore) {
                      const others = lore.filter(l => l.enabled && l.id !== selected.id && l.text.trim())
                      if (others.length > 0) ctx.loreEntries = others.map(l => ({ name: l.name, text: l.text }))
                    }
                    if (aiCtxOverview && overview) ctx.overview = overview
                    try {
                      const text = await api.generateLore(selected.name.trim(), selected.tag, aiInstructions.trim(), ctx)
                      update(selected.id, { text })
                    } catch (e) {
                      setAiError((e as Error).message || 'Failed to generate')
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
          </>
        )}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.88rem', cursor: 'pointer', marginBottom: '.6rem' }}>
        <input
          type="checkbox"
          checked={selected.enabled}
          onChange={() => toggle(selected.id)}
          style={{ width: '18px', height: '18px' }}
        />
        Include in prompts
      </label>

      {cfmDelete ? (
        <div className="cf">
          <span style={{ fontSize: '.82rem', flex: 1 }}>Delete this entry?</span>
          <button className="b bs" style={{ background: 'var(--dng)', borderColor: 'var(--dng)', color: '#fff' }}
            onClick={() => remove(selected.id)}>Yes</button>
          <button className="b bs" onClick={() => setCfmDelete(false)}>No</button>
        </div>
      ) : (
        <button className="b bs" style={{ width: '100%', color: 'var(--dng)' }}
          onClick={() => setCfmDelete(true)}>Delete Entry</button>
      )}

      {lbImg && (
        <Lightbox
          images={[lbImg]}
          index={0}
          onClose={() => setLbImg(null)}
          onNavigate={() => {}}
        />
      )}
    </>
  )
}
