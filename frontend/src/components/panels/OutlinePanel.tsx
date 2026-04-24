import { useMemo, useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import type { Chapter } from '../../types'
import { wordCount, renderChapterContent } from '../../types'
import * as api from '../../api'

interface Props {
  show: boolean
  onClose: () => void
  chapters: Chapter[]
  archivedChapters: Chapter[]
  activeChapterId: string
  viewingChapterId: string
  busy: boolean
  onOpen: (id: string) => void
  onEndChapter: () => void
  onResummarize: (id: string) => void
  onRenameChapter: (id: string, title: string) => void
  onDeleteChapter: (id: string) => void
  onUnarchive: (id: string) => void
  onCreateAct: (childIds: string[]) => void
  onUnactAct: (actId: string) => void

  // Session menu actions (formerly MenuPanel)
  onSave: () => void
  onExportMd: () => void
  onLoad: () => void
  onHub: () => void
  onSaveAsScenario: () => void
  canSaveAsScenario: boolean
  onShowCheatsheet: () => void
}

export default function OutlinePanel({
  show, onClose, chapters, archivedChapters, activeChapterId, viewingChapterId, busy,
  onOpen, onEndChapter, onResummarize, onRenameChapter, onDeleteChapter, onUnarchive,
  onCreateAct, onUnactAct,
  onSave, onExportMd, onLoad, onHub, onSaveAsScenario, canSaveAsScenario, onShowCheatsheet,
}: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedActs, setExpandedActs] = useState<Record<string, boolean>>({})
  const [actPickerN, setActPickerN] = useState(3)
  const [showActPicker, setShowActPicker] = useState(false)

  const active = chapters.find(c => c.id === activeChapterId)
  const activeContent = active ? renderChapterContent(active) : ''
  const activeWords = wordCount(activeContent)
  const canEnd = !busy && activeContent.trim().length > 0

  const childOfAct = useMemo(() => {
    const set = new Set<string>()
    for (const c of chapters) {
      if (c.status === 'act' && c.children) c.children.forEach(id => set.add(id))
    }
    return set
  }, [chapters])

  const childrenByAct = useMemo(() => {
    const map: Record<string, Chapter[]> = {}
    for (const act of chapters) {
      if (act.status === 'act' && act.children) {
        map[act.id] = act.children
          .map(id => chapters.find(c => c.id === id))
          .filter((c): c is Chapter => !!c)
      }
    }
    return map
  }, [chapters])

  const closedChaptersOutsideActs = chapters.filter(c => c.status === 'closed' && !childOfAct.has(c.id))

  const startRename = (c: Chapter) => {
    setRenamingId(c.id)
    setRenameValue(c.title)
  }
  const commitRename = () => {
    if (renamingId) onRenameChapter(renamingId, renameValue.trim())
    setRenamingId(null)
  }

  const titleOrFallback = (c: Chapter, leafIdx: number, actIdx: number) => {
    if (c.title) return c.title
    if (c.status === 'act') return `Act ${actIdx}`
    return `Chapter ${leafIdx}`
  }

  // Index counters for fallback titles
  let leafCounter = 0
  let actCounter = 0

  const renderItem = (c: Chapter, isChild = false) => {
    const isActive = c.id === activeChapterId
    const isViewing = c.id === viewingChapterId
    const currentLeaf = c.status !== 'act' ? ++leafCounter : leafCounter
    const currentAct = c.status === 'act' ? ++actCounter : actCounter
    const title = titleOrFallback(c, currentLeaf, currentAct)
    const wordCountText = c.status === 'active'
      ? `${wordCount(renderChapterContent(c)).toLocaleString()}w`
      : c.summary ? `~${wordCount(c.summary).toLocaleString()}w summary` : 'no summary'
    const cls = ['ol-it', isActive ? 'active' : '', isViewing ? 'viewing' : ''].filter(Boolean).join(' ')
    const expanded = c.status === 'act' ? !!expandedActs[c.id] : false

    return (
      <div key={c.id} style={isChild ? { marginLeft: '1rem' } : undefined}>
        <div className={cls} onClick={() => onOpen(c.id)}>
          <div className="ol-it-h">
            {c.status === 'active' && <span style={{ color: 'var(--ac)', fontSize: '.7rem' }}>●</span>}
            {c.status === 'act' && (
              <button
                className="b bs"
                onClick={(e) => { e.stopPropagation(); setExpandedActs(s => ({ ...s, [c.id]: !s[c.id] })) }}
                style={{ padding: '0 .2rem', fontSize: '.7rem', background: 'transparent', border: 'none', color: 'var(--mt)' }}
                title={expanded ? 'Collapse' : 'Expand'}
                aria-label={expanded ? 'Collapse act' : 'Expand act'}
              >{expanded ? <ChevronDown size={12} className="ic" /> : <ChevronRight size={12} className="ic" />}</button>
            )}
            {renamingId === c.id ? (
              <input
                className="ol-it-t"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onClick={e => e.stopPropagation()}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                autoFocus
                style={{ fontSize: '.85rem', background: 'var(--bg)', border: '1px solid var(--bd)', color: 'var(--tx)', padding: '.15rem .3rem', borderRadius: 4 }}
              />
            ) : (
              <span className="ol-it-t">{title}</span>
            )}
            {c.summaryStale && <span className="ol-it-stale" title="Summary out of sync with content" />}
          </div>
          <div className="ol-it-m">
            <span>{c.status}</span>
            <span>{wordCountText}</span>
            {c.status === 'act' && c.children && <span>{c.children.length} chapters</span>}
          </div>
          {isViewing && (
            <div className="ol-it-a" onClick={e => e.stopPropagation()}>
              <button className="b bs" onClick={() => startRename(c)} style={{ padding: '.15rem .35rem', fontSize: '.7rem' }}>Rename</button>
              {c.status !== 'active' && (
                <button className="b bs" onClick={() => onResummarize(c.id)} disabled={busy} style={{ padding: '.15rem .35rem', fontSize: '.7rem' }}>
                  Re-{c.status === 'act' ? 'condense' : 'summarize'}
                </button>
              )}
              {c.status === 'act' && (
                <button className="b bs" onClick={() => onUnactAct(c.id)} style={{ padding: '.15rem .35rem', fontSize: '.7rem' }}>Un-act</button>
              )}
              {confirmDeleteId === c.id ? (
                <>
                  <button className="b bs" onClick={() => { onDeleteChapter(c.id); setConfirmDeleteId(null) }} style={{ padding: '.15rem .35rem', fontSize: '.7rem', color: 'var(--dng)' }}>Confirm</button>
                  <button className="b bs" onClick={() => setConfirmDeleteId(null)} style={{ padding: '.15rem .35rem', fontSize: '.7rem' }}>Cancel</button>
                </>
              ) : (
                <button className="b bs" onClick={() => setConfirmDeleteId(c.id)} style={{ padding: '.15rem .35rem', fontSize: '.7rem' }}>Delete</button>
              )}
            </div>
          )}
        </div>
        {expanded && c.status === 'act' && childrenByAct[c.id] && (
          <div>
            {childrenByAct[c.id].map(child => renderItem(child, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pnl ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>Outline</span>
          <button className="b bs" onClick={onClose} aria-label="Close outline"><X size={16} className="ic ic-muted" /></button>
        </div>

        <div style={{ marginBottom: '.75rem' }}>
          <button
            className="b ba"
            onClick={onEndChapter}
            disabled={!canEnd}
            style={{ width: '100%' }}
            title={!canEnd ? 'Active chapter is empty' : 'Summarize current chapter and start a new one'}
          >
            End chapter &amp; start new
          </button>
          <div style={{ fontSize: '.72rem', color: 'var(--mt)', marginTop: '.25rem', textAlign: 'center' }}>
            Active: {activeWords.toLocaleString()}w
          </div>
        </div>

        {/* Chapter list — flat, skipping children of acts */}
        <div>
          {chapters.filter(c => !childOfAct.has(c.id)).map(c => renderItem(c, false))}
        </div>

        {/* Create act */}
        {closedChaptersOutsideActs.length >= 2 && (
          <div style={{ marginTop: '.75rem', borderTop: '1px solid var(--bd)', paddingTop: '.75rem' }}>
            {!showActPicker ? (
              <button className="b bs" onClick={() => setShowActPicker(true)} style={{ width: '100%', fontSize: '.78rem' }}>
                Create Act from oldest chapters...
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                <label style={{ fontSize: '.78rem' }}>
                  Condense oldest {actPickerN} of {closedChaptersOutsideActs.length}
                </label>
                <input
                  type="range"
                  min={2}
                  max={closedChaptersOutsideActs.length}
                  value={Math.min(actPickerN, closedChaptersOutsideActs.length)}
                  onChange={e => setActPickerN(Number(e.target.value))}
                />
                <div style={{ display: 'flex', gap: '.3rem' }}>
                  <button
                    className="b ba"
                    onClick={() => {
                      const picked = closedChaptersOutsideActs.slice(0, actPickerN).map(c => c.id)
                      onCreateAct(picked)
                      setShowActPicker(false)
                    }}
                    disabled={busy}
                    style={{ flex: 1 }}
                  >
                    Create Act
                  </button>
                  <button className="b bs" onClick={() => setShowActPicker(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Session menu */}
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--bd)', paddingTop: '.75rem', display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
          <button className="b bs" onClick={() => { onHub(); onClose() }} style={{ justifyContent: 'flex-start' }}>Sessions&hellip;</button>
          <button
            className="b bs"
            disabled={!canSaveAsScenario}
            onClick={() => { onSaveAsScenario(); onClose() }}
            style={{ justifyContent: 'flex-start', opacity: canSaveAsScenario ? 1 : 0.5 }}
          >Save as Scenario</button>
          <button className="b bs" onClick={() => { onSave(); onClose() }} style={{ justifyContent: 'flex-start' }}>Export JSON</button>
          <button className="b bs" onClick={() => { onExportMd(); onClose() }} style={{ justifyContent: 'flex-start' }}>Export MD</button>
          <button className="b bs" onClick={() => { onLoad(); onClose() }} style={{ justifyContent: 'flex-start' }}>Import JSON</button>
          <button className="b bs" onClick={() => { onShowCheatsheet() }} style={{ justifyContent: 'flex-start' }}>Cheatsheet</button>
        </div>

        {/* Danger zone */}
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--bd)', paddingTop: '.75rem' }}>
          <label className="lb" style={{ marginBottom: '.5rem', color: 'var(--dng)' }}>Danger zone</label>
          <button
            className="b bs"
            onClick={async () => {
              if (!window.confirm('Delete all sessions, scenarios, gallery images, and local preferences? This cannot be undone.')) return
              if (!window.confirm('Really? Everything will be wiped and the app will reload.')) return
              try {
                await api.resetAllData()
              } catch { /* ignore \u2014 we\u2019re wiping anyway */ }
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i)
                if (k && k.startsWith('ai-rpg-')) localStorage.removeItem(k)
              }
              location.reload()
            }}
            style={{ justifyContent: 'flex-start', width: '100%', color: 'var(--dng)', borderColor: 'var(--dng)' }}
          >Clear all data</button>
          <div className="hint" style={{ marginTop: '.3rem' }}>Deletes all sessions, scenarios, gallery images, and local preferences.</div>
        </div>

        {/* Archived chapters */}
        {archivedChapters.length > 0 && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--bd)', paddingTop: '.75rem' }}>
            <button
              className="b bs"
              onClick={() => setShowArchived(s => !s)}
              style={{ width: '100%', justifyContent: 'space-between', fontSize: '.78rem' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}>{showArchived ? <ChevronDown size={12} className="ic" /> : <ChevronRight size={12} className="ic" />} Archived ({archivedChapters.length})</span>
            </button>
            {showArchived && (
              <div style={{ marginTop: '.4rem' }}>
                {archivedChapters.map(c => (
                  <div key={c.id} className="ol-it" style={{ opacity: 0.7 }}>
                    <div className="ol-it-h">
                      <span className="ol-it-t">{c.title || 'Untitled'}</span>
                    </div>
                    <div className="ol-it-m">
                      <span>{c.status}</span>
                      <span>archived</span>
                    </div>
                    <div className="ol-it-a">
                      <button className="b bs" onClick={() => onUnarchive(c.id)} style={{ padding: '.15rem .35rem', fontSize: '.7rem' }}>
                        Un-archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
