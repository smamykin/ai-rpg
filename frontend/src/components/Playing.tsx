import { useState, useEffect, useRef, useMemo } from 'react'
import StoryArea from './StoryArea'
import ActionInput from './ActionInput'
import StoryPanel from './panels/StoryPanel'
import TrackingPanel from './panels/TrackingPanel'
import SettingsPanel from './panels/SettingsPanel'
import GalleryPanel from './panels/GalleryPanel'
import OutlinePanel from './panels/OutlinePanel'
import PromptPanel from './panels/PromptPanel'
import GenerateImageModal from './GenerateImageModal'
import SaveAsScenarioModal from './SaveAsScenarioModal'
import RewindModal from './RewindModal'
import CheatsheetModal from './CheatsheetModal'
import Lightbox from './Lightbox'
import ToastContainer from './Toast'
import type { PanelId } from './PanelTabs'
import type { Chapter, GameState, GalleryImage, TTSSettings, Turn } from '../types'
import { renderChapterContent, detectThinkingModel } from '../types'
import { Menu, Check, RotateCcw } from 'lucide-react'
import { useGallery } from '../hooks/useGallery'
import { useToast } from '../hooks/useToast'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'
import { useTTS } from '../hooks/useTTS'
import { getModelMeta, getModelSettings } from '../constants/tts'
import { estimatePromptTokens, budgetLevel } from '../utils/budget'

interface Props {
  state: {
    overview: string
    style: string
    cStyle: string
    imgStyle?: string
    diff: string
    arc: string
    storyModel: string
    supportModel: string
    reasoningEffort?: string
    modelRoles: Record<string, string>
    name: string
    sessionId: string
    gen: boolean
    streaming: string
    streamingReasoning: string
    err: string
    lore: GameState['lore']
    chapters: Chapter[]
    activeChapterId: string
    viewingChapterId: string
    archivedChapters: Chapter[]
    effectiveCtxTokens: number
    secs: GameState['secs']
    notes: GameState['notes']
    auFreq: number
    tts: TTSSettings
    lastNarrationId: number
    lastNarrationText: string
    summing: boolean
    stUp: boolean
    genStage: 'sending' | 'thinking' | 'writing' | 'stats' | 'summarizing' | null
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
    openChapter: (id: string) => void
    returnToActive: () => void
    editChapter: (id: string, patch: Partial<Chapter>) => void
    editTurn: (chapterId: string, turnId: string, patch: Partial<Turn>) => void
    deleteTurn: (chapterId: string, turnId: string) => void
    resummarizeChapter: (id: string) => void
    endChapterAndStartNew: () => void
    rewindToChapter: (id: string, mode: 'archive' | 'delete') => void
    unarchiveChapter: (id: string) => void
    createAct: (childIds: string[]) => void
    unactAct: (actId: string) => void
    deleteChapter: (id: string) => void
    doUpdateStats: () => void
    enterHub: () => void
    saveFile: () => void
    exportMd: () => void
    loadFile: () => void
  }
  computed: {
    activeChapter: Chapter | undefined
    viewingChapter: Chapter | undefined
    isViewingActive: boolean
    activeWordCount: number
  }
}

export default function Playing({ state, dispatch, setField, actions, computed }: Props) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)
  const [showOutline, setShowOutline] = useState(false)
  const [showRewind, setShowRewind] = useState(false)
  const [showArc, setShowArc] = useState(false)
  const [showSaveAsScenario, setShowSaveAsScenario] = useState(false)
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  const [pinScroll, setPinScroll] = useState(true)
  const [scrollReq, setScrollReq] = useState(0)

  const togglePin = () => {
    setPinScroll(p => {
      if (!p) setScrollReq(r => r + 1)
      return !p
    })
  }

  // Gallery
  const [showGenModal, setShowGenModal] = useState(false)
  const [genSource, setGenSource] = useState<'story' | 'lore'>('story')
  const [genLoreId, setGenLoreId] = useState<string | undefined>()
  const [storyLbIdx, setStoryLbIdx] = useState<number | null>(null)
  const gallery = useGallery()

  const sessionStoryImgs = useMemo(
    () => gallery.images.filter(i => i.source === 'story' && i.sessionId === state.sessionId),
    [gallery.images, state.sessionId]
  )
  const pinnedBgId = gallery.getBgImageId(state.sessionId) || null
  const bgImage = useMemo(() => {
    if (pinnedBgId) return gallery.images.find(i => i.id === pinnedBgId) || null
    return sessionStoryImgs[0] || null
  }, [pinnedBgId, gallery.images, sessionStoryImgs])

  const openStoryLightbox = (imgId: string) => {
    const idx = sessionStoryImgs.findIndex(i => i.id === imgId)
    if (idx >= 0) setStoryLbIdx(idx)
  }

  // Toasts
  const { toasts, addToast, removeToast } = useToast()

  // Display preferences
  const dp = useDisplayPrefs()

  // TTS playback
  const tts = useTTS()
  const activeTTSModel = state.tts?.activeModel || 'Kokoro-82m'
  const modelMeta = getModelMeta(activeTTSModel)
  const modelSettings = useMemo(() => getModelSettings(state.tts, activeTTSModel), [state.tts, activeTTSModel])
  const buildTTSRequest = (text: string) => ({
    text,
    model: activeTTSModel,
    voice: modelSettings.voice || 'nova',
    speed: modelSettings.speed,
    instructions: modelMeta.supportsInstructions ? modelSettings.instructions : '',
    dialogueVoice: modelMeta.supportsDialogueVoice ? modelSettings.dialogueVoice : '',
  })

  const viewing = computed.viewingChapter
  const viewingContent = viewing ? renderChapterContent(viewing) : ''
  const activeContent = computed.activeChapter ? renderChapterContent(computed.activeChapter) : ''

  // Auto-play TTS on new AI narration
  const seenNarrationId = useRef(0)
  useEffect(() => {
    if (!state.lastNarrationId || state.lastNarrationId === seenNarrationId.current) return
    seenNarrationId.current = state.lastNarrationId
    if (state.tts?.autoPlay && state.lastNarrationText.trim()) {
      tts.playReplace(buildTTSRequest(state.lastNarrationText))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastNarrationId])

  // Speaker button: play the most recent AI narration.
  const lastAINarration = useMemo(() => {
    if (state.lastNarrationText.trim()) return state.lastNarrationText.trim()
    const turns = computed.activeChapter?.turns || []
    for (let i = turns.length - 1; i >= 0; i--) {
      const r = turns[i].response.trim()
      if (r) return r
    }
    return ''
  }, [computed.activeChapter?.turns, state.lastNarrationText])

  const handleSpeakLast = () => {
    if (!lastAINarration) return
    tts.playAppend(buildTTSRequest(lastAINarration))
  }

  const handleReadAloud = (text: string) => {
    if (!text.trim()) return
    tts.playReplace(buildTTSRequest(text.trim()))
  }

  // Swipe gesture for panels
  const rootRef = useRef<HTMLDivElement>(null)
  const lastPanel = useRef<PanelId>('story')
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const openPanel = (id: PanelId | null) => {
    if (id) {
      lastPanel.current = id
      setShowOutline(false)
    }
    setActivePanel(id)
  }

  const prevGen = useRef(false)
  useEffect(() => {
    if (state.gen && !prevGen.current) {
      setPinScroll(true)
      setScrollReq(r => r + 1)
    }
    prevGen.current = state.gen
  }, [state.gen])

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
      touchStart.current = null
      if (Math.abs(dy) > Math.abs(dx)) return
      // Swipe left → open session panel
      if (dx < -80 && !activePanel && !showOutline) {
        openPanel(lastPanel.current)
        return
      }
      // Swipe right → open outline
      if (dx > 80 && !showOutline && !activePanel) {
        setShowOutline(true)
        return
      }
      // Swipe right while right panel open → close
      if (dx > 80 && activePanel) {
        setActivePanel(null)
      }
      // Swipe left while outline open → close
      if (dx < -80 && showOutline) {
        setShowOutline(false)
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [activePanel, showOutline])

  const loreCount = state.lore.length

  const openGenModal = (source: 'story' | 'lore', loreId?: string) => {
    setGenSource(source)
    setGenLoreId(loreId)
    setShowGenModal(true)
  }

  const handleImagesGenerated = (imgs: GalleryImage[]) => {
    const chapter = computed.activeChapter
    const lastTurn = chapter?.turns[chapter.turns.length - 1]
    const stamped = imgs.map(i =>
      i.source === 'story' && lastTurn
        ? { ...i, turnId: lastTurn.id, chapterId: chapter!.id }
        : i
    )
    gallery.addImages(stamped, state.sessionId)
  }

  const promptTokens = useMemo(() => estimatePromptTokens(state), [state.chapters, state.lore, state.overview, state.secs, state.style])
  const budget = budgetLevel(promptTokens, state.effectiveCtxTokens)
  const pctUsed = state.effectiveCtxTokens > 0 ? Math.round((promptTokens / state.effectiveCtxTokens) * 100) : 0

  const prevErr = useRef('')
  useEffect(() => {
    if (state.err && state.err !== prevErr.current) {
      addToast(state.err, 'error', 5000)
    }
    prevErr.current = state.err
  }, [state.err, addToast])

  const prevStUp = useRef(false)
  useEffect(() => {
    if (prevStUp.current && !state.stUp) {
      addToast('Stats updated', 'info')
    }
    prevStUp.current = state.stUp
  }, [state.stUp, addToast])

  const prevSumming = useRef(false)
  useEffect(() => {
    if (!prevSumming.current && state.summing) {
      addToast('Summarizing...', 'info')
    }
    prevSumming.current = state.summing
  }, [state.summing, addToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      switch (e.key) {
        case '1': openPanel(activePanel === 'story' ? null : 'story'); break
        case '2': openPanel(activePanel === 'gallery' ? null : 'gallery'); break
        case '3': openPanel(activePanel === 'track' ? null : 'track'); break
        case '4': openPanel(activePanel === 'settings' ? null : 'settings'); break
        case '5': openPanel(activePanel === 'prompt' ? null : 'prompt'); break
        case 'o': setShowOutline(s => !s); break
        case 'Escape': setActivePanel(null); setShowOutline(false); break
        case 'a': setShowArc(a => !a); break
        case '?': setShowCheatsheet(s => !s); break
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

  const streamingWords = state.streaming ? state.streaming.trim().split(/\s+/).length : 0
  const reasoningWords = state.streamingReasoning ? state.streamingReasoning.trim().split(/\s+/).length : 0
  const thinkingSupported = detectThinkingModel(state.storyModel)
  const thinkingOn = !!state.reasoningEffort && state.reasoningEffort !== 'none'
  const onToggleThinking = () => {
    if (thinkingOn) {
      setField('reasoningEffort', 'none')
    } else {
      const last = state.reasoningEffort && state.reasoningEffort !== 'none' ? state.reasoningEffort : 'low'
      setField('reasoningEffort', last)
    }
  }
  const [reasoningOpen, setReasoningOpen] = useState(false)
  useEffect(() => {
    if (state.genStage !== 'thinking') setReasoningOpen(false)
  }, [state.genStage])

  // Per-turn edits/deletes on the currently-viewed chapter.
  const handleTurnEdit = (turnId: string, patch: Partial<Turn>) => {
    if (!viewing) return
    actions.editTurn(viewing.id, turnId, patch)
  }
  const handleTurnDelete = (turnId: string) => {
    if (!viewing) return
    actions.deleteTurn(viewing.id, turnId)
  }

  const summariesAsText = useMemo(
    () => state.chapters.filter(c => c.status !== 'active' && c.summary).map(c => c.summary).join('\n\n'),
    [state.chapters],
  )

  return (
    <div className="R" ref={rootRef}>
      {/* Ambient background */}
      {dp.prefs.ambientBg && bgImage && (
        <div className="ambi" aria-hidden>
          <img src={bgImage.url} alt="" />
        </div>
      )}

      {/* Header */}
      <div className="hd">
        <button
          className={`b bs${showOutline ? ' ba' : ''}`}
          onClick={() => { setShowOutline(true); setActivePanel(null) }}
          title="Outline & menu"
          aria-label="Outline menu"
        ><Menu size={16} className="ic" /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', overflow: 'hidden', flex: 1, minWidth: 0 }}>
          <h1>{state.overview?.slice(0, 24) || 'AI RPG'}{state.overview && state.overview.length > 24 ? '\u2026' : ''}</h1>
          {state.saveStatus !== 'idle' && (
            <span className="sv">
              {state.saveStatus === 'saving' ? 'Saving...' : <><Check size={12} className="ic ic-success" /> Saved</>}
            </span>
          )}
        </div>
        <button
          className={`b bs${activePanel ? ' ba' : ''}`}
          onClick={() => openPanel(activePanel ? null : lastPanel.current)}
          title="Session (Lore, Gallery, Track, Settings, AI)"
          aria-label="Session menu"
        >
          <Menu size={16} className="ic" />
          {(loreCount > 0 || state.secs.length > 0 || gallery.count > 0) && (
            <span style={{ fontSize: '.65rem', marginLeft: '.25rem', color: 'var(--mt)' }}>
              {[loreCount && `L${loreCount}`, gallery.count && `G${gallery.count}`, state.secs.length && `T${state.secs.length}`].filter(Boolean).join(' ')}
            </span>
          )}
        </button>
      </div>

      {/* Left: outline */}
      <OutlinePanel
        show={showOutline}
        onClose={() => setShowOutline(false)}
        chapters={state.chapters}
        archivedChapters={state.archivedChapters}
        activeChapterId={state.activeChapterId}
        viewingChapterId={state.viewingChapterId}
        busy={state.gen || state.summing}
        onOpen={(id) => { actions.openChapter(id); setShowOutline(false) }}
        onEndChapter={actions.endChapterAndStartNew}
        onResummarize={actions.resummarizeChapter}
        onRenameChapter={(id, title) => actions.editChapter(id, { title })}
        onDeleteChapter={actions.deleteChapter}
        onUnarchive={actions.unarchiveChapter}
        onCreateAct={actions.createAct}
        onUnactAct={actions.unactAct}
        onSave={actions.saveFile}
        onExportMd={actions.exportMd}
        onLoad={actions.loadFile}
        onHub={actions.enterHub}
        onSaveAsScenario={() => setShowSaveAsScenario(true)}
        canSaveAsScenario={!state.gen}
        onShowCheatsheet={() => { setShowCheatsheet(true); setShowOutline(false) }}
      />

      {/* Panels */}
      <StoryPanel
        show={activePanel === 'story'} onClose={() => setActivePanel(null)}
        lore={state.lore}
        notes={state.notes || []}
        dispatch={dispatch}
        galleryImages={gallery.images}
        onGenerateImage={(loreId) => openGenModal('lore', loreId)}
        story={activeContent}
        overview={state.overview}
        summariesText={summariesAsText}
        style={state.style}
        cStyle={state.cStyle}
        imgStyle={state.imgStyle}
        diff={state.diff}
        setField={setField}
        onSwitch={openPanel}
      />

      <GalleryPanel
        show={activePanel === 'gallery'} onClose={() => setActivePanel(null)}
        images={gallery.images}
        currentSessionId={state.sessionId}
        onNewImage={() => openGenModal('story')}
        onDelete={gallery.removeImage}
        onClearAll={gallery.clearAll}
        onSwitch={openPanel}
        pinnedBgId={gallery.getBgImageId(state.sessionId) || null}
        onSetBg={(id) => gallery.setBgImageId(state.sessionId, id)}
      />

      <TrackingPanel
        show={activePanel === 'track'} onClose={() => setActivePanel(null)}
        secs={state.secs} auFreq={state.auFreq} stUp={state.stUp}
        dispatch={dispatch} setField={setField}
        onUpdateStats={actions.doUpdateStats}
        onSwitch={openPanel}
      />

      <PromptPanel
        show={activePanel === 'prompt'} onClose={() => setActivePanel(null)}
        onSwitch={openPanel}
        sessionId={state.sessionId}
        hasActiveContent={!!activeContent.trim()}
      />

      <SettingsPanel
        show={activePanel === 'settings'} onClose={() => setActivePanel(null)}
        onSwitch={openPanel}
        storyModel={state.storyModel}
        supportModel={state.supportModel}
        reasoningEffort={state.reasoningEffort}
        modelRoles={state.modelRoles}
        effectiveCtxTokens={state.effectiveCtxTokens}
        setField={setField}
        displayPrefs={dp.prefs}
        onSetTheme={dp.setTheme}
        onSetFontFamily={dp.setFontFamily}
        onSetFontSize={dp.setFontSize}
        onSetEditorFontFamily={dp.setEditorFontFamily}
        onSetEditorFontSize={dp.setEditorFontSize}
        onSetAmbientBg={dp.setAmbientBg}
        onSetAmbientBlur={dp.setAmbientBlur}
        tts={state.tts}
        dispatch={dispatch}
        ttsPlaying={tts.isPlaying || tts.isLoading}
        onStopTTS={tts.stop}
      />

      <GenerateImageModal
        open={showGenModal}
        onClose={() => setShowGenModal(false)}
        onImagesGenerated={handleImagesGenerated}
        gameState={{
          story: activeContent,
          summaries: summariesAsText,
          lore: state.lore,
          overview: state.overview,
          imgStyle: state.imgStyle,
        }}
        defaultSource={genSource}
        defaultLoreEntryId={genLoreId}
      />

      <SaveAsScenarioModal
        show={showSaveAsScenario}
        onClose={() => setShowSaveAsScenario(false)}
        state={{
          name: state.name,
          overview: state.overview,
          cStyle: state.cStyle,
          style: state.style,
          diff: state.diff,
          lore: state.lore,
          secs: state.secs,
        }}
      />

      <CheatsheetModal
        show={showCheatsheet}
        onClose={() => setShowCheatsheet(false)}
      />

      {/* Viewing-chapter banner (shown when user is browsing a non-active chapter) */}
      {!computed.isViewingActive && viewing && (
        <div className="vb">
          <span>
            Viewing <strong>{viewing.title || 'Untitled'}</strong>
            {viewing.status === 'closed' && ' (closed)'}
            {viewing.status === 'act' && ' (act)'}
          </span>
          <span style={{ display: 'flex', gap: '.3rem' }}>
            {viewing.status === 'closed' && !state.chapters.some(c => c.status === 'act' && c.children?.includes(viewing.id)) && (
              <button className="b bs" onClick={() => setShowRewind(true)} title="Make this the active chapter; archive or delete later chapters">
                <RotateCcw size={14} className="ic" /> Rewind
              </button>
            )}
            <button className="b bs" onClick={actions.returnToActive}>Return</button>
          </span>
        </div>
      )}

      <RewindModal
        show={showRewind}
        target={viewing}
        subsequentCount={viewing ? Math.max(0, state.chapters.length - 1 - state.chapters.findIndex(c => c.id === viewing.id)) : 0}
        onClose={() => setShowRewind(false)}
        onConfirm={(mode) => { if (viewing) actions.rewindToChapter(viewing.id, mode) }}
      />

      {/* Story */}
      <StoryArea
        turns={viewing?.turns || []}
        gen={state.gen && computed.isViewingActive}
        streaming={state.streaming}
        onTurnEdit={handleTurnEdit}
        onTurnDelete={handleTurnDelete}
        pinScroll={pinScroll}
        scrollRequest={scrollReq}
        onReadAloud={handleReadAloud}
        galleryImages={sessionStoryImgs}
        onOpenImage={openStoryLightbox}
      />

      {storyLbIdx !== null && sessionStoryImgs[storyLbIdx] && (
        <Lightbox
          images={sessionStoryImgs}
          index={storyLbIdx}
          onClose={() => setStoryLbIdx(null)}
          onNavigate={setStoryLbIdx}
          onDelete={(id) => { gallery.removeImage(id); setStoryLbIdx(null) }}
          pinnedBgId={pinnedBgId}
          onSetBg={(id) => gallery.setBgImageId(state.sessionId, id)}
        />
      )}

      {/* Status bars */}
      {(state.gen || state.stUp || state.summing) && (
        <>
          <div
            className={`gb${state.streamingReasoning ? ' cl' : ''}`}
            onClick={state.streamingReasoning ? () => setReasoningOpen(o => !o) : undefined}
          >
            <span className="gd">&#x25cf;</span>
            {state.genStage === 'sending' && 'Sending...'}
            {state.genStage === 'thinking' && <>Thinking...{reasoningWords > 0 && ` +${reasoningWords} words`}</>}
            {state.genStage === 'writing' && <>Writing...{streamingWords > 0 && ` +${streamingWords} words`}</>}
            {state.genStage === 'stats' && 'Updating stats...'}
            {state.genStage === 'summarizing' && 'Summarizing...'}
            {!state.genStage && (state.gen || state.stUp || state.summing) && 'Working...'}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: '.3rem' }}>
              <button
                className={`b bs sp${pinScroll ? ' ba' : ''}`}
                onClick={(e) => { e.stopPropagation(); togglePin() }}
                title={pinScroll ? 'Following — tap to detach' : 'Detached — tap to jump to bottom'}
              >{pinScroll ? '\u{1F4CC}' : '\u{2B07}'}</button>
            </span>
          </div>
          {reasoningOpen && state.streamingReasoning && (
            <div className="rz">{state.streamingReasoning}</div>
          )}
        </>
      )}
      {activeContent.trim() && !state.gen && !state.stUp && !state.summing && (
        <div className="ib">
          <span>{computed.activeWordCount.toLocaleString()}w</span>
          {state.chapters.filter(c => c.status !== 'active').length > 0 && (
            <span className="bd" style={{ background: 'var(--ac2)', color: '#fff' }}>
              Chapters {state.chapters.filter(c => c.status !== 'active').length}
            </span>
          )}
          {state.lore.filter(l => l.enabled).length > 0 && <span className="bd" style={{ background: 'var(--ac)', color: '#fff' }}>Lore {state.lore.filter(l => l.enabled).length}</span>}
          {state.secs.length > 0 && state.auFreq > 0 && <span className="bd" style={{ background: 'var(--bd)', color: 'var(--tx)' }}>auto:{state.auFreq}</span>}
          {budget !== 'ok' && (
            <span
              className="bd"
              style={{
                background: budget === 'block' ? 'var(--dng)' : '#b08530',
                color: '#fff',
                marginLeft: 'auto',
              }}
              title={budget === 'block'
                ? 'Prompt would exceed effective context — close the chapter or raise the setting.'
                : 'Context is filling up — consider closing the chapter soon.'}
            >
              ctx {pctUsed}%
            </span>
          )}
        </div>
      )}

      {/* Action input */}
      <ActionInput
        gen={state.gen}
        busy={state.gen || state.summing || !computed.isViewingActive || budget === 'block'}
        story={viewingContent}
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
        onSpeak={handleSpeakLast}
        canSpeak={!!lastAINarration}
        ttsBusy={tts.isPlaying || tts.isLoading}
        onStopTTS={tts.stop}
        thinkingSupported={thinkingSupported}
        thinkingOn={thinkingOn}
        onToggleThinking={onToggleThinking}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
