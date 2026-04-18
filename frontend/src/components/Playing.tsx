import { useState, useEffect, useRef } from 'react'
import StoryArea from './StoryArea'
import ActionInput from './ActionInput'
import AIPanel from './panels/AIPanel'
import MemoryPanel from './panels/MemoryPanel'
import TrackingPanel from './panels/TrackingPanel'
import SettingsPanel from './panels/SettingsPanel'
import MenuPanel from './panels/MenuPanel'
import GalleryPanel from './panels/GalleryPanel'
import GenerateImageModal from './GenerateImageModal'
import ToastContainer from './Toast'
import type { PanelId } from './PanelTabs'
import type { GameState, GalleryImage } from '../types'
import { useGallery } from '../hooks/useGallery'
import { useToast } from '../hooks/useToast'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'

interface Props {
  state: {
    story: string
    overview: string
    style: string
    cStyle: string
    diff: string
    arc: string
    storyModel: string
    supportModel: string
    gen: boolean
    streaming: string
    err: string
    summaries: GameState['summaries']
    lore: GameState['lore']
    autoSum: boolean
    autoAccept: boolean
    sumThreshold: number
    secs: GameState['secs']
    auFreq: number
    summing: boolean
    sumPreview: string | null
    stUp: boolean
    genStage: 'thinking' | 'writing' | 'stats' | 'summarizing' | null
    saveStatus: 'idle' | 'saving' | 'saved'
  }
  dispatch: React.Dispatch<any>
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
  actions: {
    submit: (action: string) => void
    cont: () => void
    regen: () => void
    deleteLast: () => void
    stop: () => void
    doSummarize: (autoTriggered?: boolean) => void
    confirmSummary: (text: string) => void
    dismissSummary: () => void
    doUpdateStats: () => void
    newAdventure: () => void
    saveFile: () => void
    exportMd: () => void
    loadFile: () => void
  }
  computed: {
    wordCount: number
    canSummarize: boolean
    summarizeWordCount: number
  }
}

export default function Playing({ state, dispatch, setField, actions, computed }: Props) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showArc, setShowArc] = useState(false)
  const [cfm, setCfm] = useState(false)
  const [pinScroll, setPinScroll] = useState(true)

  // Gallery
  const [showGenModal, setShowGenModal] = useState(false)
  const [genSource, setGenSource] = useState<'story' | 'lore'>('story')
  const [genLoreId, setGenLoreId] = useState<string | undefined>()
  const gallery = useGallery()

  // Toasts
  const { toasts, addToast, removeToast } = useToast()

  // Display preferences
  const dp = useDisplayPrefs()

  // Swipe gesture for panels
  const rootRef = useRef<HTMLDivElement>(null)
  const lastPanel = useRef<PanelId>('mem')
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  // Track last opened panel
  const openPanel = (id: PanelId | null) => {
    if (id) lastPanel.current = id
    setActivePanel(id)
  }

  // Reset pinScroll when generation starts
  const prevGen = useRef(false)
  useEffect(() => {
    if (state.gen && !prevGen.current) setPinScroll(true)
    prevGen.current = state.gen
  }, [state.gen])

  // Swipe handlers
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onStart = (e: TouchEvent) => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onEnd = (e: TouchEvent) => {
      if (!touchStart.current) return
      const dx = e.changedTouches[0].clientX - touchStart.current.x
      const dy = e.changedTouches[0].clientY - touchStart.current.y
      const startX = touchStart.current.x
      touchStart.current = null
      if (Math.abs(dy) > Math.abs(dx)) return // vertical scroll, ignore
      const w = window.innerWidth
      // Swipe left from right edge → open panel
      if (dx < -60 && startX > w - 35) {
        openPanel(lastPanel.current)
        return
      }
      // Swipe right while panel is open → close panel
      if (dx > 60 && activePanel) {
        setActivePanel(null)
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [activePanel])

  const memCount = state.summaries.length + state.lore.length

  const openGenModal = (source: 'story' | 'lore', loreId?: string) => {
    setGenSource(source)
    setGenLoreId(loreId)
    setShowGenModal(true)
  }

  const handleImagesGenerated = (imgs: GalleryImage[]) => {
    gallery.addImages(imgs)
  }

  // Toast: errors
  const prevErr = useRef('')
  useEffect(() => {
    if (state.err && state.err !== prevErr.current) {
      addToast(state.err, 'error', 5000)
    }
    prevErr.current = state.err
  }, [state.err, addToast])

  // Toast: stats updated
  const prevStUp = useRef(false)
  useEffect(() => {
    if (prevStUp.current && !state.stUp) {
      addToast('Stats updated', 'info')
    }
    prevStUp.current = state.stUp
  }, [state.stUp, addToast])

  // Toast: summarization
  const prevSumming = useRef(false)
  useEffect(() => {
    if (!prevSumming.current && state.summing) {
      addToast('Summarizing...', 'info')
    }
    prevSumming.current = state.summing
  }, [state.summing, addToast])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      switch (e.key) {
        case '1': openPanel(activePanel === 'mem' ? null : 'mem'); break
        case '2': openPanel(activePanel === 'gallery' ? null : 'gallery'); break
        case '3': openPanel(activePanel === 'track' ? null : 'track'); break
        case '4': openPanel(activePanel === 'settings' ? null : 'settings'); break
        case '5': openPanel(activePanel === 'ai' ? null : 'ai'); break
        case '6': setShowMenu(m => !m); break
        case 'Escape': setActivePanel(null); setShowMenu(false); break
        case 'a': setShowArc(a => !a); break
        case '/': {
          e.preventDefault()
          const textarea = document.querySelector('.ai') as HTMLTextAreaElement
          textarea?.focus()
          break
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [activePanel])

  // Streaming word count for gen feedback
  const streamingWords = state.streaming ? state.streaming.trim().split(/\s+/).length : 0

  return (
    <div className="R" ref={rootRef}>
      {/* Header */}
      <div className="hd">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', overflow: 'hidden', flex: 1 }}>
          <h1>{state.overview?.slice(0, 24) || 'AI RPG'}{state.overview && state.overview.length > 24 ? '\u2026' : ''}</h1>
          {state.saveStatus !== 'idle' && (
            <span className="sv">
              {state.saveStatus === 'saving' ? 'Saving...' : '\u2713 Saved'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '.3rem', flexShrink: 0 }}>
          <button className={`b bs${activePanel === 'mem' ? ' ba' : ''}`} onClick={() => openPanel(activePanel === 'mem' ? null : 'mem')}>
            Memory{memCount > 0 && <span style={{ fontSize: '.65rem', marginLeft: 1 }}>{memCount}</span>}
          </button>
          <button className={`b bs${activePanel === 'gallery' ? ' ba' : ''}`} onClick={() => openPanel(activePanel === 'gallery' ? null : 'gallery')}>
            Gallery{gallery.count > 0 && <span style={{ fontSize: '.65rem', marginLeft: 1 }}>{gallery.count}</span>}
          </button>
          <button className={`b bs${activePanel === 'track' ? ' ba' : ''}`} onClick={() => openPanel(activePanel === 'track' ? null : 'track')}>
            Track{state.secs.length > 0 && <span style={{ fontSize: '.65rem', marginLeft: 1 }}>{state.secs.length}</span>}
          </button>
          <button className={`b bs${activePanel === 'settings' ? ' ba' : ''}`} onClick={() => openPanel(activePanel === 'settings' ? null : 'settings')}>Settings</button>
          <button className={`b bs${activePanel === 'ai' ? ' ba' : ''}`} onClick={() => openPanel(activePanel === 'ai' ? null : 'ai')}>AI</button>
          <div style={{ position: 'relative' }}>
            <button className="b bs" onClick={() => setShowMenu(m => !m)}>&hellip;</button>
            <MenuPanel
              show={showMenu}
              onClose={() => setShowMenu(false)}
              onSave={actions.saveFile}
              onExportMd={actions.exportMd}
              onLoad={actions.loadFile}
              onNew={() => setCfm(true)}
            />
          </div>
        </div>
      </div>

      {/* Confirm reset */}
      {cfm && (
        <div className="cf">
          <span style={{ fontSize: '.85rem', flex: 1 }}>Reset adventure?</span>
          <button className="b bs" style={{ background: 'var(--dng)', borderColor: 'var(--dng)', color: '#fff' }}
            onClick={() => { actions.newAdventure(); setCfm(false) }}>Yes</button>
          <button className="b bs" onClick={() => setCfm(false)}>No</button>
        </div>
      )}

      {/* Panels */}
      <AIPanel show={activePanel === 'ai'} onClose={() => setActivePanel(null)}
        storyModel={state.storyModel} supportModel={state.supportModel} setField={setField}
        onSwitch={openPanel} />

      <MemoryPanel
        show={activePanel === 'mem'} onClose={() => setActivePanel(null)}
        summaries={state.summaries}
        lore={state.lore}
        autoSum={state.autoSum}
        autoAccept={state.autoAccept}
        sumThreshold={state.sumThreshold}
        sumPreview={state.sumPreview}
        wordCount={computed.wordCount}
        canSummarize={computed.canSummarize}
        summarizeWordCount={computed.summarizeWordCount}
        summing={state.summing}
        dispatch={dispatch} setField={setField}
        onSummarize={() => actions.doSummarize(false)}
        onConfirmSummary={actions.confirmSummary}
        onDismissSummary={actions.dismissSummary}
        galleryImages={gallery.images}
        onGenerateImage={(loreId) => openGenModal('lore', loreId)}
        story={state.story}
        overview={state.overview}
        onSwitch={openPanel}
      />

      <GalleryPanel
        show={activePanel === 'gallery'} onClose={() => setActivePanel(null)}
        images={gallery.images}
        onNewImage={() => openGenModal('story')}
        onDelete={gallery.removeImage}
        onClearAll={gallery.clearAll}
        onSwitch={openPanel}
      />

      <TrackingPanel
        show={activePanel === 'track'} onClose={() => setActivePanel(null)}
        secs={state.secs} auFreq={state.auFreq} stUp={state.stUp}
        dispatch={dispatch} setField={setField}
        onUpdateStats={actions.doUpdateStats}
        onSwitch={openPanel}
      />

      <SettingsPanel
        show={activePanel === 'settings'} onClose={() => setActivePanel(null)}
        style={state.style} cStyle={state.cStyle}
        overview={state.overview} diff={state.diff}
        setField={setField}
        onSwitch={openPanel}
        displayPrefs={dp.prefs}
        onSetTheme={dp.setTheme}
        onSetFontFamily={dp.setFontFamily}
        onSetFontSize={dp.setFontSize}
      />

      {/* Generate Image Modal */}
      <GenerateImageModal
        open={showGenModal}
        onClose={() => setShowGenModal(false)}
        onImagesGenerated={handleImagesGenerated}
        gameState={{
          story: state.story,
          summaries: state.summaries,
          lore: state.lore,
          overview: state.overview,
          sumUpTo: 0,
        }}
        defaultSource={genSource}
        defaultLoreEntryId={genLoreId}
      />

      {/* Story */}
      <StoryArea
        story={state.story}
        gen={state.gen}
        streaming={state.streaming}
        onChange={story => dispatch({ type: 'SET_STORY', story })}
        pinScroll={pinScroll}
      />

      {/* Status bars */}
      {(state.gen || state.stUp || state.summing) && (
        <div className="gb">
          <span className="gd">&#x25cf;</span>
          {state.genStage === 'thinking' && 'Thinking...'}
          {state.genStage === 'writing' && <>Writing...{streamingWords > 0 && ` +${streamingWords} words`}</>}
          {state.genStage === 'stats' && 'Updating stats...'}
          {state.genStage === 'summarizing' && 'Summarizing...'}
          {!state.genStage && (state.gen || state.stUp || state.summing) && 'Working...'}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '.3rem' }}>
            <button
              className={`b bs sp${pinScroll ? ' ba' : ''}`}
              onClick={() => setPinScroll(p => !p)}
              title={pinScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
            >{pinScroll ? '\u{1F4CC}' : '\u{1F4CC}'}</button>
            {state.gen && (
              <button className="b bs" onClick={actions.stop} style={{ color: 'var(--dng)', padding: '.2rem .5rem' }}>&#x23f9;</button>
            )}
          </span>
        </div>
      )}
      {state.story.trim() && !state.gen && !state.stUp && !state.summing && (
        <div className="ib">
          <span>{computed.wordCount.toLocaleString()}w</span>
          {state.summaries.length > 0 && <span className="bd" style={{ background: 'var(--ac2)', color: '#fff' }}>Sum {state.summaries.length}</span>}
          {state.lore.filter(l => l.enabled).length > 0 && <span className="bd" style={{ background: 'var(--ac)', color: '#fff' }}>Lore {state.lore.filter(l => l.enabled).length}</span>}
          {state.secs.length > 0 && state.auFreq > 0 && <span className="bd" style={{ background: 'var(--bd)', color: 'var(--tx)' }}>auto:{state.auFreq}</span>}
        </div>
      )}

      {/* Action input */}
      <ActionInput
        gen={state.gen}
        story={state.story}
        onSubmit={actions.submit}
        onContinue={actions.cont}
        onRegen={actions.regen}
        onDelete={actions.deleteLast}
        onStop={actions.stop}
        showArc={showArc}
        onToggleArc={() => setShowArc(a => !a)}
        arc={state.arc}
        onArcChange={v => setField('arc', v)}
        secsLength={state.secs.length}
        onShowTracking={() => openPanel('track')}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
