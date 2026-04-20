import { useReducer, useCallback, useEffect, useRef, useState } from 'react'
import type { Chapter, GameState, LoreEntry, Section, Phase, TTSModelSettings } from '../types'
import { defaultState, getActiveChapter, getViewingChapter, newChapterId, wordCount } from '../types'
import { expandShortcut } from '../utils/shortcuts'
import * as api from '../api'

interface State extends GameState {
  phase: Phase
  gen: boolean
  streaming: string
  err: string
  summing: boolean
  stUp: boolean
  loaded: boolean
  genStage: 'thinking' | 'writing' | 'stats' | 'summarizing' | null
  saveStatus: 'idle' | 'saving' | 'saved'
  lastNarrationId: number
  lastNarrationText: string
}

type Action =
  | { type: 'SET_FIELD'; field: keyof GameState; value: unknown }
  | { type: 'SET_PHASE'; phase: Phase }
  | { type: 'SET_GEN'; gen: boolean }
  | { type: 'SET_STREAMING'; text: string }
  | { type: 'SET_ERR'; err: string }
  | { type: 'SET_SUMMING'; summing: boolean }
  | { type: 'SET_STUP'; stUp: boolean }
  | { type: 'UPDATE_CHAPTER'; id: string; patch: Partial<Chapter> }
  | { type: 'SET_CHAPTERS'; chapters: Chapter[] }
  | { type: 'ADD_CHAPTER'; chapter: Chapter }
  | { type: 'REMOVE_CHAPTER'; id: string }
  | { type: 'SET_ACTIVE_CHAPTER'; id: string }
  | { type: 'SET_VIEWING_CHAPTER'; id: string }
  | { type: 'SET_ARCHIVED'; archived: Chapter[] }
  | { type: 'ADD_LORE'; entry: LoreEntry }
  | { type: 'UPDATE_LORE'; id: string; updates: Partial<LoreEntry> }
  | { type: 'REMOVE_LORE'; id: string }
  | { type: 'TOGGLE_LORE'; id: string }
  | { type: 'SET_LORE'; lore: LoreEntry[] }
  | { type: 'ADD_SEC'; sec: Section }
  | { type: 'UPDATE_SEC'; id: string; content: string }
  | { type: 'REMOVE_SEC'; id: string }
  | { type: 'SET_SECS'; secs: Section[] }
  | { type: 'LOAD_STATE'; state: GameState }
  | { type: 'ENTER_HUB' }
  | { type: 'RESET' }
  | { type: 'SET_LOADED' }
  | { type: 'SET_GEN_STAGE'; stage: State['genStage'] }
  | { type: 'SET_SAVE_STATUS'; status: State['saveStatus'] }
  | { type: 'SET_LAST_NARRATION'; text: string }
  | { type: 'SET_TTS_AUTOPLAY'; autoPlay: boolean }
  | { type: 'SET_TTS_MODEL'; model: string }
  | { type: 'SET_TTS_MODEL_SETTING'; model: string; settings: Partial<TTSModelSettings> }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SET_GEN':
      return { ...state, gen: action.gen }
    case 'SET_STREAMING':
      return { ...state, streaming: action.text }
    case 'SET_ERR':
      return { ...state, err: action.err }
    case 'SET_SUMMING':
      return { ...state, summing: action.summing }
    case 'SET_STUP':
      return { ...state, stUp: action.stUp }

    // Chapters
    case 'UPDATE_CHAPTER':
      return {
        ...state,
        chapters: state.chapters.map(c => c.id === action.id ? { ...c, ...action.patch } : c),
      }
    case 'SET_CHAPTERS':
      return { ...state, chapters: action.chapters }
    case 'ADD_CHAPTER':
      return { ...state, chapters: [...state.chapters, action.chapter] }
    case 'REMOVE_CHAPTER':
      return { ...state, chapters: state.chapters.filter(c => c.id !== action.id) }
    case 'SET_ACTIVE_CHAPTER':
      return { ...state, activeChapterId: action.id }
    case 'SET_VIEWING_CHAPTER':
      return { ...state, viewingChapterId: action.id }
    case 'SET_ARCHIVED':
      return { ...state, archivedChapters: action.archived }

    // Lore
    case 'ADD_LORE':
      return { ...state, lore: [...state.lore, action.entry] }
    case 'UPDATE_LORE':
      return { ...state, lore: state.lore.map(l => l.id === action.id ? { ...l, ...action.updates } : l) }
    case 'REMOVE_LORE':
      return { ...state, lore: state.lore.filter(l => l.id !== action.id) }
    case 'TOGGLE_LORE':
      return { ...state, lore: state.lore.map(l => l.id === action.id ? { ...l, enabled: !l.enabled } : l) }
    case 'SET_LORE':
      return { ...state, lore: action.lore }

    case 'ADD_SEC':
      return { ...state, secs: [...state.secs, action.sec] }
    case 'UPDATE_SEC':
      return { ...state, secs: state.secs.map(s => s.id === action.id ? { ...s, content: action.content } : s) }
    case 'REMOVE_SEC':
      return { ...state, secs: state.secs.filter(s => s.id !== action.id) }
    case 'SET_SECS':
      return { ...state, secs: action.secs }

    case 'LOAD_STATE': {
      const loaded = action.state
      const active = loaded.chapters?.find(c => c.id === loaded.activeChapterId) || loaded.chapters?.find(c => c.status === 'active')
      const hasPlayContent = !!(loaded.overview || (active && active.content))
      return {
        ...state,
        ...loaded,
        tts: loaded.tts || { autoPlay: false, activeModel: 'Kokoro-82m', perModel: {} },
        phase: hasPlayContent ? 'playing' : 'setup',
        loaded: true,
        gen: false,
        streaming: '',
        err: '',
        genStage: null,
      }
    }
    case 'ENTER_HUB':
      return {
        ...state,
        ...defaultState(),
        phase: 'hub',
        loaded: true,
        gen: false,
        streaming: '',
        err: '',
        summing: false,
        stUp: false,
        genStage: null,
        saveStatus: 'idle',
        lastNarrationId: 0,
        lastNarrationText: '',
      }
    case 'RESET':
      return {
        ...defaultState(),
        phase: 'setup',
        gen: false,
        streaming: '',
        err: '',
        summing: false,
        stUp: false,
        loaded: true,
        genStage: null,
        saveStatus: 'idle',
        lastNarrationId: 0,
        lastNarrationText: '',
      }
    case 'SET_LOADED':
      return { ...state, loaded: true }
    case 'SET_GEN_STAGE':
      return { ...state, genStage: action.stage }
    case 'SET_SAVE_STATUS':
      return { ...state, saveStatus: action.status }
    case 'SET_LAST_NARRATION':
      return { ...state, lastNarrationId: state.lastNarrationId + 1, lastNarrationText: action.text }
    case 'SET_TTS_AUTOPLAY':
      return { ...state, tts: { ...state.tts, autoPlay: action.autoPlay } }
    case 'SET_TTS_MODEL':
      return { ...state, tts: { ...state.tts, activeModel: action.model } }
    case 'SET_TTS_MODEL_SETTING': {
      const perModel = { ...(state.tts.perModel || {}) }
      perModel[action.model] = { ...(perModel[action.model] || {}), ...action.settings }
      return { ...state, tts: { ...state.tts, perModel } }
    }
    default:
      return state
  }
}

const initialState: State = {
  ...defaultState(),
  phase: 'setup',
  gen: false,
  streaming: '',
  err: '',
  summing: false,
  stUp: false,
  loaded: false,
  genStage: null,
  saveStatus: 'idle',
  lastNarrationId: 0,
  lastNarrationText: '',
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
function toRoman(n: number): string {
  return ROMAN[n - 1] || String(n)
}

// Serializable slice of state that gets persisted. `format` must be included:
// omitting it makes the backend's pre-v5 migration treat every save as a legacy
// session and wipe all chapter content.
function toPersistable(s: State): Partial<GameState> {
  const {
    name, overview, style, cStyle, storyModel, supportModel, modelRoles, arc, diff,
    lore, secs, auFreq, tts,
    chapters, activeChapterId, viewingChapterId, archivedChapters,
    effectiveCtxTokens, format,
  } = s
  return {
    name, overview, style, cStyle, storyModel, supportModel, modelRoles, arc, diff,
    lore, secs, auFreq, tts,
    chapters, activeChapterId, viewingChapterId, archivedChapters,
    effectiveCtxTokens, format,
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const abortRef = useRef<AbortController | null>(null)
  const genCountRef = useRef(0)
  const [pendingStatsUpdate, setPendingStatsUpdate] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state

  // Load state from server on mount. 404 → no current session → hub.
  useEffect(() => {
    api.getState()
      .then(s => {
        api.setCurrentSessionId(s.sessionId)
        dispatch({ type: 'LOAD_STATE', state: s })
      })
      .catch(err => {
        if (err instanceof api.NoCurrentSessionError) {
          api.setCurrentSessionId('')
          dispatch({ type: 'ENTER_HUB' })
        } else {
          dispatch({ type: 'SET_LOADED' })
        }
      })
  }, [])

  useEffect(() => {
    api.setCurrentSessionId(state.sessionId || '')
  }, [state.sessionId])

  const skipNextSave = useRef(false)
  const prevSessionRef = useRef(state.sessionId)
  useEffect(() => {
    if (prevSessionRef.current !== state.sessionId) {
      skipNextSave.current = true
      prevSessionRef.current = state.sessionId
    }
  }, [state.sessionId])

  // Auto-save to server (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const savedResetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (!state.loaded) return
    if (state.phase === 'hub' || !state.sessionId) return
    clearTimeout(saveTimer.current)
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    saveTimer.current = setTimeout(() => {
      dispatch({ type: 'SET_SAVE_STATUS', status: 'saving' })
      clearTimeout(savedResetTimer.current)
      api.saveState(toPersistable(state))
        .then(() => {
          dispatch({ type: 'SET_SAVE_STATUS', status: 'saved' })
          savedResetTimer.current = setTimeout(() => dispatch({ type: 'SET_SAVE_STATUS', status: 'idle' }), 2000)
        })
        .catch(() => {
          dispatch({ type: 'SET_SAVE_STATUS', status: 'idle' })
        })
    }, 1000)
    return () => clearTimeout(saveTimer.current)
  }, [
    state.name, state.overview, state.style, state.cStyle, state.storyModel, state.supportModel,
    state.modelRoles, state.arc, state.diff, state.lore, state.secs, state.auFreq, state.tts,
    state.chapters, state.activeChapterId, state.viewingChapterId, state.archivedChapters,
    state.effectiveCtxTokens, state.loaded, state.phase, state.sessionId,
  ])

  const doUpdateStatsRef = useRef<() => void>(() => {})

  const setField = useCallback(<K extends keyof GameState>(field: K, value: GameState[K]) => {
    dispatch({ type: 'SET_FIELD', field, value })
  }, [])

  // Check if the currently-viewed chapter is the active one. Generation actions require this.
  const isViewingActive = state.viewingChapterId === state.activeChapterId

  // Generate appends to the active chapter's content. Always operates on the active chapter,
  // regardless of which chapter the user is viewing. UI should block calls when not viewing active.
  const generate = useCallback((task: string, actionText?: string, baseContent?: string) => {
    const cur = stateRef.current
    const active = getActiveChapter(cur)
    if (!active) return

    dispatch({ type: 'SET_GEN', gen: true })
    dispatch({ type: 'SET_GEN_STAGE', stage: 'thinking' })
    dispatch({ type: 'SET_ERR', err: '' })
    dispatch({ type: 'SET_STREAMING', text: '' })

    const base = baseContent ?? active.content

    let currentContent = base
    if (task === 'action' && actionText) {
      currentContent = (base.trim() ? base.trim() + '\n\n' : '') + '> ' + actionText
      dispatch({ type: 'UPDATE_CHAPTER', id: active.id, patch: { content: currentContent } })
    }

    const ctrl = new AbortController()
    abortRef.current = ctrl

    // Save latest state so the backend sees the new action before generating.
    const optimistic: State = {
      ...cur,
      chapters: cur.chapters.map(c => c.id === active.id ? { ...c, content: currentContent } : c),
    }
    const savePromise = api.saveState(toPersistable(optimistic)).catch(() => {})

    savePromise.then(() => {
      api.generate(task, actionText || '', ctrl.signal, {
        onChunk: (text) => {
          dispatch({ type: 'SET_GEN_STAGE', stage: 'writing' })
          dispatch({ type: 'SET_STREAMING', text })
          dispatch({
            type: 'UPDATE_CHAPTER',
            id: active.id,
            patch: { content: currentContent.trim() + '\n\n' + text },
          })
        },
        onDone: (text) => {
          const finalContent = currentContent.trim() + (text.trim() ? '\n\n' + text.trim() : '')
          dispatch({ type: 'UPDATE_CHAPTER', id: active.id, patch: { content: finalContent } })
          dispatch({ type: 'SET_STREAMING', text: '' })
          dispatch({ type: 'SET_GEN', gen: false })
          dispatch({ type: 'SET_GEN_STAGE', stage: null })
          if (text.trim()) dispatch({ type: 'SET_LAST_NARRATION', text: text.trim() })

          // Flush immediately so a reload right after completion preserves the result.
          // The debounced auto-save would otherwise drop it if the user reloads within 1s.
          const latest = stateRef.current
          const flushed: State = {
            ...latest,
            chapters: latest.chapters.map(c => c.id === active.id ? { ...c, content: finalContent } : c),
          }
          clearTimeout(saveTimer.current)
          skipNextSave.current = true
          api.saveState(toPersistable(flushed)).catch(() => {})

          if (text.trim() && cur.auFreq > 0 && cur.secs.length > 0) {
            genCountRef.current++
            if (genCountRef.current >= cur.auFreq) {
              genCountRef.current = 0
              setPendingStatsUpdate(true)
            }
          }
        },
        onError: (error) => {
          dispatch({ type: 'SET_ERR', err: error.slice(0, 300) })
          dispatch({ type: 'SET_STREAMING', text: '' })
          dispatch({ type: 'SET_GEN', gen: false })
          dispatch({ type: 'SET_GEN_STAGE', stage: null })
        },
      })
    })
  }, [])

  const start = useCallback(() => {
    dispatch({ type: 'SET_PHASE', phase: 'playing' })
    generate('open')
  }, [generate])

  const submit = useCallback((action: string) => {
    if (!action.trim() || state.gen || state.summing || !isViewingActive) return
    generate('action', expandShortcut(action.trim()))
  }, [generate, state.gen, state.summing, isViewingActive])

  const cont = useCallback(() => {
    if (state.gen || state.summing || !isViewingActive) return
    const active = getActiveChapter(state)
    const isFirstChunk = !active || !active.content.trim()
    generate(isFirstChunk ? 'open' : 'continue')
  }, [generate, state, isViewingActive])

  // Regen re-does the last generation. It derives its base from the active chapter's
  // content (not a transient ref — that resets on reload) by stripping the last
  // generated paragraph. If the chunk before that is a player action ("> ..."),
  // the regen re-runs as 'action' preserving the action line.
  const regen = useCallback(() => {
    if (state.gen || state.summing || !isViewingActive) return
    const active = getActiveChapter(state)
    if (!active) return

    const trimmed = active.content.trim()
    const chunks = trimmed ? trimmed.split(/\n\n/) : []
    if (chunks.length === 0) {
      dispatch({ type: 'UPDATE_CHAPTER', id: active.id, patch: { content: '' } })
      generate('open')
      return
    }
    // Drop the last chunk — the generated paragraph we're replacing.
    chunks.pop()
    const prior = chunks[chunks.length - 1] || ''
    if (prior.startsWith('> ')) {
      // Last generation responded to a player action — keep the action, regen it.
      chunks.pop()
      const base = chunks.join('\n\n')
      dispatch({ type: 'UPDATE_CHAPTER', id: active.id, patch: { content: base } })
      generate('action', prior.replace(/^> /, ''), base)
      return
    }
    const base = chunks.join('\n\n')
    dispatch({ type: 'UPDATE_CHAPTER', id: active.id, patch: { content: base } })
    if (!base.trim()) generate('open')
    else generate('continue', undefined, base)
  }, [generate, state, isViewingActive])

  const deleteLast = useCallback(() => {
    if (state.gen || state.summing || !isViewingActive) return
    const active = getActiveChapter(state)
    if (!active) return
    const chunks = active.content.trim().split(/\n\n/)
    if (!chunks.length) return
    chunks.pop()
    if (chunks.length && chunks[chunks.length - 1].startsWith('> ')) chunks.pop()
    dispatch({ type: 'UPDATE_CHAPTER', id: active.id, patch: { content: chunks.join('\n\n') } })
  }, [state, isViewingActive])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setTimeout(() => {
      dispatch({ type: 'SET_STREAMING', text: '' })
      dispatch({ type: 'SET_GEN', gen: false })
      dispatch({ type: 'SET_GEN_STAGE', stage: null })
      dispatch({ type: 'SET_ERR', err: 'Stopped' })
    }, 500)
  }, [])

  // --- Chapter-level actions ---

  const openChapter = useCallback((id: string) => {
    dispatch({ type: 'SET_VIEWING_CHAPTER', id })
  }, [])

  const returnToActive = useCallback(() => {
    dispatch({ type: 'SET_VIEWING_CHAPTER', id: stateRef.current.activeChapterId })
  }, [])

  const editChapter = useCallback((id: string, patch: Partial<Chapter>) => {
    const cur = stateRef.current
    const ch = cur.chapters.find(c => c.id === id)
    if (!ch) return
    // If content or summary changes on a closed/act chapter, mark summary stale.
    const isStructural = (patch.content !== undefined && patch.content !== ch.content) ||
                         (patch.summary !== undefined && patch.summary !== ch.summary)
    const needsStale = isStructural && (ch.status === 'closed' || ch.status === 'act') && patch.summaryStale === undefined
    const finalPatch: Partial<Chapter> = needsStale && patch.content !== undefined
      ? { ...patch, summaryStale: true }
      : patch
    dispatch({ type: 'UPDATE_CHAPTER', id, patch: finalPatch })
  }, [])

  const resummarizeChapter = useCallback(async (id: string) => {
    const cur = stateRef.current
    const ch = cur.chapters.find(c => c.id === id)
    if (!ch || ch.status === 'active') return
    dispatch({ type: 'SET_SUMMING', summing: true })
    dispatch({ type: 'SET_GEN_STAGE', stage: 'summarizing' })
    try {
      let summaryText = ''
      if (ch.status === 'act' && ch.children?.length) {
        const childSummaries = ch.children
          .map(cid => cur.chapters.find(c => c.id === cid)?.summary || '')
          .filter(Boolean)
          .join('\n\n---\n\n')
        summaryText = await api.summarize(childSummaries, true)
      } else {
        summaryText = await api.summarize(ch.content)
      }
      const trimmed = summaryText.trim()
      if (trimmed) {
        dispatch({ type: 'UPDATE_CHAPTER', id, patch: { summary: trimmed, summaryStale: false } })
      }
    } catch (e) {
      dispatch({ type: 'SET_ERR', err: 'Summarize failed: ' + (e instanceof Error ? e.message : '') })
    }
    dispatch({ type: 'SET_GEN_STAGE', stage: null })
    dispatch({ type: 'SET_SUMMING', summing: false })
  }, [])

  // Close the active chapter (summarize + title it), then create a new blank active chapter.
  const endChapterAndStartNew = useCallback(async () => {
    const cur = stateRef.current
    const active = getActiveChapter(cur)
    if (!active || !active.content.trim() || cur.gen || cur.summing) return

    dispatch({ type: 'SET_SUMMING', summing: true })
    dispatch({ type: 'SET_GEN_STAGE', stage: 'summarizing' })

    try {
      const [summaryText, titleText] = await Promise.all([
        api.summarize(active.content),
        api.suggestName('session', active.content.slice(0, 4000)).catch(() => ''),
      ])
      const summary = summaryText.trim()
      let title = titleText.trim()
      if (!title) {
        const leafCount = cur.chapters.filter(c => c.status !== 'act').length
        title = `Chapter ${leafCount}`
      }

      // Close the current active chapter.
      dispatch({
        type: 'UPDATE_CHAPTER',
        id: active.id,
        patch: { status: 'closed', summary, title: active.title || title, summaryStale: false },
      })
      // Create a new active chapter.
      const newId = newChapterId()
      const newCh: Chapter = {
        id: newId,
        title: '',
        content: '',
        summary: '',
        status: 'active',
        createdAt: Math.floor(Date.now() / 1000),
      }
      dispatch({ type: 'ADD_CHAPTER', chapter: newCh })
      dispatch({ type: 'SET_ACTIVE_CHAPTER', id: newId })
      dispatch({ type: 'SET_VIEWING_CHAPTER', id: newId })
    } catch (e) {
      dispatch({ type: 'SET_ERR', err: 'End-chapter failed: ' + (e instanceof Error ? e.message : '') })
    }
    dispatch({ type: 'SET_GEN_STAGE', stage: null })
    dispatch({ type: 'SET_SUMMING', summing: false })
  }, [])

  // Rewind to a given closed chapter: make it active and archive (or delete) subsequent chapters.
  // Refuses if the target is inside an act — caller should show a hint to un-act first.
  const rewindToChapter = useCallback((id: string, mode: 'archive' | 'delete') => {
    const cur = stateRef.current
    const idx = cur.chapters.findIndex(c => c.id === id)
    if (idx < 0) return
    const target = cur.chapters[idx]
    if (target.status === 'act') return
    // Check if it's a child of any act.
    const insideAct = cur.chapters.some(c => c.status === 'act' && c.children?.includes(id))
    if (insideAct) {
      dispatch({ type: 'SET_ERR', err: 'Un-act the surrounding group first to rewind into it.' })
      return
    }

    const subsequent = cur.chapters.slice(idx + 1)
    const kept = cur.chapters.slice(0, idx + 1).map(c =>
      c.id === id ? { ...c, status: 'active' as const, summary: '' } : c,
    )

    dispatch({ type: 'SET_CHAPTERS', chapters: kept })
    dispatch({ type: 'SET_ACTIVE_CHAPTER', id })
    dispatch({ type: 'SET_VIEWING_CHAPTER', id })
    if (mode === 'archive' && subsequent.length > 0) {
      dispatch({ type: 'SET_ARCHIVED', archived: [...cur.archivedChapters, ...subsequent] })
    }
    // 'delete' mode: subsequent chapters are simply dropped (not added to archive).
  }, [])

  // Create an act from a set of closed chapters. The children stay in chapters[] (so they
  // remain viewable/editable); the act references them by ID. In prompt/outline, children
  // of an act are hidden from the flat list — only the act's summary represents them.
  const createAct = useCallback(async (childIds: string[]) => {
    const cur = stateRef.current
    const ids = new Set(childIds)
    const children = cur.chapters.filter(c => ids.has(c.id) && c.status === 'closed')
    if (children.length === 0 || cur.summing) return

    dispatch({ type: 'SET_SUMMING', summing: true })
    dispatch({ type: 'SET_GEN_STAGE', stage: 'summarizing' })
    try {
      const joined = children.map(c => c.summary).filter(Boolean).join('\n\n---\n\n')
      const condensed = await api.summarize(joined, true)
      const trimmed = condensed.trim()
      if (!trimmed) throw new Error('empty condensation')

      const actId = newChapterId()
      const actCount = cur.chapters.filter(c => c.status === 'act').length + 1
      const act: Chapter = {
        id: actId,
        title: `Act ${toRoman(actCount)}`,
        content: '',
        summary: trimmed,
        status: 'act',
        children: children.map(c => c.id),
        createdAt: Math.floor(Date.now() / 1000),
      }

      // Insert the act where the earliest child sits. Children stay in chapters[].
      const earliestIdx = cur.chapters.findIndex(c => c.id === children[0].id)
      const next = [...cur.chapters]
      next.splice(earliestIdx, 0, act)
      dispatch({ type: 'SET_CHAPTERS', chapters: next })
    } catch (e) {
      dispatch({ type: 'SET_ERR', err: 'Create act failed: ' + (e instanceof Error ? e.message : '') })
    }
    dispatch({ type: 'SET_GEN_STAGE', stage: null })
    dispatch({ type: 'SET_SUMMING', summing: false })
  }, [])

  // Un-act: drop the act entry; its children remain in chapters[].
  const unactAct = useCallback((actId: string) => {
    dispatch({ type: 'REMOVE_CHAPTER', id: actId })
  }, [])

  const unarchiveChapter = useCallback((id: string) => {
    const cur = stateRef.current
    const ch = cur.archivedChapters.find(c => c.id === id)
    if (!ch) return
    const remaining = cur.archivedChapters.filter(c => c.id !== id)
    dispatch({ type: 'SET_ARCHIVED', archived: remaining })
    // Append after the active chapter (restored as closed).
    const activeIdx = cur.chapters.findIndex(c => c.id === cur.activeChapterId)
    const restored: Chapter = { ...ch, status: 'closed' }
    const next = [...cur.chapters]
    next.splice(activeIdx + 1, 0, restored)
    dispatch({ type: 'SET_CHAPTERS', chapters: next })
  }, [])

  const deleteChapter = useCallback((id: string) => {
    const cur = stateRef.current
    const ch = cur.chapters.find(c => c.id === id)
    if (!ch) return
    // Can't delete the only active chapter — ensure another active exists first.
    if (ch.status === 'active') {
      // Promote the previous chapter to active, or create a blank one if none.
      const idx = cur.chapters.findIndex(c => c.id === id)
      const prior = cur.chapters.slice(0, idx).reverse().find(c => c.status === 'closed')
      if (prior) {
        dispatch({ type: 'UPDATE_CHAPTER', id: prior.id, patch: { status: 'active', summary: '' } })
        dispatch({ type: 'SET_ACTIVE_CHAPTER', id: prior.id })
        dispatch({ type: 'SET_VIEWING_CHAPTER', id: prior.id })
      } else {
        const newId = newChapterId()
        dispatch({
          type: 'ADD_CHAPTER',
          chapter: {
            id: newId,
            title: '',
            content: '',
            summary: '',
            status: 'active',
            createdAt: Math.floor(Date.now() / 1000),
          },
        })
        dispatch({ type: 'SET_ACTIVE_CHAPTER', id: newId })
        dispatch({ type: 'SET_VIEWING_CHAPTER', id: newId })
      }
    }
    dispatch({ type: 'REMOVE_CHAPTER', id })
    // Also detach from any parent act's children list.
    const updatedChapters = cur.chapters
      .filter(c => c.id !== id)
      .map(c => c.status === 'act' && c.children?.includes(id)
        ? { ...c, children: c.children.filter(cid => cid !== id) }
        : c)
    dispatch({ type: 'SET_CHAPTERS', chapters: updatedChapters })
  }, [])

  const doUpdateStats = useCallback(async () => {
    const cur = stateRef.current
    if (!cur.secs.length || cur.stUp) return
    const active = getActiveChapter(cur)
    dispatch({ type: 'SET_STUP', stUp: true })
    dispatch({ type: 'SET_GEN_STAGE', stage: 'stats' })
    dispatch({ type: 'SET_ERR', err: '' })

    try {
      const updated = await api.updateStats(cur.secs, active?.content || '')
      dispatch({ type: 'SET_SECS', secs: updated })
    } catch (e) {
      dispatch({ type: 'SET_ERR', err: 'Stats update failed: ' + (e instanceof Error ? e.message : '') })
    }
    dispatch({ type: 'SET_GEN_STAGE', stage: null })
    dispatch({ type: 'SET_STUP', stUp: false })
  }, [])

  doUpdateStatsRef.current = doUpdateStats
  useEffect(() => {
    if (!state.gen && pendingStatsUpdate && state.secs.length > 0) {
      setPendingStatsUpdate(false)
      doUpdateStatsRef.current()
    }
  }, [state.gen, pendingStatsUpdate, state.secs.length])

  const flushPendingSave = useCallback(async () => {
    clearTimeout(saveTimer.current)
    if (!state.sessionId || state.phase === 'hub') return
    try { await api.saveState(toPersistable(state)) } catch { /* ignore */ }
  }, [state])

  const abortGeneration = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const enterHub = useCallback(() => {
    genCountRef.current = 0
    api.setCurrentSessionId('')
    dispatch({ type: 'ENTER_HUB' })
  }, [])

  const saveFile = useCallback(async () => {
    try {
      const blob = await api.exportState()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'adventure.json'
      a.click()
    } catch { /* ignore */ }
  }, [])

  const exportMd = useCallback(() => {
    const cur = stateRef.current
    const body = cur.chapters.map(c => {
      const title = c.title || ''
      if (c.status === 'active') return `## ${title || 'Current'}\n\n${c.content}`
      if (c.status === 'closed') return `## ${title}\n\n${c.summary}`
      if (c.status === 'act') return `## ${title} (condensed)\n\n${c.summary}`
      return ''
    }).filter(Boolean).join('\n\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([`# ${cur.overview || 'Adventure'}\n\n${body}`], { type: 'text/markdown' }))
    a.download = 'adventure.md'
    a.click()
  }, [])

  const loadFile = useCallback(() => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = '.json'
    inp.onchange = async (e) => {
      try {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        const text = await file.text()
        const imported = await api.importState(text)
        api.setCurrentSessionId(imported.sessionId)
        dispatch({ type: 'LOAD_STATE', state: imported })
      } catch {
        dispatch({ type: 'SET_ERR', err: 'Failed to load' })
      }
    }
    inp.click()
  }, [])

  // Computed values
  const activeChapter = getActiveChapter(state)
  const viewingChapter = getViewingChapter(state)
  const activeWordCount = wordCount(activeChapter?.content || '')

  return {
    state,
    dispatch,
    setField,
    actions: {
      start,
      submit,
      cont,
      regen,
      deleteLast,
      stop,
      openChapter,
      returnToActive,
      editChapter,
      resummarizeChapter,
      endChapterAndStartNew,
      rewindToChapter,
      unarchiveChapter,
      createAct,
      unactAct,
      deleteChapter,
      doUpdateStats,
      enterHub,
      saveFile,
      exportMd,
      loadFile,
      generate,
      flushPendingSave,
      abortGeneration,
    },
    computed: {
      activeChapter,
      viewingChapter,
      isViewingActive,
      activeWordCount,
    },
  }
}
